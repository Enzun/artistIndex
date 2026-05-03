import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

export const maxDuration = 30

const MB_UA = 'artistIndex/1.0 (https://artist-index.vercel.app)'

// ─── MusicBrainz ─────────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[！-～]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/[\s\u3000\-_・]/g, '')
}

async function mbSearch(name: string): Promise<string | null> {
  const url = new URL('https://musicbrainz.org/ws/2/artist/')
  url.searchParams.set('query', `artist:"${name}"`)
  url.searchParams.set('fmt', 'json')
  url.searchParams.set('limit', '5')
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': MB_UA },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) return null
  const data = await res.json() as { artists: Array<{ id: string; name: string }> }
  const artists = data.artists ?? []
  if (!artists.length) return null
  const exact = artists.find(a => normalize(a.name) === normalize(name))
  return (exact ?? artists[0]).id
}

type MBUrls = {
  youtube_channel_id: string | null
  wikipedia_ja:       string | null
  homepage:           string | null
}

async function mbUrls(mbid: string): Promise<MBUrls> {
  const res = await fetch(
    `https://musicbrainz.org/ws/2/artist/${mbid}?inc=url-rels&fmt=json`,
    { headers: { 'User-Agent': MB_UA }, signal: AbortSignal.timeout(8000) }
  )
  const result: MBUrls = { youtube_channel_id: null, wikipedia_ja: null, homepage: null }
  if (!res.ok) return result
  const data = await res.json() as {
    relations: Array<{ type: string; url: { resource: string } }>
  }
  for (const rel of (data.relations ?? [])) {
    const href = rel.url?.resource ?? ''
    if (!result.wikipedia_ja && href.startsWith('https://ja.wikipedia.org/wiki/')) {
      result.wikipedia_ja = decodeURIComponent(
        href.replace('https://ja.wikipedia.org/wiki/', '')
      ).replace(/_/g, ' ')
    } else if (!result.youtube_channel_id && href.includes('youtube.com/channel/')) {
      result.youtube_channel_id = href.split('/channel/')[1]?.split('/')[0] ?? null
    } else if (!result.youtube_channel_id && href.includes('youtube.com/@')) {
      result.youtube_channel_id = href  // ハンドル形式: resolveChannel に渡す
    } else if (!result.homepage && rel.type === 'official homepage') {
      result.homepage = href
    }
  }
  return result
}

// ─── Homepage → YouTube 抽出 ─────────────────────────────────────────────────

