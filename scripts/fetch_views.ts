/**
 * fetch_views.ts
 * YouTube API からチャンネルの総再生数を取得し view_snapshots に保存する。
 * GitHub Actions から毎日 0:05 JST に実行される。
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// ------------------------------------------------------------------
// YouTube API
// ------------------------------------------------------------------
async function fetchChannelViewCount(channelId: string): Promise<number> {
  const url = new URL('https://www.googleapis.com/youtube/v3/channels')
  url.searchParams.set('part', 'statistics')
  url.searchParams.set('id', channelId)
  url.searchParams.set('key', process.env.YOUTUBE_API_KEY!)

  const res = await fetch(url.toString())
  if (!res.ok) {
    throw new Error(`YouTube API error: ${res.status} ${await res.text()}`)
  }

  const data = await res.json() as {
    items?: Array<{ statistics: { viewCount: string } }>
  }
  if (!data.items?.length) {
    throw new Error(`Channel not found: ${channelId}`)
  }

  return parseInt(data.items[0].statistics.viewCount, 10)
}

// ------------------------------------------------------------------
// メイン処理
// ------------------------------------------------------------------
async function main() {
  const today = new Date().toISOString().split('T')[0]  // "YYYY-MM-DD"
  console.log(`[fetch_views] ${today} 開始`)

  // 全アーティストを取得
  const { data: artists, error: artistsErr } = await supabase
    .from('artists')
    .select('id, name, youtube_channel_id')

  if (artistsErr) throw artistsErr

  for (const artist of artists ?? []) {
    try {
      const totalViews = await fetchChannelViewCount(artist.youtube_channel_id)

      // 前日以前の最新スナップショットを取得（日次増加数の計算に使う）
      const { data: prev } = await supabase
        .from('view_snapshots')
        .select('total_views')
        .eq('artist_id', artist.id)
        .lt('snapshot_date', today)
        .order('snapshot_date', { ascending: false })
        .limit(1)
        .maybeSingle()

      // 前日比（負になった場合 = YouTube が削除した再生数を除外した場合は 0 として扱う）
      const dailyIncrease = prev
        ? Math.max(totalViews - Number(prev.total_views), 0)
        : 0

      const { error: upsertErr } = await supabase
        .from('view_snapshots')
        .upsert(
          {
            artist_id:      artist.id,
            total_views:    totalViews,
            daily_increase: dailyIncrease,
            snapshot_date:  today,
            // index_value は calc_index.ts が後から埋める
          },
          { onConflict: 'artist_id,snapshot_date' },
        )

      if (upsertErr) throw upsertErr

      console.log(
        `  ✓ ${artist.name}: 総再生数=${totalViews.toLocaleString()} ` +
        `(+${dailyIncrease.toLocaleString()})`,
      )
    } catch (err) {
      // 1件失敗しても他のアーティストは継続する
      console.error(`  ✗ ${artist.name}: ${err}`)
    }
  }

  console.log('[fetch_views] 完了')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
