/**
 * bulk_add_artists.ts
 * JSONファイルからアーティストを一括登録する（collecting モード）。
 * チャンネルIDが無効なものはスキップ。
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/bulk_add_artists.ts <jsonファイル>
 *
 * JSONフォーマット:
 *   [{ "name": "YOASOBI", "channel_id": "UCvP_hWke8f5_9yVvX7T7vLw" }, ...]
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

type ArtistEntry = { name: string; channel_id: string }

type ChannelInfo = {
  resolvedId: string
  totalViews: number
  subscriberCount: number | null  // null = 非公開
}

async function fetchChannelInfo(channelId: string): Promise<ChannelInfo | null> {
  try {
    const url = new URL('https://www.googleapis.com/youtube/v3/channels')
    url.searchParams.set('part', 'statistics')
    url.searchParams.set('id', channelId)
    url.searchParams.set('key', process.env.YOUTUBE_API_KEY!)
    const res = await fetch(url.toString())
    if (!res.ok) return null
    const data = await res.json() as {
      items?: Array<{
        id: string
        statistics: {
          viewCount: string
          subscriberCount?: string
          hiddenSubscriberCount?: boolean
        }
      }>
    }
    if (!data.items?.length) return null
    const stats = data.items[0].statistics
    return {
      resolvedId: data.items[0].id,
      totalViews: parseInt(stats.viewCount, 10),
      subscriberCount: stats.hiddenSubscriberCount || !stats.subscriberCount
        ? null
        : parseInt(stats.subscriberCount, 10),
    }
  } catch {
    return null
  }
}

async function main() {
  const filePath = process.argv[2]
  if (!filePath) {
    console.error('Usage: npx tsx --env-file=.env scripts/bulk_add_artists.ts <jsonファイル>')
    process.exit(1)
  }

  const entries: ArtistEntry[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  console.log(`${entries.length} 件を処理します\n`)

  const today = new Date().toISOString().split('T')[0]

  // 既存のチャンネルIDを取得（重複スキップ用）
  const { data: existing } = await supabase.from('artists').select('youtube_channel_id')
  const existingIds = new Set((existing ?? []).map(a => a.youtube_channel_id))

  const MIN_SUBSCRIBERS = 200_000

  type SkipEntry = { name: string; channel_id: string; reason: string; detail?: string }
  const skipped: SkipEntry[] = []
  const addedList: { name: string; channel_id: string; subscribers: number; totalViews: number }[] = []

  let added = 0, skippedInvalid = 0, skippedDuplicate = 0, skippedSmall = 0, skippedHidden = 0

  for (const entry of entries) {
    const { name, channel_id } = entry

    if (existingIds.has(channel_id)) {
      console.log(`  SKIP (重複)      ${name}`)
      skippedDuplicate++
      continue
    }

    const info = await fetchChannelInfo(channel_id)
    if (!info) {
      console.log(`  SKIP (無効ID)    ${name}  (${channel_id})`)
      skippedInvalid++
      skipped.push({ name, channel_id, reason: '無効ID' })
      continue
    }

    if (info.subscriberCount === null) {
      console.log(`  SKIP (登録者非公開) ${name}  (${channel_id})`)
      skippedHidden++
      skipped.push({ name, channel_id: info.resolvedId, reason: '登録者非公開' })
      continue
    }

    if (info.subscriberCount < MIN_SUBSCRIBERS) {
      console.log(`  SKIP (登録者不足)  ${name}  ${info.subscriberCount.toLocaleString()}人`)
      skippedSmall++
      skipped.push({ name, channel_id: info.resolvedId, reason: '登録者不足', detail: `${info.subscriberCount}人` })
      continue
    }

    const { error } = await supabase.from('artists').insert({
      name,
      youtube_channel_id: info.resolvedId,
      current_index:      0,
      initial_index:      0,
      status:             'collecting',
      published_at:       null,
    })

    if (error) {
      console.log(`  ERROR        ${name}: ${error.message}`)
      continue
    }

    // 初日スナップショット
    const { data: artist } = await supabase
      .from('artists')
      .select('id')
      .eq('youtube_channel_id', info.resolvedId)
      .single()

    if (artist) {
      await supabase.from('view_snapshots').insert({
        artist_id:      artist.id,
        total_views:    info.totalViews,
        daily_increase: 0,
        index_value:    null,
        snapshot_date:  today,
      })
    }

    existingIds.add(info.resolvedId)  // 同一実行内の重複も防ぐ
    console.log(`  OK           ${name}  (登録者 ${info.subscriberCount!.toLocaleString()}人 / ${info.totalViews.toLocaleString()} views)`)
    addedList.push({ name, channel_id: info.resolvedId, subscribers: info.subscriberCount!, totalViews: info.totalViews })
    added++

    // YouTube API のレート制限対策（100 req/100sec）
    await new Promise(r => setTimeout(r, 200))
  }

  console.log(`\n完了: 追加=${added} / 重複=${skippedDuplicate} / 無効ID=${skippedInvalid} / 登録者不足=${skippedSmall} / 登録者非公開=${skippedHidden}`)

  // レポートをファイルに保存
  const jstStr = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const reportPath = `data/bulk_add_report_${jstStr}.json`
  const report = {
    executed_at: new Date().toISOString(),
    input_file: filePath,
    summary: { added, duplicate: skippedDuplicate, invalid_id: skippedInvalid, small_subscribers: skippedSmall, hidden_subscribers: skippedHidden },
    added: addedList,
    skipped,
  }
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8')
  console.log(`レポート: ${reportPath}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
