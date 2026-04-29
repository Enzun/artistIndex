/**
 * fill_spotify_ids.ts
 * MusicBrainz経由で spotify_artist_id が未設定のアーティストを自動補完する。
 * MusicBrainz → MBID取得 → url-rels → Spotify ID 抽出
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/fill_spotify_ids.ts
 *   npx tsx --env-file=.env scripts/fill_spotify_ids.ts --dry-run
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const DRY_RUN = process.argv.includes('--dry-run')
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
  if (!res.ok) {
    console.error(`    [MB search error] status=${res.status}`)
    return null
  }
  const data = await res.json() as { artists: Array<{ id: string; name: string; score: number }> }
  const artists = data.artists ?? []
  if (!artists.length) return null
  const exact = artists.find(a => normalize(a.name) === normalize(name))
  return (exact ?? artists[0]).id
}

type MBUrls = {
  spotify_id?: string
  wikipedia_ja?: string
  youtube_channel_id?: string
}

async function mbUrls(mbid: string): Promise<MBUrls> {
  const res = await fetch(
    `https://musicbrainz.org/ws/2/artist/${mbid}?inc=url-rels&fmt=json`,
    { headers: { 'User-Agent': MB_UA } }
  )
  if (!res.ok) return {}
  const data = await res.json() as { relations: Array<{ url: { resource: string } }> }
  const result: MBUrls = {}
  for (const rel of (data.relations ?? [])) {
    const href = rel.url?.resource ?? ''
    if (href.startsWith('https://open.spotify.com/artist/')) {
      result.spotify_id = href.split('/').at(-1)
    } else if (href.startsWith('https://ja.wikipedia.org/wiki/')) {
      result.wikipedia_ja = decodeURIComponent(
        href.replace('https://ja.wikipedia.org/wiki/', '')
      ).replace(/_/g, ' ')
    } else if (href.includes('youtube.com/channel/')) {
      result.youtube_channel_id = href.split('/channel/')[1]?.split('/')[0]
    }
  }
  return result
}

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (DRY_RUN) console.log('[DRY RUN: DBは更新しません]\n')

  const { data: artists, error } = await supabase
    .from('artists')
    .select('id, name')
    .is('spotify_artist_id', null)
    .order('name')

  if (error) throw error
  if (!artists?.length) { console.log('Spotify未設定のアーティストはいません。'); return }

  console.log(`Spotify未設定: ${artists.length} 件\n`)

  type ReviewEntry = { name: string; spotify_id: string }
  const updated: { name: string; spotify_id: string }[] = []
  const review: ReviewEntry[] = []
  const notFound: string[] = []

  for (const artist of artists) {
    // MusicBrainz は 1req/sec が礼儀
    const mbid = await mbSearch(artist.name)
    await sleep(1100)
    if (!mbid) {
      console.log(`  NOT FOUND  ${artist.name}`)
      notFound.push(artist.name)
      continue
    }

    const urls = await mbUrls(mbid)
    await sleep(1100)

    if (!urls.spotify_id) {
      console.log(`  NO SPOTIFY ${artist.name}  (MBID: ${mbid})`)
      notFound.push(artist.name)
      continue
    }

    if (!DRY_RUN) {
      const { error: upErr } = await supabase
        .from('artists')
        .update({ spotify_artist_id: urls.spotify_id })
        .eq('id', artist.id)
      if (upErr) {
        console.log(`  ERROR      ${artist.name}: ${upErr.message}`)
        continue
      }
    }

    console.log(`  OK         ${artist.name}  →  ${urls.spotify_id}`)
    updated.push({ name: artist.name, spotify_id: urls.spotify_id })
  }

  console.log(`\n完了: 更新=${updated.length} / 未ヒット=${notFound.length}`)

  if (notFound.length > 0) {
    console.log('\n── Spotifyリンクなし / MBに未登録 ──')
    for (const n of notFound) console.log(`  ${n}`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
