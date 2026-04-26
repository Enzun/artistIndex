/**
 * add_artist.ts
 * アーティストを DB に追加し、初期指数を計算して登録するスクリプト。
 *
 * 使い方:
 *   CHANNEL_ID=UCxxxxxxxx ARTIST_NAME="Mrs. GREEN APPLE" npm run add-artist
 *
 * 初期指数の計算式:
 *   initial_index = sqrt(total_views / 1_000_000) × 10
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// ------------------------------------------------------------------
// YouTube API からチャンネル情報を取得
// ------------------------------------------------------------------
async function fetchChannelInfo(channelId: string) {
  const url = new URL('https://www.googleapis.com/youtube/v3/channels')
  url.searchParams.set('part', 'statistics,snippet')

  // UC... → channel id, それ以外（@handle や handle）→ forHandle で検索
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
      snippet:    { title: string }
      statistics: { viewCount: string; subscriberCount: string }
    }>
  }

  if (!data.items?.length) throw new Error(`Channel not found: ${channelId}`)

  const item = data.items[0]
  return {
    channelTitle: item.snippet.title,
    totalViews:   parseInt(item.statistics.viewCount, 10),
    subscribers:  parseInt(item.statistics.subscriberCount, 10),
  }
}

// ------------------------------------------------------------------
// メイン処理
// ------------------------------------------------------------------
async function main() {
  const channelId  = process.env.CHANNEL_ID
  const artistName = process.env.ARTIST_NAME

  if (!channelId || !artistName) {
    console.error(
      'Usage: CHANNEL_ID=UCxxxxx ARTIST_NAME="アーティスト名" npm run add-artist',
    )
    process.exit(1)
  }

  console.log(`チャンネル情報を取得中: ${channelId}`)
  const info = await fetchChannelInfo(channelId)

  // 初期指数 = sqrt(総再生数[百万]) × 10
  const totalViewsM    = info.totalViews / 1_000_000
  const initialIndex   = Math.round(Math.sqrt(totalViewsM) * 10 * 100) / 100
  const today          = new Date().toISOString().split('T')[0]

  console.log(`\nチャンネル名  : ${info.channelTitle}`)
  console.log(`登録名        : ${artistName}`)
  console.log(`総再生数      : ${info.totalViews.toLocaleString()} (${totalViewsM.toFixed(1)}M)`)
  console.log(`登録者数      : ${info.subscribers.toLocaleString()}`)
  console.log(`初期指数      : ${initialIndex}`)
  console.log(`基準日        : ${today}`)
  console.log()

  // DB に挿入
  const { data: artist, error: insertErr } = await supabase
    .from('artists')
    .insert({
      name:               artistName,
      youtube_channel_id: channelId,
      current_index:      initialIndex,
      initial_index:      initialIndex,
    })
    .select('id')
    .single()

  if (insertErr) throw insertErr

  // 初日のスナップショット（daily_increase は追加初日なので 0）
  const { error: snapErr } = await supabase
    .from('view_snapshots')
    .insert({
      artist_id:      artist.id,
      total_views:    info.totalViews,
      daily_increase: 0,
      index_value:    initialIndex,
      snapshot_date:  today,
    })

  if (snapErr) throw snapErr

  console.log(`✓ 追加完了: ${artistName} (id: ${artist.id})`)
  console.log()
  console.log('次のステップ:')
  console.log('  GitHub Actions が翌日 0:05 JST に最初のデータ取得を実行します。')
  console.log('  手動で即時実行したい場合は GitHub → Actions → Daily Artist Index Update → Run workflow')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
