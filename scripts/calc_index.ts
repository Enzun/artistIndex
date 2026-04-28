/**
 * calc_index.ts
 * 当日の view_snapshots をもとに指数を計算し artists.current_index を更新する。
 * fetch_views.ts の直後に実行される。
 *
 * 式: index[t+1] = max(0, index[t] × (1 + K/365 × (d/B − 1)))  [案B: 線形]
 *   d : 当日の daily_increase
 *   B : 過去 BASELINE_DAYS 日間の daily_increase の平均（動的ベースライン）
 *   K : 感度係数（= 30）
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const K             = 30   // 感度係数
const BASELINE_DAYS = 14   // 動的ベースラインの参照期間（2週間）

// ------------------------------------------------------------------
// メイン処理
// ------------------------------------------------------------------
async function main() {
  const today = new Date().toISOString().split('T')[0]

  // BASELINE_DAYS 日前の日付
  const baselineFrom = new Date(Date.now() - BASELINE_DAYS * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0]

  console.log(`[calc_index] ${today} 開始（ベースライン参照: ${baselineFrom} 以降）`)

  const { data: artists, error: artistsErr } = await supabase
    .from('artists')
    .select('id, name, current_index')

  if (artistsErr) throw artistsErr

  for (const artist of artists ?? []) {
    try {
      // 当日のスナップショットを取得
      const { data: todaySnap } = await supabase
        .from('view_snapshots')
        .select('daily_increase')
        .eq('artist_id', artist.id)
        .eq('snapshot_date', today)
        .maybeSingle()

      if (!todaySnap) {
        console.log(`  - ${artist.name}: 本日のデータなし、スキップ`)
        continue
      }

      const d = Number(todaySnap.daily_increase)

      if (d <= 0) {
        // 再生数が増えていない日は指数を据え置く（API失敗 or 本当に0再生）
        console.log(`  - ${artist.name}: daily_increase = ${d}、指数を据え置き`)
        continue
      }

      // 動的ベースライン B = 過去 BASELINE_DAYS 日間の平均（当日を除く）
      const { data: history, error: histErr } = await supabase
        .from('view_snapshots')
        .select('daily_increase')
        .eq('artist_id', artist.id)
        .gte('snapshot_date', baselineFrom)
        .lt('snapshot_date', today)
        .gt('daily_increase', 0)

      if (histErr) throw histErr

      if (!history?.length) {
        console.log(`  - ${artist.name}: ベースライン算出に必要な履歴なし、スキップ`)
        continue
      }

      const B = history.reduce((sum, row) => sum + Number(row.daily_increase), 0) / history.length
      const newIndex = Math.max(0, Number(artist.current_index) * (1 + (K / 365) * (d / B - 1)))
      const rounded  = Math.round(newIndex * 100) / 100

      // artists.current_index を更新
      const { error: updateArtistErr } = await supabase
        .from('artists')
        .update({ current_index: rounded })
        .eq('id', artist.id)

      if (updateArtistErr) throw updateArtistErr

      // view_snapshots にも index_value を保存（履歴グラフ用）
      const { error: updateSnapErr } = await supabase
        .from('view_snapshots')
        .update({ index_value: rounded })
        .eq('artist_id', artist.id)
        .eq('snapshot_date', today)

      if (updateSnapErr) throw updateSnapErr

      const changePct = ((newIndex / Number(artist.current_index) - 1) * 100).toFixed(3)
      const sign      = Number(changePct) >= 0 ? '+' : ''
      console.log(
        `  ✓ ${artist.name}: ${artist.current_index} → ${rounded} ` +
        `(${sign}${changePct}%)  d=${d.toLocaleString()} B=${Math.round(B).toLocaleString()}`,
      )
    } catch (err) {
      console.error(`  ✗ ${artist.name}: ${err}`)
    }
  }

  console.log('[calc_index] 完了')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
