/**
 * activate_artist.ts
 * collecting → active に切り替え、指数を初期化する。
 *
 * 使い方:
 *   npx tsx --env-file=.env scripts/activate_artist.ts <artist_id>
 *
 * 実行すると:
 *   - status を 'active' に変更
 *   - published_at を本日にセット
 *   - current_index / initial_index を 100 にセット
 *   - 本日以前のスナップショットの index_value は NULL のまま（チャートは公開日から表示）
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

async function main() {
  const artistId = process.argv[2]

  if (!artistId) {
    // 一覧を表示
    const { data: all } = await supabase
      .from('artists')
      .select('id, name, status')
      .order('status')
    console.log('Usage: npx tsx --env-file=.env scripts/activate_artist.ts <artist_id>\n')
    console.log('登録済みアーティスト:')
    for (const a of all ?? []) {
      console.log(`  [${a.status}]  ${a.id}  ${a.name}`)
    }
    process.exit(0)
  }

  const { data: artist, error } = await supabase
    .from('artists')
    .select('id, name, status')
    .eq('id', artistId)
    .single()

  if (error || !artist) {
    console.error('アーティストが見つかりません:', artistId)
    process.exit(1)
  }

  if (artist.status === 'active') {
    console.log(`${artist.name} はすでに active です`)
    process.exit(0)
  }

  // 最新スナップショットから total_views を取得して指数を計算
  const { data: snap } = await supabase
    .from('view_snapshots')
    .select('total_views')
    .eq('artist_id', artistId)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .single()

  if (!snap) {
    console.error('スナップショットがありません。先に cron を実行してください。')
    process.exit(1)
  }

  const initialIndex = Math.round(Math.sqrt(Number(snap.total_views) / 1_000_000) * 10 * 100) / 100
  const today = new Date().toISOString()

  const { error: updateErr } = await supabase
    .from('artists')
    .update({
      status:        'active',
      published_at:  today,
      current_index: initialIndex,
      initial_index: initialIndex,
    })
    .eq('id', artistId)

  if (updateErr) throw updateErr

  console.log(`✓ ${artist.name} を公開しました`)
  console.log(`  published_at:  ${today.slice(0, 10)}`)
  console.log(`  total_views:   ${Number(snap.total_views).toLocaleString()}`)
  console.log(`  initial_index: ${initialIndex}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
