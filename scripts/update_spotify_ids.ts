import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  const filePath = process.argv[2] || 'data/artists.json'
  const entries = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  let updated = 0
  
  for (const entry of entries) {
    if (entry.spotify_id && entry.channel_id) {
      const { error } = await supabase
        .from('artists')
        .update({ spotify_artist_id: entry.spotify_id })
        .eq('youtube_channel_id', entry.channel_id)
      
      if (error) {
        console.error(`[ERROR] ${entry.name}: ${error.message}`)
      } else {
        console.log(`[OK] Updated ${entry.name} → ${entry.spotify_id}`)
        updated++
      }
    }
  }
  console.log(`\n完了: ${updated} 件の Spotify ID をデータベースに反映しました。`)
}

main().catch(e => console.error(e))
