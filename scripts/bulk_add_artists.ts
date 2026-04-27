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

async function fetchTotalViews(channelId: string): Promise<{ resolvedId: string; totalViews: number } | null> {
  try {
    const url = new URL('https://www.googleapis.com/youtube/v3/channels')
    url.searchParams.set('part', 'statistics')
    url.searchParams.set('id', channelId)
    url.searchParams.set('key', process.env.YOUTUBE_API_KEY!)
    const res = await fetch(url.toString())
    if (!res.ok) return null
    const data = await res.json() as { items?: Array<{ id: string; statistics: { viewCount: string } }> }
    if (!data.items?.length) return null
    return {
      resolvedId: data.items[0].id,
      totalViews: parseInt(data.items[0].statistics.viewCount, 10),
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

  let added = 0, skippedInvalid = 0, skippedDuplicate = 0

  for (const entry of entries) {
    const { name, channel_id } = entry

    if (existingIds.has(channel_id)) {
      console.log(`  SKIP (重複)  ${name}`)
      skippedDuplicate++
      continue
    }

    const info = await fetchTotalViews(channel_id)
    if (!info) {
      console.log(`  SKIP (無効)  ${name}  (${channel_id})`)
      skippedInvalid++
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

    console.log(`  OK           ${name}  (${info.totalViews.toLocaleString()} views)`)
    added++

    // YouTube API のレート制限対策（100 req/100sec）
    await new Promise(r => setTimeout(r, 200))
  }

  console.log(`\n完了: 追加=${added} / 無効スキップ=${skippedInvalid} / 重複スキップ=${skippedDuplicate}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