async function extractYouTubeFromHomepage(homepageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(homepageUrl, {
      headers: { 'User-Agent': MB_UA },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const html = await res.text()
    const channelMatch = html.match(/youtube\.com\/channel\/(UC[\w-]+)/)
    if (channelMatch) return channelMatch[1]
    const handleMatch = html.match(/youtube\.com\/@([\w.-]+)/)
    if (handleMatch) return `@${handleMatch[1]}`
    return null
  } catch {
    return null
  }
}

// ─── Wikipedia 検索 ──────────────────────────────────────────────────────────

async function searchWikipedia(name: string): Promise<string | null> {
  try {
    const url = new URL('https://ja.wikipedia.org/w/api.php')
    url.searchParams.set('action', 'query')
    url.searchParams.set('list', 'search')
    url.searchParams.set('srsearch', name)
    url.searchParams.set('srnamespace', '0')
    url.searchParams.set('srlimit', '1')
    url.searchParams.set('format', 'json')
    url.searchParams.set('origin', '*')
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': MB_UA },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const data = await res.json() as { query: { search: Array<{ title: string }> } }
    return data.query.search[0]?.title ?? null
  } catch {
    return null
  }
}

// ─── YouTube ─────────────────────────────────────────────────────────────────

async function resolveChannel(channelInput: string) {
  const url = new URL('https://www.googleapis.com/youtube/v3/channels')
  url.searchParams.set('part', 'statistics,snippet')
  if (channelInput.startsWith('UC')) {
    url.searchParams.set('id', channelInput)
  } else {
    url.searchParams.set('forHandle', channelInput.replace(/^@/, ''))
  }
  url.searchParams.set('key', process.env.YOUTUBE_API_KEY!)
  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`YouTube API error: ${res.status}`)
  const data = await res.json() as {
    items?: Array<{
      id: string
      snippet: {
        title: string
        description: string
        thumbnails: { high?: { url: string }; medium?: { url: string }; default?: { url: string } }
      }
      statistics: { viewCount: string }
    }>
  }
  if (!data.items?.length) throw new Error(`チャンネルが見つかりません: ${channelInput}`)
  const item = data.items[0]
  const thumbnails = item.snippet.thumbnails
  return {
    channelId:    item.id,
    channelTitle: item.snippet.title,
    description:  item.snippet.description,
    thumbnailUrl: thumbnails.high?.url ?? thumbnails.medium?.url ?? thumbnails.default?.url ?? null,
    totalViews:   parseInt(item.statistics.viewCount, 10),
  }
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const session = cookieStore.get('admin_session')?.value
  if (!session || session !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { name } = await request.json() as { name?: string }
  if (!name?.trim()) {
    return NextResponse.json({ error: 'アーティスト名は必須です' }, { status: 400 })
  }
  const artistName = name.trim()

  // ── MusicBrainz + Wikipedia 並列検索 ──
  const [mbid, wpTitleDirect] = await Promise.all([
    mbSearch(artistName),
    searchWikipedia(artistName),
  ])

  const urls = mbid ? await mbUrls(mbid) : { youtube_channel_id: null, wikipedia_ja: null, homepage: null }

  // ── YouTube 解決 ──
  let youtubeInput = urls.youtube_channel_id
  if (!youtubeInput && urls.homepage) {
    youtubeInput = await extractYouTubeFromHomepage(urls.homepage)
  }
  if (!youtubeInput) {
    return NextResponse.json(
      { error: `YouTubeチャンネルが見つかりませんでした（MusicBrainz・Homepage未登録）` },
      { status: 404 }
    )
  }

  let channelInfo: Awaited<ReturnType<typeof resolveChannel>>
  try {
    channelInfo = await resolveChannel(youtubeInput)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 })
  }

  // ── 重複チェック ──
  const sb = createAdminClient()
  const { data: existing } = await sb
    .from('artists')
    .select('id, name')
    .eq('youtube_channel_id', channelInfo.channelId)
    .maybeSingle()
  if (existing) {
    return NextResponse.json(
      { error: `登録済みです（${existing.name}）` },
      { status: 409 }
    )
  }

  // ── Wikipedia: MusicBrainz優先、なければ検索結果 ──
  const wikipediaJa = urls.wikipedia_ja ?? wpTitleDirect

  const jstNow = Date.now() + 9 * 60 * 60 * 1000
  const today = new Date(jstNow).toISOString().split('T')[0]

  // ── DB登録 ──
  const indexScale = Math.round(0.0526 * Math.pow(channelInfo.totalViews, 0.468))

  const { data: artist, error: insertErr } = await sb
    .from('artists')
    .insert({
      name:               artistName,
      youtube_channel_id: channelInfo.channelId,
      wikipedia_ja:       wikipediaJa,
      current_index:      0,
      initial_index:      0,
      index_scale:        indexScale,
      status:             'collecting',
      published_at:       null,
      thumbnail_url:      channelInfo.thumbnailUrl,
      description:        channelInfo.description || null,
    })
    .select('id')
    .single()

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  // ── Wikipedia 初日ページビュー ──
  let wikipediaViews: number | null = null
  if (wikipediaJa) {
    try {
      const encoded = encodeURIComponent(wikipediaJa.replace(/ /g, '_'))
      const d = today.replace(/-/g, '')
      const wpRes = await fetch(
        `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/ja.wikipedia.org/all-access/all-agents/${encoded}/daily/${d}/${d}`,
        { headers: { 'User-Agent': MB_UA } }
      )
      if (wpRes.ok) {
        const wpData = await wpRes.json() as { items?: { views: number }[] }
        wikipediaViews = wpData.items?.[0]?.views ?? null
      }
    } catch { /* 無視 */ }
  }

  // ── 初日スナップショット ──
  const snapRow: Record<string, unknown> = {
    artist_id:      artist.id,
    total_views:    channelInfo.totalViews,
    daily_increase: 0,
    index_value:    null,
    snapshot_date:  today,
  }
  if (wikipediaViews !== null) {
    snapRow.wikipedia_pageviews = wikipediaViews
  }

  await sb.from('view_snapshots').insert(snapRow)

  return NextResponse.json({
    ok: true,
    artist: {
      name:         artistName,
      channelTitle: channelInfo.channelTitle,
      youtube:      channelInfo.channelId,
      wikipedia:    wikipediaJa,
    },
  })
}
