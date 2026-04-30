/**
 * GET /api/cron/fetch
 * YouTube 総再生数 + Spotify popularity/followers を取得して view_snapshots に upsert する。
 * YouTube: channels.list を 50 件バッチ
 * Spotify: /v1/artists を 50 件バッチ（spotify_artist_id がある場合のみ）
 */

import { NextResponse } from 'next/server'
import { verifyCronAuth, getServiceClient } from '../_lib/auth'
import { CronLogger } from '../_lib/logger'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const BATCH_SIZE = 50

// ─── YouTube ────────────────────────────────────────────────────────────────

type YTItem = {
  id: string
  statistics: { viewCount: string }
}

async function fetchYoutubeBatch(channelIds: string[]): Promise<YTItem[]> {
  const url = new URL('https://www.googleapis.com/youtube/v3/channels')
  url.searchParams.set('part', 'statistics')
  url.searchParams.set('id', channelIds.join(','))
  url.searchParams.set('key', process.env.YOUTUBE_API_KEY!)
  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(20000) })
  if (!res.ok) throw new Error(`YouTube API error: ${res.status}`)
  const data = await res.json() as { items?: YTItem[] }
  return data.items ?? []
}

// ─── Spotify ─────────────────────────────────────────────────────────────────

type SpotifyArtist = {
  id: string
  popularity: number
  followers: { total: number }
}

async function getSpotifyToken(): Promise<string> {
  const creds = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString('base64')
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`Spotify auth error: ${res.status}`)
  const data = await res.json() as { access_token: string }
  return data.access_token
}

async function fetchSpotifyBatch(ids: string[], token: string): Promise<SpotifyArtist[]> {
  const url = new URL('https://api.spotify.com/v1/artists')
  url.searchParams.set('ids', ids.join(','))
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`Spotify API error: ${res.status}`)
  const data = await res.json() as { artists: SpotifyArtist[] }
  return (data.artists ?? []).filter(Boolean)
}

// ─── Wikipedia ───────────────────────────────────────────────────────────────

async function fetchWikipediaViews(title: string, date: string): Promise<number | null> {
  const encoded = encodeURIComponent(title.replace(/ /g, '_'))
  const d = date.replace(/-/g, '')
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/ja.wikipedia.org/all-access/all-agents/${encoded}/daily/${d}/${d}`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'artistIndex-cron/1.0' },
    signal: AbortSignal.timeout(10000),
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Wikipedia API error: ${res.status} for ${title}`)
  const data = await res.json() as { items?: { views: number }[] }
  return data.items?.[0]?.views ?? null
}

