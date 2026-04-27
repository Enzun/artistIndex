/**
 * add_artist.ts
 * アーティストを DB に追加する。デフォルトは collecting（非公開）モード。
 *
 * 使い方:
 *   npx tsx --env-file=.env scripts/add_artist.ts <channel_id> <artist_name>
 *   npx tsx --env-file=.env scripts/add_artist.ts UCxxxxxxxx "Mrs. GREEN APPLE"
 *
 *   --active を付けると即公開モードで追加（既存アーティスト用）
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

async function fetchChannelInfo(channelId: string) {
  const url = new URL('https://www.googleapis.com/youtube/v3/channels')
  url.searchParams.set('part', 'statistics,snippet')
  if (channelId.startsWith('UC')) {
    url.searchParams.set('id', channelId)
  } else {
    url.searchParams.set('forHandle', channelId.replace(/^@/, ''))
  }
  url.searchParams.set('key', process.env.YOUTUBE_API_KEY!)

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`YouTube API error: ${res.status}`)
  const data = await res.json() as {
    items?: Array<{
      id: string
      snippet:    { title: string }
      statistics: { viewCount: string }
    }>
  }
  if (!data.items?.length) throw new Error(`Channel not found: ${channelId}`)
  const item = data.items[0]
  return {
    resolvedId:  item.id,
    channelTitle: item.snippet.title,
    totalViews:  parseInt(item.statistics.viewCount, 10),
  }
}

async function main() {
  const channelId  = process.argv[2]
  const artistName = process.argv[3]
  const active     = process.argv.includes('--active')

  if (!channelId || !artistName) {
    console.error('Usage: npx tsx --env-file=.env scripts/add_artist.ts <channel_id> <artist_name> [--active]')
    process.exit(1)
  }

  console.log(`チャンネル情報を取得中: ${channelId}`)
  const info = await fetchChannelInfo(channelId)
  const today = new Date().toISOString().split('T')[0]

  console.log(`チャンネル名 : ${info.channelTitle}`)
  console.log(`登録名       : ${artistName}`)
  console.log(`総再生数     : ${info.totalViews.toLocaleString()}`)
  console.log(`モード       : ${active ? 'active（即公開）' : 'collecting（非公開・データ収集のみ）'}`)
  console.log()

  // collecting モードでは initial_index / current_index は 0（未確定）
  const initialIndex = active
    ? Math.round(Math.sqrt(info.totalViews / 1_000_000) * 10 * 100) / 100
    : 0

  const { data: artist, error: insertErr } = await supabase
    .from('artists')
    .insert({
      name:               artistName,
      youtube_channel_id: info.resolvedId,
      current_index:      initialIndex,
      initial_index:      initialIndex,
      status:             active ? 'active' : 'collecting',
      published_at:       active ? new Date().toISOString() : null,
    })
    .select('id')
    .single()

  if (insertErr) throw insertErr

  // 初日スナップショット（daily_increase は 0）
  const { error: snapErr } = await supabase
    .from('view_snapshots')
    .insert({
      artist_id:      artist.id,
      total_views:    info.totalViews,
      daily_increase: 0,
      index_value:    active ? initialIndex : null,
      snapshot_date:  today,
    })

  if (snapErr) throw snapErr

  console.log(`✓ 追加完了: ${artistName} (id: ${artist.id})`)
  if (!active) {
    console.log('  → 公開するときは activate_artist.ts を実行してください')
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
