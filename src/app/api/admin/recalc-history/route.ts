/**
 * POST /api/admin/recalc-history
 * 全アーティストの view_snapshots.index_value を H 式で一括再計算する。
 * artists.current_index (active のみ) も更新する。
 * 一回限りのバックフィル用エンドポイント。
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { calcHIndex, DEFAULT_H_PARAMS, type SnapRow } from '@/lib/indexFormula'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const session = cookieStore.get('admin_session')?.value
  if (!session || session !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const sb = createAdminClient()

  // 全アーティスト（index_scale + status）
  const { data: artists, error: artistErr } = await sb
    .from('artists')
    .select('id, index_scale, status')
  if (artistErr) return NextResponse.json({ error: artistErr.message }, { status: 500 })

  const artistIds = (artists ?? []).map(a => a.id)
  const scaleMap  = new Map((artists ?? []).map(a => [a.id, a.index_scale as number | null]))
  const statusMap = new Map((artists ?? []).map(a => [a.id, a.status as string]))

  // 全スナップショット一括取得
  const { data: allSnaps, error: snapErr } = await sb
    .from('view_snapshots')
    .select('artist_id, snapshot_date, total_views, daily_increase, wikipedia_pageviews')
    .in('artist_id', artistIds)
    .order('artist_id')
    .order('snapshot_date', { ascending: true })
    .limit(100000)
  if (snapErr) return NextResponse.json({ error: snapErr.message }, { status: 500 })

  // アーティストごとにグループ化
  const snapsByArtist = new Map<string, SnapRow[]>()
  for (const snap of allSnaps ?? []) {
    if (!snapsByArtist.has(snap.artist_id)) snapsByArtist.set(snap.artist_id, [])
    snapsByArtist.get(snap.artist_id)!.push(snap as SnapRow)
  }

  // H 式で時系列を再計算
  type SnapUpdate    = { artist_id: string; snapshot_date: string; index_value: number; total_views: number; daily_increase: number }
  type ArtistUpdate  = { id: string; current_index: number }
  const snapUpdates:   SnapUpdate[]   = []
  const artistUpdates: ArtistUpdate[] = []

  for (const [artistId, snaps] of snapsByArtist) {
    const scale = scaleMap.get(artistId) ?? null
    const params = scale ? { ...DEFAULT_H_PARAMS, SCALE: scale } : DEFAULT_H_PARAMS

    let lastVal: number | null = null
    for (let i = 0; i < snaps.length; i++) {
      const val = calcHIndex(snaps.slice(0, i + 1), params)
      if (val !== null) {
        snapUpdates.push({
          artist_id:      artistId,
          snapshot_date:  snaps[i].snapshot_date,
          index_value:    Math.round(val * 100) / 100,
          total_views:    snaps[i].total_views,
          daily_increase: snaps[i].daily_increase,
        })
        lastVal = val
      }
    }

    if (lastVal !== null && statusMap.get(artistId) === 'active') {
      artistUpdates.push({ id: artistId, current_index: Math.round(lastVal * 100) / 100 })
    }
  }

  // バッチ upsert（1000 件ずつ）
  const CHUNK = 1000
  let snapDone = 0
  for (let i = 0; i < snapUpdates.length; i += CHUNK) {
    const { error } = await sb
      .from('view_snapshots')
      .upsert(snapUpdates.slice(i, i + CHUNK), { onConflict: 'artist_id,snapshot_date' })
    if (error) return NextResponse.json({ error: `snap upsert: ${error.message}` }, { status: 500 })
    snapDone += Math.min(CHUNK, snapUpdates.length - i)
  }

  if (artistUpdates.length > 0) {
    const { error } = await sb
      .from('artists')
      .upsert(artistUpdates, { onConflict: 'id' })
    if (error) return NextResponse.json({ error: `artist upsert: ${error.message}` }, { status: 500 })
  }

  return NextResponse.json({
    ok:              true,
    artists:         snapsByArtist.size,
    snapshots:       snapDone,
    artists_updated: artistUpdates.length,
  })
}
