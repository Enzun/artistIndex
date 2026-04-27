/**
 * GET /api/cron/fetch
 * 全アーティストの YouTube 総再生数を取得して view_snapshots に upsert する。
 * YouTube API を 50 件ずつバッチ処理するため、1000 アーティストでも 20 リクエストで済む。
 *
 * 将来的に hourly / per-minute 化する場合はこのエンドポイントの schedule だけ変更する。
 * （calc は引き続き daily で OK）
 */

import { NextResponse } from 'next/server'
import { verifyCronAuth, getServiceClient } from '../_lib/auth'
import { CronLogger } from '../_lib/logger'

export const dynamic = 'force-dynamic'
export const maxDuration = 60  // Hobby プラン上限

const BATCH_SIZE = 50  // YouTube channels.list の上限

type YTItem = { id: string; statistics: { viewCount: string } }

async function fetchBatch(channelIds: string[]): Promise<YTItem[]> {
  const url = new URL('https://www.googleapis.com/youtube/v3/channels')
  url.searchParams.set('part', 'statistics')
  url.searchParams.set('id', channelIds.join(','))
  url.searchParams.set('key', process.env.YOUTUBE_API_KEY!)
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`YouTube API error: ${res.status}`)
  const data = await res.json() as { items?: YTItem[] }
  return data.items ?? []
}

export async function GET(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb = getServiceClient()
  const logger = new CronLogger('fetch', sb)
  await logger.start()

  const today = new Date().toISOString().split('T')[0]
  const summary: Record<string, unknown> = { date: today, ok: 0, error: 0, errors: [] as string[] }

  try {
    const { data: artists, error } = await sb
      .from('artists')
      .select('id, name, youtube_channel_id')
    if (error) throw error

    const list = artists ?? []

    // チャンネルID → アーティスト情報のマップ
    const artistMap = new Map(list.map(a => [a.youtube_channel_id, a]))

    // 全アーティストの前日以前の最新スナップショットを一括取得
    const artistIds = list.map(a => a.id)
    const { data: prevSnaps } = await sb
      .from('view_snapshots')
      .select('artist_id, total_views, snapshot_date')
      .in('artist_id', artistIds)
      .lt('snapshot_date', today)
      .order('snapshot_date', { ascending: false })

    // アーティストIDごとに最新1件だけ残す
    const prevMap = new Map<string, number>()
    for (const snap of (prevSnaps ?? [])) {
      if (!prevMap.has(snap.artist_id)) {
        prevMap.set(snap.artist_id, Number(snap.total_views))
      }
    }

    // 50 件ずつバッチ処理
    const chunks: string[][] = []
    for (let i = 0; i < list.length; i += BATCH_SIZE) {
      chunks.push(list.slice(i, i + BATCH_SIZE).map(a => a.youtube_channel_id))
    }

    // upsert データをまとめて一括投入
    const upsertRows: { artist_id: string; total_views: number; daily_increase: number; snapshot_date: string }[] = []

    for (const chunk of chunks) {
      let items: YTItem[]
      try {
        items = await fetchBatch(chunk)
      } catch (err) {
        ;(summary.errors as string[]).push(`batch error: ${err}`)
        summary.error = (summary.error as number) + chunk.length
        continue
      }

      for (const item of items) {
        const artist = artistMap.get(item.id)
        if (!artist) continue

        const totalViews = parseInt(item.statistics.viewCount, 10)
        const prevViews = prevMap.get(artist.id)
        const dailyIncrease = prevViews !== undefined ? Math.max(totalViews - prevViews, 0) : 0

        upsertRows.push({ artist_id: artist.id, total_views: totalViews, daily_increase: dailyIncrease, snapshot_date: today })
      }
    }

    // 一括 upsert
    if (upsertRows.length > 0) {
      const { error: upsertErr } = await sb
        .from('view_snapshots')
        .upsert(upsertRows, { onConflict: 'artist_id,snapshot_date' })

      if (upsertErr) {
        ;(summary.errors as string[]).push(`upsert error: ${upsertErr.message}`)
        summary.error = upsertRows.length
      } else {
        summary.ok = upsertRows.length
      }
    }

    await logger.finish('success', summary)
    return NextResponse.json(summary)
  } catch (err) {
    const msg = String(err)
    await logger.finish('error', { ...summary, fatal: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
