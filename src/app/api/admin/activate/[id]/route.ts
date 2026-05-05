import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { calcHIndex, DEFAULT_H_PARAMS, type SnapRow } from '@/lib/indexFormula'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const cookieStore = await cookies()
  const session = cookieStore.get('admin_session')?.value
  if (!session || session !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { id } = await params
  const supabase = createAdminClient()

  const { data: artistData } = await supabase
    .from('artists')
    .select('index_scale')
    .eq('id', id)
    .single()

  if (!artistData?.index_scale) {
    return NextResponse.json({ error: 'index_scale が未設定です' }, { status: 400 })
  }

  const indexScale = artistData.index_scale

  // ── status を active に更新 ──
  const { data: updated, error } = await supabase
    .from('artists')
    .update({
      status: 'active',
      current_index: indexScale,
      initial_index: indexScale,
      published_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'collecting')
    .select('id')

  if (error) {
    return NextResponse.json({ error: '更新に失敗しました: ' + error.message }, { status: 500 })
  }
  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: 'ステータスが collecting ではありません（既に公開済み、または別のステータスです）' }, { status: 400 })
  }

  // ── 過去スナップショットの index_value を全件バックフィル ──
  const { data: snaps } = await supabase
    .from('view_snapshots')
    .select('snapshot_date, total_views, daily_increase, wikipedia_pageviews')
    .eq('artist_id', id)
    .order('snapshot_date', { ascending: true })

  const snapList = (snaps ?? []) as SnapRow[]
  const params_h = { ...DEFAULT_H_PARAMS, SCALE: indexScale }

  type IndexUpdate = {
    artist_id: string
    snapshot_date: string
    total_views: number
    daily_increase: number
    wikipedia_pageviews?: number
    index_value: number
  }
  const updates: IndexUpdate[] = []

  for (let i = 0; i < snapList.length; i++) {
    const hIdx = calcHIndex(snapList.slice(0, i + 1), params_h)
    if (hIdx === null) continue
    const snap = snapList[i]
    updates.push({
      artist_id: id,
      snapshot_date: snap.snapshot_date,
      total_views: snap.total_views ?? 0,
      daily_increase: snap.daily_increase ?? 0,
      ...(snap.wikipedia_pageviews != null ? { wikipedia_pageviews: snap.wikipedia_pageviews } : {}),
      index_value: Math.round(hIdx * 100) / 100,
    })
  }

  // バッチ upsert（100件ずつ）
  const CHUNK = 100
  for (let i = 0; i < updates.length; i += CHUNK) {
    await supabase
      .from('view_snapshots')
      .upsert(updates.slice(i, i + CHUNK), { onConflict: 'artist_id,snapshot_date' })
  }

  // current_index を最新 H 式指数に更新（index_scale ではなく計算値）
  const latestIndex = updates.at(-1)?.index_value ?? indexScale
  await supabase
    .from('artists')
    .update({ current_index: latestIndex })
    .eq('id', id)

  return NextResponse.json({
    ok: true,
    initial_index: indexScale,
    current_index: latestIndex,
    backfilled_snaps: updates.length,
  })
}
