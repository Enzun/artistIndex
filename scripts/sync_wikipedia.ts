/**
 * sync_wikipedia.ts
 * data/artists.json の wikipedia_ja を DB の artists.wikipedia_ja に同期する。
 * wikipedia_ja があるエントリのみ更新（ないものはスキップ）。
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/sync_wikipedia.ts
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
  wikipedia_ja?: string
}

async function main() {
  const jsonPath = path.resolve(process.cwd(), 'data/artists.json')
  const entries: ArtistEntry[] = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))

  const withWiki = entries.filter(e => e.wikipedia_ja)
  console.log(`wikipedia_ja あり: ${withWiki.length} / ${entries.length} 件`)

  let ok = 0, skip = 0, error = 0

  for (const entry of withWiki) {
    const { data, error: err } = await supabase
      .from('artists')
      .update({ wikipedia_ja: entry.wikipedia_ja })
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
      console.log(`✓ ${entry.name}: wikipedia_ja = ${entry.wikipedia_ja}`)
      ok++
    }
  }

  console.log(`\n完了: ok=${ok}, skip=${skip}, error=${error}`)
}

main().catch(console.error)
