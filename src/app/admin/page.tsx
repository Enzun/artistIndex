import { createClient } from '@/lib/supabase/server'
import AdminTabs from './AdminTabs'
import { calcHIndex, DEFAULT_H_PARAMS, type SnapRow } from '@/lib/indexFormula'

type Artist = {
  id: string
  name: string
  status: string
  current_index: number
  youtube_channel_id: string
  wikipedia_ja: string | null
  created_at: string
  thumbnail_url: string | null
  index_scale: number | null
}

type SnapshotStat = {
  artist_id: string
  count: number
  last_yt_increase_date: string | null
  wikipedia_null: boolean
}

export default async function AdminPage() {
  const supabase = await createClient()

  const [
    { data: artists },
    { data: latestSnaps },
    { data: ytIncrSnaps },
    { data: cronLogs },
    { data: titles },
  ] = await Promise.all([
    supabase
      .from('artists')
      .select('id, name, status, current_index, youtube_channel_id, wikipedia_ja, created_at, thumbnail_url, index_scale')
      .order('status')
      .order('name'),
    supabase
      .from('view_snapshots')
      .select('artist_id, snapshot_date, wikipedia_pageviews')
      .order('snapshot_date', { ascending: false })
      .limit(1000),
    supabase
      .from('view_snapshots')
      .select('artist_id, snapshot_date')
      .gt('daily_increase', 0)
      .order('snapshot_date', { ascending: false }),
    supabase
      .from('cron_logs')
      .select('id, job, status, summary, created_at, finished_at')
      .order('created_at', { ascending: false })
      .limit(30),
    supabase
      .from('titles')
      .select('id, points_spent, showcase_order, user_id'),
  ])

  // H式計算用: ページネーションで全スナップ取得
  type RawSnap = SnapRow & { artist_id: string }
  const PAGE_SIZE = 1000
  const allSnaps: RawSnap[] = []
  {
    let offset = 0
    while (true) {
      const { data } = await supabase
        .from('view_snapshots')
        .select('artist_id, snapshot_date, total_views, daily_increase, wikipedia_pageviews')
        .order('artist_id')
        .order('snapshot_date', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1)
      if (!data?.length) break
      allSnaps.push(...(data as RawSnap[]))
      if (data.length < PAGE_SIZE) break
      offset += PAGE_SIZE
    }
  }

  // スナップショット統計をアーティストIDでまとめる
  const statsMap = new Map<string, SnapshotStat>()
  for (const row of (latestSnaps ?? [])) {
    if (!statsMap.has(row.artist_id)) {
      statsMap.set(row.artist_id, {
        artist_id: row.artist_id,
        count: 0,
        last_yt_increase_date: null,
        wikipedia_null: row.wikipedia_pageviews === null,
      })
    }
    statsMap.get(row.artist_id)!.count++
  }
  for (const row of (ytIncrSnaps ?? [])) {
    const stat = statsMap.get(row.artist_id)
    if (stat && stat.last_yt_increase_date === null) {
      stat.last_yt_increase_date = row.snapshot_date
    }
  }

  // H式指数をアーティストごとに計算
  const snapsByArtist = new Map<string, SnapRow[]>()
  for (const row of allSnaps) {
    if (!snapsByArtist.has(row.artist_id)) snapsByArtist.set(row.artist_id, [])
    snapsByArtist.get(row.artist_id)!.push(row)
  }
  const artistList = (artists ?? []) as Artist[]

  const artistScaleMap = new Map<string, number>()
  for (const a of artistList) {
    if (a.index_scale) artistScaleMap.set(a.id, a.index_scale)
  }

  const hIndexMap: Record<string, number | null> = {}
  for (const [artistId, snaps] of snapsByArtist) {
    const scale = artistScaleMap.get(artistId)
    const params = scale ? { ...DEFAULT_H_PARAMS, SCALE: scale } : DEFAULT_H_PARAMS
    hIndexMap[artistId] = calcHIndex(snaps, params)
  }

  const activeCount = artistList.filter(a => a.status === 'active').length
  const collectingCount = artistList.filter(a => a.status === 'collecting').length

  const titleList = (titles ?? []) as { id: string; points_spent: number; showcase_order: number | null; user_id: string }[]
  const titleUserCount = new Set(titleList.map(t => t.user_id)).size

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Admin</h1>
        <form action="/api/admin/logout" method="POST">
          <button type="submit" className="text-xs text-dim hover:text-text transition-colors">
            ログアウト
          </button>
        </form>
      </div>

      {/* サマリー */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <div className="bg-surface border border-border rounded-xl p-4 text-center">
          <p className="text-xs text-dim mb-1">アーティスト総数</p>
          <p className="text-2xl font-bold">{artistList.length}</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4 text-center">
          <p className="text-xs text-dim mb-1">active</p>
          <p className="text-2xl font-bold text-mga">{activeCount}</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4 text-center">
          <p className="text-xs text-dim mb-1">collecting</p>
          <p className="text-2xl font-bold text-dim">{collectingCount}</p>
        </div>
      </div>

      <AdminTabs
        artists={artistList}
        statsMap={Object.fromEntries(statsMap)}
        hIndexMap={hIndexMap}
        cronLogs={cronLogs ?? []}
        titles={titleList}
        titleUserCount={titleUserCount}
      />
    </div>
  )
}
