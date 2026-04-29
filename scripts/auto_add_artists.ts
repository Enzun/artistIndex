/**
 * auto_add_artists.ts
 * アーティスト名リストから YouTube / Spotify / Wikipedia を自動解決して DB に登録する。
 * Admin フォームの「名前だけ入力」と同じロジック。
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/auto_add_artists.ts <ファイル>
 *
 * 入力フォーマット（どちらでも可）:
 *   - テキスト: 1行1アーティスト名
 *   - JSON:     ["アーティスト名", ...] の配列
 *
 * Example:
 *   npx tsx --env-file=.env scripts/auto_add_artists.ts data/names.txt
 *   npx tsx --env-file=.env scripts/auto_add_artists.ts data/names.json
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

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
  const res = await fetch(url.toString(), { headers: { 'User-Agent': MB_UA } })
  if (!res.ok) return null
  const data = await res.json() as { artists: Array<{ id: string; name: string }> }
  const artists = data.artists ?? []
  if (!artists.length) return null
  const exact = artists.find(a => normalize(a.name) === normalize(name))
  return (exact ?? artists[0]).id
}

type MBUrls = {
  youtube_channel_id: string | null
  spotify_id:         string | null
  wikipedia_ja:       string | null
  homepage:           string | null
}

async function mbUrls(mbid: string): Promise<MBUrls> {
  const res = await fetch(
    `https://musicbrainz.org/ws/2/artist/${mbid}?inc=url-rels&fmt=json`,
    { headers: { 'User-Agent': MB_UA } }
  )
  const result: MBUrls = { youtube_channel_id: null, spotify_id: null, wikipedia_ja: null, homepage: null }
  if (!res.ok) return result
  const data = await res.json() as { relations: Array<{ type: string; url: { resource: string } }> }
  for (const rel of (data.relations ?? [])) {
    const href = rel.url?.resource ?? ''
    if (!result.spotify_id && href.startsWith('https://open.spotify.com/artist/')) {
      result.spotify_id = href.split('/').at(-1) ?? null
    } else if (!result.wikipedia_ja && href.startsWith('https://ja.wikipedia.org/wiki/')) {
      result.wikipedia_ja = decodeURIComponent(
        href.replace('https://ja.wikipedia.org/wiki/', '')
      ).replace(/_/g, ' ')
    } else if (!result.youtube_channel_id && href.includes('youtube.com/channel/')) {
      result.youtube_channel_id = href.split('/channel/')[1]?.split('/')[0] ?? null
    } else if (!result.youtube_channel_id && href.includes('youtube.com/@')) {
      result.youtube_channel_id = href
    } else if (!result.homepage && rel.type === 'official homepage') {
      result.homepage = href
    }
  }
  return result
}

// ─── Homepage → YouTube 抽出 ─────────────────────────────────────────────────

async function extractYouTubeFromHomepage(homepageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(homepageUrl, { headers: { 'User-Agent': MB_UA } })
    if (!res.ok) return null
    const html = await res.text()
    const channelMatch = html.match(/youtube\.com\/channel\/(UC[\w-]+)/)
    if (channelMatch) return channelMatch[1]
    const handleMatch = html.match(/youtube\.com\/@([\w.-]+)/)
    if (handleMatch) return `@${handleMatch[1]}`
    return null
  } catch { return null }
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
    const res = await fetch(url.toString(), { headers: { 'User-Agent': MB_UA } })
    if (!res.ok) return null
    const data = await res.json() as { query: { search: Array<{ title: string }> } }
    return data.query.search[0]?.title ?? null
  } catch { return null }
}

// ─── YouTube チャンネル解決 ──────────────────────────────────────────────────

type ChannelInfo = {
  channelId:    string
  channelTitle: string
  description:  string
  thumbnailUrl: string | null
  totalViews:   number
}

async function resolveChannel(channelInput: string): Promise<ChannelInfo | null> {
  try {
    const url = new URL('https://www.googleapis.com/youtube/v3/channels')
    url.searchParams.set('part', 'statistics,snippet')
    if (channelInput.startsWith('UC')) {
      url.searchParams.set('id', channelInput)
    } else {
      url.searchParams.set('forHandle', channelInput.replace(/^@/, ''))
    }
    url.searchParams.set('key', process.env.YOUTUBE_API_KEY!)
    const res = await fetch(url.toString())
    if (!res.ok) return null
    const data = await res.json() as {
      items?: Array<{
        id: string
        snippet: { title: string; description: string; thumbnails: { high?: { url: string }; medium?: { url: string }; default?: { url: string } } }
        statistics: { viewCount: string }
      }>
    }
    if (!data.items?.length) return null
    const item = data.items[0]
    const th = item.snippet.thumbnails
    return {
      channelId:    item.id,
      channelTitle: item.snippet.title,
      description:  item.snippet.description,
      thumbnailUrl: th.high?.url ?? th.medium?.url ?? th.default?.url ?? null,
      totalViews:   parseInt(item.statistics.viewCount, 10),
    }
  } catch { return null }
}

// ─── 1アーティスト処理 ───────────────────────────────────────────────────────

type AddResult =
  | { status: 'ok';        name: string; youtube: string; spotify: string | null; wikipedia: string | null }
  | { status: 'duplicate'; name: string }
  | { status: 'no_youtube'; name: string }
  | { status: 'error';     name: string; reason: string }

async function processArtist(name: string, existingChannelIds: Set<string>): Promise<AddResult> {
  // MusicBrainz + Wikipedia 並列
  const [mbid, wpTitleDirect] = await Promise.all([
    mbSearch(name),
    searchWikipedia(name),
  ])
  // MusicBrainz は 1req/sec なので url-rels は少し待つ
  await sleep(1100)

  const urls = mbid ? await mbUrls(mbid) : { youtube_channel_id: null, spotify_id: null, wikipedia_ja: null, homepage: null }
  if (mbid) await sleep(1100)

  // YouTube 解決
  let youtubeInput = urls.youtube_channel_id
  if (!youtubeInput && urls.homepage) {
    youtubeInput = await extractYouTubeFromHomepage(urls.homepage)
  }
  if (!youtubeInput) return { status: 'no_youtube', name }

  const channelInfo = await resolveChannel(youtubeInput)
  if (!channelInfo) return { status: 'no_youtube', name }

  // 重複チェック
  if (existingChannelIds.has(channelInfo.channelId)) {
    return { status: 'duplicate', name }
  }

  const wikipediaJa = urls.wikipedia_ja ?? wpTitleDirect

  const jstNow = Date.now() + 9 * 60 * 60 * 1000
  const today = new Date(jstNow).toISOString().split('T')[0]

  const { data: artist, error: insertErr } = await supabase
    .from('artists')
    .insert({
      name,
      youtube_channel_id: channelInfo.channelId,
      spotify_artist_id:  urls.spotify_id,
      wikipedia_ja:       wikipediaJa,
      current_index:      0,
      initial_index:      0,
      status:             'collecting',
      published_at:       null,
      thumbnail_url:      channelInfo.thumbnailUrl,
      description:        channelInfo.description || null,
    })
    .select('id')
    .single()

  if (insertErr) return { status: 'error', name, reason: insertErr.message }

  // 初日スナップショット
  await supabase.from('view_snapshots').insert({
    artist_id:      artist.id,
    total_views:    channelInfo.totalViews,
    daily_increase: 0,
    index_value:    null,
    snapshot_date:  today,
  })

  existingChannelIds.add(channelInfo.channelId)
  return { status: 'ok', name, youtube: channelInfo.channelId, spotify: urls.spotify_id, wikipedia: wikipediaJa }
}

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const filePath = process.argv[2]
  if (!filePath) {
    console.error('Usage: npx tsx --env-file=.env scripts/auto_add_artists.ts <ファイル>')
    process.exit(1)
  }

  const raw = fs.readFileSync(filePath, 'utf-8').trim()
  const names: string[] = raw.startsWith('[')
    ? JSON.parse(raw)
    : raw.split('\n').map(l => l.trim()).filter(Boolean)

  console.log(`${names.length} 件を処理します\n`)

  // 既存チャンネルIDを取得
  const { data: existing } = await supabase.from('artists').select('youtube_channel_id')
  const existingChannelIds = new Set((existing ?? []).map(a => a.youtube_channel_id))

  const results: AddResult[] = []

  for (const name of names) {
    const result = await processArtist(name, existingChannelIds)
    results.push(result)

    if (result.status === 'ok') {
      console.log(`  OK         ${name}`)
      console.log(`             YT: ${result.youtube} / SP: ${result.spotify ?? '—'} / WP: ${result.wikipedia ?? '—'}`)
    } else if (result.status === 'duplicate') {
      console.log(`  SKIP (重複) ${name}`)
    } else if (result.status === 'no_youtube') {
      console.log(`  NO YOUTUBE  ${name}`)
    } else {
      console.log(`  ERROR       ${name}: ${result.reason}`)
    }
  }

  const ok        = results.filter(r => r.status === 'ok').length
  const duplicate = results.filter(r => r.status === 'duplicate').length
  const noYoutube = results.filter(r => r.status === 'no_youtube').length
  const errors    = results.filter(r => r.status === 'error').length

  console.log(`\n完了: 追加=${ok} / 重複=${duplicate} / YouTube未解決=${noYoutube} / エラー=${errors}`)

  const failed = results.filter(r => r.status === 'no_youtube' || r.status === 'error')
  if (failed.length > 0) {
    console.log('\n── YouTube未解決・エラー（手動確認） ──')
    for (const r of failed) console.log(`  ${r.name}`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
