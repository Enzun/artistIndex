import { createClient } from '@/lib/supabase/server'
import HomeHero from './HomeHero'

export default async function HomePage() {
  const supabase = await createClient()

  const { data: artists } = await supabase
    .from('artists')
    .select('id, name, thumbnail_url, current_index')
    .eq('status', 'active')
    .order('current_index', { ascending: false })

  const list = artists ?? []
  if (!list.length) {
    return (
      <div className="py-20 text-center text-dim text-sm">
        アーティストが登録されていません。
      </div>
    )
  }

  const artistIds = list.map(a => a.id)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000).toISOString().split('T')[0]

  const { data: snapshots } = await supabase
    .from('view_snapshots')
    .select('artist_id, index_value, snapshot_date')
    .in('artist_id', artistIds)
    .gte('snapshot_date', thirtyDaysAgo)
    .not('index_value', 'is', null)
    .order('snapshot_date', { ascending: true })

  const histories: Record<string, number[]> = {}
  for (const snap of snapshots ?? []) {
    if (!histories[snap.artist_id]) histories[snap.artist_id] = []
    histories[snap.artist_id].push(snap.index_value as number)
  }

  return <HomeHero artists={list as { id: string; name: string; thumbnail_url: string | null; current_index: number }[]} histories={histories} />
}
