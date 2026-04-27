/**
 * GET /api/cron/fetch
 * 全アーティストの YouTube 総再生数を取得して view_snapshots に upsert する。
 * YouTube API を 50 件ずつバッチ処理するため、1000 アーティストでも 20 リクエストで済む。
 *
 * 将来的に hourly / per-minute 化する場合はこのエンドポイントの schedule だけ変更する。
 * （calc は引き続き daily で OK）
 */

import { NextResponse } from 'next/server'
import { verifyCronAuth, getServiceClient } from '../_lib/auth'
import { CronLogger } from '../_lib/logger'

export const dynamic = 'force-dynamic'
const BATCH_SIZE = 50  // YouTube channels.list の上限

type YTItem = { id: string; statistics: { viewCount: string } }

async function fetchBatch(channelIds: string[]): Promise<YTItem[]> {
  const url = new URL('https://www.googleapis.com/youtube/v3/channels')
  url.searchParams.set('part', 'statistics')
  url.searchParams.set('id', channelIds.join(','))
  url.searchParams.set('key', process.env.YOUTUBE_API_KEY!)
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`YouTube API error: ${res.status}`)
  const data = await res.json() as { items?: YTItem[] }
  return data.items ?? []
}

export async function GET(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb = getServiceClient()
  const logger = new CronLogger('fetch', sb)
  await logger.start()

  const today = new Date().toISOString().split('T')[0]
  const summary: Record<string, unknown> = { date: today, ok: 0, error: 0, errors: [] as string[] }

  try {
    const { data: artists, error } = await sb
      .from('artists')
      .select('id, name, youtube_channel_id')
    if (error) throw error

    const list = artists ?? []

    // チャンネルID → アーティスト情報のマップ
    const artistMap = new Map(list.map(a => [a.youtube_channel_id, a]))

    // 50 件ずつバッチ処理
    const chunks: string[][] = []
    for (let i = 0; i < list.length; i += BATCH_SIZE) {
      chunks.push(list.slice(i, i + BATCH_SIZE).map(a => a.youtube_channel_id))
    }

    for (const chunk of chunks) {
      let items: YTItem[]
      try {
        items = await fetchBatch(chunk)
      } catch (err) {
        ;(summary.errors as string[]).push(`batch error: ${err}`)
        summary.error = (summary.error as number) + chunk.length
        continue
      }

      for (const item of items) {
        const artist = artistMap.get(item.id)
        if (!artist) continue

        const totalViews = parseInt(item.statistics.viewCount, 10)

        // 前日以前の最新スナップショット（日次増加数の算出用）
        const { data: prev } = await sb
          .from('view_snapshots')
          .select('total_views')
          .eq('artist_id', artist.id)
          .lt('snapshot_date', today)
          .order('snapshot_date', { ascending: false })
          .limit(1)
          .maybeSingle()

        const dailyIncrease = prev ? Math.max(totalViews - Number(prev.total_views), 0) : 0

        const { error: upsertErr } = await sb
          .from('view_snapshots')
          .upsert(
            { artist_id: artist.id, total_views: totalViews, daily_increase: dailyIncrease, snapshot_date: today },
            { onConflict: 'artist_id,snapshot_date' },
          )

        if (upsertErr) {
          ;(summary.errors as string[]).push(`${artist.name}: ${upsertErr.message}`)
          summary.error = (summary.error as number) + 1
        } else {
          summary.ok = (summary.ok as number) + 1
        }
      }
    }

    await logger.finish('success', summary)
    return NextResponse.json(summary)
  } catch (err) {
    const msg = String(err)
    await logger.finish('error', { ...summary, fatal: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
