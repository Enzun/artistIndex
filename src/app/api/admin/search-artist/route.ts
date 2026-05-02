/**
 * GET /api/admin/search-artist?name=xxx
 * MusicBrainz経由でアーティスト名から Spotify ID・Wikipedia記事名・YouTubeチャンネルIDを検索する。
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export const maxDuration = 30

const MB_UA = 'artistIndex/1.0 (https://artist-index.vercel.app)'

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
  wikipedia_ja: string | null
  youtube_channel_id: string | null
}

async function mbUrls(mbid: string): Promise<MBUrls> {
  const res = await fetch(
    `https://musicbrainz.org/ws/2/artist/${mbid}?inc=url-rels&fmt=json`,
    {
      headers: { 'User-Agent': MB_UA },
      signal: AbortSignal.timeout(8000),
    }
  )
  const result: MBUrls = { wikipedia_ja: null, youtube_channel_id: null }
  if (!res.ok) return result
  const data = await res.json() as { relations: Array<{ url: { resource: string } }> }
  for (const rel of (data.relations ?? [])) {
    const href = rel.url?.resource ?? ''
    if (!result.wikipedia_ja && href.startsWith('https://ja.wikipedia.org/wiki/')) {
      result.wikipedia_ja = decodeURIComponent(
        href.replace('https://ja.wikipedia.org/wiki/', '')
      ).replace(/_/g, ' ')
    } else if (!result.youtube_channel_id && href.includes('youtube.com/channel/')) {
      result.youtube_channel_id = href.split('/channel/')[1]?.split('/')[0] ?? null
    }
  }
  return result
}

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

export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  const session = cookieStore.get('admin_session')?.value
  if (!session || session !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const name = request.nextUrl.searchParams.get('name')?.trim()
  if (!name) return NextResponse.json({ error: '名前が必要です' }, { status: 400 })

  // MusicBrainz（Spotify ID メイン）と Wikipedia 検索を並列実行
  const [mbid, wpTitle] = await Promise.all([
    mbSearch(name),
    searchWikipedia(name),
  ])

  // MusicBrainz url-rels（MBID が取れた場合のみ）
  const urls = mbid ? await mbUrls(mbid) : { wikipedia_ja: null, youtube_channel_id: null }

  // Wikipedia: MusicBrainz にあればそちらを優先（編集者が確認済みのリンク）、なければ検索結果
  const wikipediaTitle = urls.wikipedia_ja ?? wpTitle

  return NextResponse.json({
    wikipedia: wikipediaTitle          ? { title: wikipediaTitle }     : null,
    youtube:   urls.youtube_channel_id ? { id: urls.youtube_channel_id } : null,
  })
}
