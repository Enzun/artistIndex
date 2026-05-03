import { createClient } from '@/lib/supabase/server'
import AdminArtistList from './AdminArtistList'
import AddArtistForm from './AddArtistForm'
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

type CronLog = {
  id: string
  job: string
  status: string
  summary: Record<string, unknown> | null
  created_at: string
  finished_at: string | null
}

export default async function AdminPage() {
  const supabase = await createClient()

  const [
    { data: artists },
    { data: latestSnaps },
    { data: ytIncrSnaps },
    { data: cronLogs },
  ] = await Promise.all([
    supabase
      .from('artists')
      .select('id, name, status, current_index, youtube_channel_id, wikipedia_ja, created_at, thumbnail_url, index_scale')
      .order('status')
      .order('name'),
    // 最新スナップ（wikipedia_null チェック用）
    supabase
      .from('view_snapshots')
      .select('artist_id, snapshot_date, wikipedia_pageviews')
      .order('snapshot_date', { ascending: false })
      .limit(1000),
    // YT更新日: daily_increase > 0 のみ取得
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
  // YT更新日: 各アーティストの最新 daily_increase > 0 の日付
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
  const logList = (cronLogs ?? []) as CronLog[]

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

      {/* アーティスト追加 */}
      <AddArtistForm />

      {/* アーティスト一覧 */}
      <AdminArtistList
        artists={artistList}
        statsMap={Object.fromEntries(statsMap)}
        hIndexMap={hIndexMap}
      />

      {/* Cronログ */}
      <h2 className="text-sm font-semibold mb-3">Cron ログ（直近30件）</h2>
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-dim">
              <th className="text-left px-4 py-2.5 font-medium">job</th>
              <th className="text-left px-4 py-2.5 font-medium">status</th>
              <th className="text-left px-4 py-2.5 font-medium">summary</th>
              <th className="text-right px-4 py-2.5 font-medium">実行日時</th>
            </tr>
          </thead>
          <tbody>
            {logList.map((log, i) => (
              <tr key={log.id} className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-surface2/50'}`}>
                <td className="px-4 py-2.5 font-mono text-xs">{log.job}</td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    log.status === 'success' ? 'bg-mga/10 text-mga'
                    : log.status === 'error' ? 'bg-accent/10 text-accent'
                    : 'bg-surface2 text-dim'
                  }`}>
                    {log.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-xs text-dim font-mono">
                  {log.summary ? JSON.stringify(log.summary) : '—'}
                </td>
                <td className="px-4 py-2.5 text-right text-dim text-xs">
                  {log.created_at.replace('T', ' ').substring(0, 16)}
                </td>
              </tr>
            ))}
            {logList.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-dim text-xs">ログがありません</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
