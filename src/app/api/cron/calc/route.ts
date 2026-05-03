/**
 * GET /api/cron/calc
 * active アーティストの H 式指数を計算して
 * artists.current_index と view_snapshots.index_value を更新する。
 * fetch の完了後（JST 00:03）に実行すること。
 */

import { NextResponse } from 'next/server'
import { verifyCronAuth, getServiceClient } from '../_lib/auth'
import { CronLogger } from '../_lib/logger'
import { calcHIndex, DEFAULT_H_PARAMS, type SnapRow } from '@/lib/indexFormula'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb = getServiceClient()
  const logger = new CronLogger('calc', sb)
  await logger.start()

  const jstNow = Date.now() + 9 * 60 * 60 * 1000
  const today = new Date(jstNow).toISOString().split('T')[0]

  const summary: Record<string, unknown> = {
    date: today, ok: 0, skipped: 0, error: 0, errors: [] as string[],
  }

  try {
    // ── active アーティスト一覧（index_scale含む） ──
    const { data: artists, error: artistErr } = await sb
      .from('artists')
      .select('id, name, index_scale')
      .eq('status', 'active')
    if (artistErr) throw artistErr

    const list = artists ?? []
    if (!list.length) {
      await logger.finish('success', summary)
      return NextResponse.json(summary)
    }

    const artistIds = list.map(a => a.id)

    // ── 全スナップショットをページネーションで取得 ──
    type RawSnap = SnapRow & { artist_id: string }
    const PAGE_SIZE = 1000
    const allSnaps: RawSnap[] = []
    let offset = 0
    while (true) {
      const { data, error: snapErr } = await sb
        .from('view_snapshots')
        .select('artist_id, snapshot_date, total_views, daily_increase, wikipedia_pageviews')
        .in('artist_id', artistIds)
        .order('artist_id')
        .order('snapshot_date', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1)
      if (snapErr) throw snapErr
      if (!data?.length) break
      allSnaps.push(...(data as RawSnap[]))
      if (data.length < PAGE_SIZE) break
      offset += PAGE_SIZE
    }

    // アーティストごとにグループ化
    const snapsByArtist = new Map<string, SnapRow[]>()
    for (const snap of allSnaps) {
      if (!snapsByArtist.has(snap.artist_id)) snapsByArtist.set(snap.artist_id, [])
      snapsByArtist.get(snap.artist_id)!.push(snap)
    }

    // ── H 式計算 ──
    type ArtistUpdate   = { id: string; current_index: number }
    type SnapshotUpdate = { artist_id: string; snapshot_date: string; index_value: number }
    const artistUpdates:   ArtistUpdate[]   = []
    const snapshotUpdates: SnapshotUpdate[] = []

    for (const artist of list) {
      const snaps = snapsByArtist.get(artist.id) ?? []
      if (!snaps.length) { summary.skipped = (summary.skipped as number) + 1; continue }

      const params = artist.index_scale
        ? { ...DEFAULT_H_PARAMS, SCALE: artist.index_scale }
        : DEFAULT_H_PARAMS

      const newIndex = calcHIndex(snaps, params)
      if (newIndex === null) { summary.skipped = (summary.skipped as number) + 1; continue }

      const rounded = Math.round(newIndex * 100) / 100
      artistUpdates.push({ id: artist.id, current_index: rounded })
      snapshotUpdates.push({ artist_id: artist.id, snapshot_date: today, index_value: rounded })
      summary.ok = (summary.ok as number) + 1
    }

    // ── バッチ更新 ──
    if (artistUpdates.length > 0) {
      const { error: e } = await sb
        .from('artists')
        .upsert(artistUpdates, { onConflict: 'id' })
      if (e) (summary.errors as string[]).push(`artists upsert: ${e.message}`)
    }

    if (snapshotUpdates.length > 0) {
      const { error: e } = await sb
        .from('view_snapshots')
        .upsert(snapshotUpdates, { onConflict: 'artist_id,snapshot_date' })
      if (e) (summary.errors as string[]).push(`snapshots upsert: ${e.message}`)
    }

    await logger.finish('success', summary)
    return NextResponse.json(summary)
  } catch (err) {
    const msg = String(err)
    await logger.finish('error', { ...summary, fatal: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
