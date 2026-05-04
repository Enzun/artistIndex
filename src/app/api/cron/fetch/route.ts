/**
 * GET /api/cron/fetch
 * 1. YouTube 総再生数 + Wikipedia ページビューを取得して view_snapshots に upsert
 * 2. fetch 完了後、active アーティストの H 式指数を計算（旧 /api/cron/calc の処理）
 */

import { NextResponse } from 'next/server'
import { verifyCronAuth, getServiceClient } from '../_lib/auth'
import { CronLogger } from '../_lib/logger'
import { calcHIndex, DEFAULT_H_PARAMS, type SnapRow } from '@/lib/indexFormula'
import type { SupabaseClient } from '@supabase/supabase-js'

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

// ─── Wikipedia ───────────────────────────────────────────────────────────────

const WIKI_UA = 'artistIndex-cron/1.0 (https://artist-index.vercel.app/)'

async function fetchWikipediaTop(date: string): Promise<Map<string, number>> {
  type Article = { article: string; views: number }
  const tryDate = async (d: string) => {
    const [year, month, day] = d.split('-')
    const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/top/ja.wikipedia.org/all-access/${year}/${month}/${day}`
    const res = await fetch(url, {
      headers: { 'User-Agent': WIKI_UA },
      signal: AbortSignal.timeout(15000),
    })
    return res
  }

  let res = await tryDate(date)
  if (res.status === 404) {
    const prev = new Date(new Date(date).getTime() - 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0]
    res = await tryDate(prev)
  }
  if (!res.ok) throw new Error(`Wikipedia top error: ${res.status}`)

  const data = await res.json() as { items: [{ articles: Article[] }] }
  const map = new Map<string, number>()
  for (const { article, views } of data.items[0].articles) {
    map.set(article, views)
    map.set(article.replace(/_/g, ' '), views)
  }
  return map
}

async function fetchWikipediaViews(title: string, date: string): Promise<number | null> {
  const encoded = encodeURIComponent(title.replace(/ /g, '_'))
  const d = date.replace(/-/g, '')
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/ja.wikipedia.org/all-access/all-agents/${encoded}/daily/${d}/${d}`
  const res = await fetch(url, {
    headers: { 'User-Agent': WIKI_UA },
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

  let topMap = new Map<string, number>()
  try {
    topMap = await fetchWikipediaTop(date)
  } catch (err) {
    failed.push(`top pages: ${err}`)
  }

  const remaining: string[] = []
  for (const title of titles) {
    const views = topMap.get(title) ?? topMap.get(title.replace(/ /g, '_'))
    if (views !== undefined) {
      found.set(title, views)
    } else {
      remaining.push(title)
    }
  }

  // Step 2: Top 1000外の記事を個別取得（3並列・200ms間隔）
  const CONCURRENCY = 3
  for (let i = 0; i < remaining.length; i += CONCURRENCY) {
    const chunk = remaining.slice(i, i + CONCURRENCY)
    const settled = await Promise.allSettled(chunk.map(t => fetchWikipediaViews(t, date)))
    settled.forEach((r, j) => {
      if (r.status === 'fulfilled') {
        if (r.value !== null) found.set(chunk[j], r.value)
        else notFound.push(chunk[j])
      } else {
        failed.push(`${chunk[j]}: ${r.reason}`)
      }
    })
    if (i + CONCURRENCY < remaining.length) await new Promise(r => setTimeout(r, 200))
  }

  return { found, notFound, failed }
}

// ─── Calc（fetch 完了後に直列実行） ─────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runCalc(sb: SupabaseClient<any, any, any>, today: string): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = { ok: 0, skipped: 0, errors: [] as string[] }

  const { data: artists, error: artistErr } = await sb
    .from('artists')
    .select('id, index_scale')
    .eq('status', 'active')
  if (artistErr) { (result.errors as string[]).push(`calc artists: ${artistErr.message}`); return result }

  const list = artists ?? []
  if (!list.length) return result

  const artistIds = list.map((a: { id: string }) => a.id)

  type RawSnap = SnapRow & { artist_id: string }
  const PAGE_SIZE = 1000
  const allSnaps: RawSnap[] = []
  let offset = 0
  while (true) {
    const { data, error: snapErr } = await sb
      .from('view_snapshots')
      .select('artist_id, snapshot_date, total_views, daily_increase, wikipedia_pageviews')
      .in('artist_id', artistIds)
      .order('artist_id')
      .order('snapshot_date', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)
    if (snapErr) { (result.errors as string[]).push(`calc snaps: ${snapErr.message}`); return result }
    if (!data?.length) break
    allSnaps.push(...(data as RawSnap[]))
    if (data.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  const snapsByArtist = new Map<string, SnapRow[]>()
  for (const snap of allSnaps) {
    if (!snapsByArtist.has(snap.artist_id)) snapsByArtist.set(snap.artist_id, [])
    snapsByArtist.get(snap.artist_id)!.push(snap)
  }

  type ArtistUpdate   = { id: string; current_index: number }
  type SnapshotUpdate = { artist_id: string; snapshot_date: string; index_value: number }
  const artistUpdates:   ArtistUpdate[]   = []
  const snapshotUpdates: SnapshotUpdate[] = []

  for (const artist of list as { id: string; index_scale: number | null }[]) {
    const snaps = snapsByArtist.get(artist.id) ?? []
    if (!snaps.length) { result.skipped = (result.skipped as number) + 1; continue }

    const params = artist.index_scale
      ? { ...DEFAULT_H_PARAMS, SCALE: artist.index_scale }
      : DEFAULT_H_PARAMS

    const newIndex = calcHIndex(snaps, params)
    if (newIndex === null) { result.skipped = (result.skipped as number) + 1; continue }

    const rounded = Math.round(newIndex * 100) / 100
    artistUpdates.push({ id: artist.id, current_index: rounded })
    snapshotUpdates.push({ artist_id: artist.id, snapshot_date: today, index_value: rounded })
    result.ok = (result.ok as number) + 1
  }

  // upsert ではなく update（NOT NULL 制約のある列を省略できないため）
  const artistResults = await Promise.all(
    artistUpdates.map(u => sb.from('artists').update({ current_index: u.current_index }).eq('id', u.id))
  )
  for (const { error: e } of artistResults) {
    if (e) (result.errors as string[]).push(`calc artist update: ${e.message}`)
  }

  const snapResults = await Promise.all(
    snapshotUpdates.map(u =>
      sb.from('view_snapshots')
        .update({ index_value: u.index_value })
        .eq('artist_id', u.artist_id)
        .eq('snapshot_date', u.snapshot_date)
    )
  )
  for (const { error: e } of snapResults) {
    if (e) (result.errors as string[]).push(`calc snapshot update: ${e.message}`)
  }

  return result
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
  const wikiDate = new Date(nowJST - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const summary: Record<string, unknown> = { date: today, ok: 0, error: 0, errors: [] as string[] }

  try {
    const { data: artists, error } = await sb
      .from('artists')
      .select('id, name, youtube_channel_id, wikipedia_ja')
    if (error) throw error

    const list = artists ?? []
    const artistIds = list.map(a => a.id)

    // ── 前日以前の最新スナップ ──
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
    const ytMap = new Map<string, number>()
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

    // ── Wikipedia 取得 ──
    const wikipediaMap = new Map<string, number>()
    const wikiList = list.filter(a => a.wikipedia_ja)

    if (wikiList.length > 0) {
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
    }

    // ── upsert 行を組み立て ──
    type UpsertRow = {
      artist_id: string
      total_views: number
      daily_increase: number
      snapshot_date: string
      wikipedia_pageviews?: number
    }
    const upsertRows: UpsertRow[] = []

    for (const artist of list) {
      const totalViews = ytMap.get(artist.youtube_channel_id)
      if (totalViews === undefined) continue

      const prevViews = prevMap.get(artist.id)
      const dailyIncrease = prevViews !== undefined ? Math.max(totalViews - prevViews, 0) : 0

      const row: UpsertRow = {
        artist_id:      artist.id,
        total_views:    totalViews,
        daily_increase: dailyIncrease,
        snapshot_date:  today,
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

    // ── H 式指数計算（active アーティストのみ） ──
    summary.calc = await runCalc(sb, today)

    await logger.finish('success', summary)
    return NextResponse.json(summary)
  } catch (err) {
    const msg = String(err)
    await logger.finish('error', { ...summary, fatal: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