async function fetchWikipediaBatch(titles: string[], date: string): Promise<{
  found: Map<string, number>
  notFound: string[]
  failed: string[]
}> {
  const found = new Map<string, number>()
  const notFound: string[] = []
  const failed: string[] = []
  const CONCURRENCY = 20
  for (let i = 0; i < titles.length; i += CONCURRENCY) {
    const chunk = titles.slice(i, i + CONCURRENCY)
    const settled = await Promise.allSettled(chunk.map(t => fetchWikipediaViews(t, date)))
    settled.forEach((r, j) => {
      if (r.status === 'fulfilled') {
        if (r.value !== null) found.set(chunk[j], r.value)
        else notFound.push(chunk[j])
      } else {
        failed.push(`${chunk[j]}: ${r.reason}`)
      }
    })
  }
  return { found, notFound, failed }
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb = getServiceClient()
  const logger = new CronLogger('fetch', sb)
  await logger.start()

  const nowJST = Date.now() + 9 * 60 * 60 * 1000
  const today = new Date(nowJST).toISOString().split('T')[0]
  // Wikimedia pageview API has ~1 day lag; fetch yesterday's data
  const wikiDate = new Date(nowJST - 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const summary: Record<string, unknown> = { date: today, ok: 0, error: 0, errors: [] as string[] }

  try {
    const { data: artists, error } = await sb
      .from('artists')
      .select('id, name, youtube_channel_id, spotify_artist_id, wikipedia_ja')
    if (error) throw error

    const list = artists ?? []

    // ── 前日以前の最新 YouTube スナップショットを一括取得 ──
    const artistIds = list.map(a => a.id)
    const { data: prevSnaps } = await sb
      .from('view_snapshots')
      .select('artist_id, total_views, snapshot_date')
      .in('artist_id', artistIds)
      .lt('snapshot_date', today)
      .order('snapshot_date', { ascending: false })

    const prevMap = new Map<string, number>()
    for (const snap of (prevSnaps ?? [])) {
      if (!prevMap.has(snap.artist_id)) {
        prevMap.set(snap.artist_id, Number(snap.total_views))
      }
    }

    // ── YouTube バッチ取得 ──
    const ytMap = new Map<string, number>()  // channelId → totalViews
    const ytArtistMap = new Map(list.map(a => [a.youtube_channel_id, a]))
    const ytChunks: string[][] = []
    for (let i = 0; i < list.length; i += BATCH_SIZE) {
      ytChunks.push(list.slice(i, i + BATCH_SIZE).map(a => a.youtube_channel_id))
    }
    for (const chunk of ytChunks) {
      try {
        const items = await fetchYoutubeBatch(chunk)
        for (const item of items) {
          ytMap.set(item.id, parseInt(item.statistics.viewCount, 10))
        }
      } catch (err) {
        ;(summary.errors as string[]).push(`YouTube batch error: ${err}`)
        summary.error = (summary.error as number) + chunk.length
      }
    }

    // ── Spotify + Wikipedia を並列取得 ──
    const spotifyMap = new Map<string, { popularity: number; followers: number }>()
    const wikipediaMap = new Map<string, number>()

    const spotifyList = list.filter(a => a.spotify_artist_id)
    const wikiList = list.filter(a => a.wikipedia_ja)

    await Promise.all([
      // Spotify
      (async () => {
        if (spotifyList.length === 0) return
        summary.spotify_attempted = spotifyList.length
        try {
          const token = await getSpotifyToken()
          const spChunks: string[][] = []
          for (let i = 0; i < spotifyList.length; i += BATCH_SIZE) {
            spChunks.push(spotifyList.slice(i, i + BATCH_SIZE).map(a => a.spotify_artist_id!))
          }
          for (const chunk of spChunks) {
            try {
              const items = await fetchSpotifyBatch(chunk, token)
              for (const item of items) {
                spotifyMap.set(item.id, { popularity: item.popularity, followers: item.followers.total })
              }
            } catch (err) {
              ;(summary.errors as string[]).push(`Spotify batch error: ${err}`)
            }
          }
          summary.spotify_ok = spotifyMap.size
        } catch (err) {
          ;(summary.errors as string[]).push(`Spotify auth error: ${err}`)
        }
      })(),
      // Wikipedia（前日のデータを取得）
      (async () => {
        if (wikiList.length === 0) return
        try {
          const titles = wikiList.map(a => a.wikipedia_ja!)
          const { found, notFound, failed } = await fetchWikipediaBatch(titles, wikiDate)
          for (const [title, views] of found) {
            wikipediaMap.set(title, views)
          }
          summary.wikipedia_date = wikiDate
          summary.wikipedia_ok = found.size
          summary.wikipedia_not_found = notFound.length
          summary.wikipedia_failed = failed.length
          if (notFound.length > 0) summary.wikipedia_not_found_sample = notFound.slice(0, 5)
          if (failed.length > 0) {
            for (const e of failed) (summary.errors as string[]).push(`Wikipedia fetch error: ${e}`)
          }
        } catch (err) {
          ;(summary.errors as string[]).push(`Wikipedia batch error: ${err}`)
        }
      })(),
    ])

    // ── upsert 行を組み立て ──
    type UpsertRow = {
      artist_id: string
      total_views: number
      daily_increase: number
      snapshot_date: string
      spotify_popularity?: number
      spotify_followers?: number
      wikipedia_pageviews?: number
    }
    const upsertRows: UpsertRow[] = []

    for (const artist of list) {
      const totalViews = ytMap.get(artist.youtube_channel_id)
      if (totalViews === undefined) continue  // YouTube 取得失敗はスキップ

      const prevViews = prevMap.get(artist.id)
      const dailyIncrease = prevViews !== undefined ? Math.max(totalViews - prevViews, 0) : 0

      const row: UpsertRow = {
        artist_id:      artist.id,
        total_views:    totalViews,
        daily_increase: dailyIncrease,
        snapshot_date:  today,
      }

      if (artist.spotify_artist_id) {
        const sp = spotifyMap.get(artist.spotify_artist_id)
        if (sp) {
          row.spotify_popularity = sp.popularity
          row.spotify_followers  = sp.followers
        }
      }

      if (artist.wikipedia_ja) {
        const wp = wikipediaMap.get(artist.wikipedia_ja)
        if (wp !== undefined) row.wikipedia_pageviews = wp
      }

      upsertRows.push(row)
    }

    // ── 一括 upsert ──
    if (upsertRows.length > 0) {
      const { error: upsertErr } = await sb
        .from('view_snapshots')
        .upsert(upsertRows, { onConflict: 'artist_id,snapshot_date' })

      if (upsertErr) {
        ;(summary.errors as string[]).push(`upsert error: ${upsertErr.message}`)
        summary.error = upsertRows.length
      } else {
        summary.ok = upsertRows.length
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
