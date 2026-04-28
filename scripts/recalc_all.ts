/**
 * recalc_all.ts
 * 全アーティストの index_value を案B (線形式) で再計算する。
 *
 * 式: index[t+1] = max(0, index[t] × (1 + K/365 × (d/B − 1)))
 *   K = 30, BASELINE = 14 日
 *
 * 開始値は artists.initial_index を使用。
 * view_snapshots.index_value と artists.current_index を上書きする。
 *
 * Usage:
 *   npx ts-node -e "$(cat scripts/recalc_all.ts)"
 *   or: npx tsx scripts/recalc_all.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const K             = 30
const BASELINE_DAYS = 14

async function recalcArtist(artist: { id: string; name: string; initial_index: number }) {
  const { data: snapshots, error } = await supabase
    .from('view_snapshots')
    .select('snapshot_date, daily_increase')
    .eq('artist_id', artist.id)
    .order('snapshot_date', { ascending: true })

  if (error) throw error
  if (!snapshots?.length) {
    console.log(`  - ${artist.name}: スナップショットなし`)
    return
  }

  let currentIndex = artist.initial_index
  const updates: { snapshot_date: string; index_value: number }[] = []

  for (let i = 0; i < snapshots.length; i++) {
    const snap = snapshots[i]
    const d = Number(snap.daily_increase)

    if (d > 0) {
      // 過去 BASELINE_DAYS 日分（当日を除く）
      const histStart = i - BASELINE_DAYS
      const history = snapshots
        .slice(Math.max(0, histStart), i)
        .filter(r => Number(r.daily_increase) > 0)

      if (history.length > 0) {
        const B = history.reduce((s, r) => s + Number(r.daily_increase), 0) / history.length
        currentIndex = Math.max(0, currentIndex * (1 + (K / 365) * (d / B - 1)))
      }
    }

    updates.push({
      snapshot_date: snap.snapshot_date,
      index_value: Math.round(currentIndex * 100) / 100,
    })
  }

  // upsert index_value for each snapshot
  for (const u of updates) {
    const { error: upErr } = await supabase
      .from('view_snapshots')
      .update({ index_value: u.index_value })
      .eq('artist_id', artist.id)
      .eq('snapshot_date', u.snapshot_date)
    if (upErr) throw upErr
  }

  const finalIndex = updates.at(-1)?.index_value ?? artist.initial_index
  const { error: artErr } = await supabase
    .from('artists')
    .update({ current_index: finalIndex })
    .eq('id', artist.id)
  if (artErr) throw artErr

  console.log(`  ✓ ${artist.name}: ${artist.initial_index} → ${finalIndex} (${updates.length}件更新)`)
}

async function main() {
  console.log(`[recalc_all] 開始 (K=${K}, BASELINE=${BASELINE_DAYS}日, 案B線形式)`)

  const { data: artists, error } = await supabase
    .from('artists')
    .select('id, name, initial_index')
    .order('name')

  if (error) throw error

  let ok = 0, skipped = 0, failed = 0
  for (const artist of artists ?? []) {
    try {
      await recalcArtist(artist as { id: string; name: string; initial_index: number })
      ok++
    } catch (err) {
      console.error(`  ✗ ${artist.name}: ${err}`)
      failed++
    }
  }

  console.log(`[recalc_all] 完了 — 成功: ${ok}, スキップ: ${skipped}, エラー: ${failed}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
