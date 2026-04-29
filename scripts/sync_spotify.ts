/**
 * sync_spotify.ts
 * data/artists.json の spotify_id を DB の artists.spotify_artist_id に同期する。
 * spotify_id があるエントリのみ更新（ないものはスキップ）。
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/sync_spotify.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

type ArtistEntry = {
  name: string
  channel_id: string
  spotify_id?: string
}

async function main() {
  const jsonPath = path.resolve(process.cwd(), 'data/artists.json')
  const entries: ArtistEntry[] = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))

  const withSpotify = entries.filter(e => e.spotify_id)
  console.log(`spotify_id あり: ${withSpotify.length} / ${entries.length} 件`)

  let ok = 0, skip = 0, error = 0

  for (const entry of withSpotify) {
    const { data, error: err } = await supabase
      .from('artists')
      .update({ spotify_artist_id: entry.spotify_id })
      .eq('youtube_channel_id', entry.channel_id)
      .select('id, name')
      .maybeSingle()

    if (err) {
      console.error(`✗ ${entry.name}: ${err.message}`)
      error++
    } else if (!data) {
      console.log(`- ${entry.name}: DBに存在しないためスキップ`)
      skip++
    } else {
      console.log(`✓ ${entry.name}: spotify_id = ${entry.spotify_id}`)
      ok++
    }
  }

  console.log(`\n完了: ok=${ok}, skip=${skip}, error=${error}`)
}

main().catch(console.error)
