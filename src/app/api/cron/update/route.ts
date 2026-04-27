/**
 * GET /api/cron/update
 * fetch_views + calc_index を順番に実行する。
 * Vercel Cron から毎日 JST 0:10 に呼び出される。
 * CRON_SECRET ヘッダーで保護。
 */

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

const K = 3
const BASELINE_DAYS = 180

// ── fetch_views ────────────────────────────────────────────────────────────────

async function fetchChannelViewCount(channelId: string): Promise<number> {
  const url = new URL('https://www.googleapis.com/youtube/v3/channels')
  url.searchParams.set('part', 'statistics')
  url.searchParams.set('id', channelId)
  url.searchParams.set('key', process.env.YOUTUBE_API_KEY!)
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`YouTube API error: ${res.status}`)
  const data = await res.json() as { items?: Array<{ statistics: { viewCount: string } }> }
  if (!data.items?.length) throw new Error(`Channel not found: ${channelId}`)
  return parseInt(data.items[0].statistics.viewCount, 10)
}

async function fetchViews(today: string, supabase: ReturnType<typeof getSupabase>): Promise<Record<string, string>> {
  const { data: artists, error } = await supabase.from('artists').select('id, name, youtube_channel_id')
  if (error) throw error

  const results: Record<string, string> = {}

  for (const artist of artists ?? []) {
    try {
      const totalViews = await fetchChannelViewCount(artist.youtube_channel_id)

      const { data: prev } = await supabase
        .from('view_snapshots')
        .select('total_views')
        .eq('artist_id', artist.id)
        .lt('snapshot_date', today)
        .order('snapshot_date', { ascending: false })
        .limit(1)
        .maybeSingle()

      const dailyIncrease = prev ? Math.max(totalViews - Number(prev.total_views), 0) : 0

      const { error: upsertErr } = await supabase.from('view_snapshots').upsert(
        { artist_id: artist.id, total_views: totalViews, daily_increase: dailyIncrease, snapshot_date: today },
        { onConflict: 'artist_id,snapshot_date' },
      )
      if (upsertErr) throw upsertErr

      results[artist.name] = `+${dailyIncrease.toLocaleString()} (total: ${totalViews.toLocaleString()})`
    } catch (err) {
      results[artist.name] = `ERROR: ${err}`
    }
  }

  return results
}

// ── calc_index ─────────────────────────────────────────────────────────────────

async function calcIndex(today: string, supabase: ReturnType<typeof getSupabase>): Promise<Record<string, string>> {
  const baselineFrom = new Date(Date.now() - BASELINE_DAYS * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0]

  const { data: artists, error } = await supabase.from('artists').select('id, name, current_index').eq('status', 'active')
  if (error) throw error

  const results: Record<string, string> = {}

  for (const artist of artists ?? []) {
    try {
      const { data: todaySnap } = await supabase
        .from('view_snapshots')
        .select('daily_increase')
        .eq('artist_id', artist.id)
        .eq('snapshot_date', today)
        .maybeSingle()

      if (!todaySnap) { results[artist.name] = 'no snapshot'; continue }

      const d = Number(todaySnap.daily_increase)
      if (d <= 0) { results[artist.name] = 'daily_increase=0, skipped'; continue }

      const { data: history } = await supabase
        .from('view_snapshots')
        .select('daily_increase')
        .eq('artist_id', artist.id)
        .gte('snapshot_date', baselineFrom)
        .lt('snapshot_date', today)
        .gt('daily_increase', 0)

      if (!history?.length) { results[artist.name] = 'no baseline history'; continue }

      const B = history.reduce((s, r) => s + Number(r.daily_increase), 0) / history.length
      const newIndex = Number(artist.current_index) * Math.pow(d / B, K / 365)
      const rounded = Math.round(newIndex * 100) / 100

      await supabase.from('artists').update({ current_index: rounded }).eq('id', artist.id)
      await supabase.from('view_snapshots')
        .update({ index_value: rounded })
        .eq('artist_id', artist.id)
        .eq('snapshot_date', today)

      const pct = ((Math.pow(d / B, K / 365) - 1) * 100).toFixed(3)
      results[artist.name] = `${artist.current_index} → ${rounded} (${Number(pct) >= 0 ? '+' : ''}${pct}%)`
    } catch (err) {
      results[artist.name] = `ERROR: ${err}`
    }
  }

  return results
}

// ── ハンドラ ───────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  // Vercel Cron は Authorization: Bearer <CRON_SECRET> を付与する
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = new Date().toISOString().split('T')[0]
  console.log(`[cron/update] ${today} 開始`)

  const supabase = getSupabase()

  try {
    const fetchResults = await fetchViews(today, supabase)
    const calcResults = await calcIndex(today, supabase)

    console.log('[cron/update] 完了')
    return NextResponse.json({ date: today, fetch: fetchResults, calc: calcResults })
  } catch (err) {
    console.error('[cron/update] エラー:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
