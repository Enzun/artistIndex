import { createClient } from '@/lib/supabase/server'

type Artist = {
  id: string
  name: string
  status: string
  current_index: number
  youtube_channel_id: string
  created_at: string
}

type SnapshotStat = {
  artist_id: string
  count: number
  last_date: string | null
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
    { data: snapshotStats },
    { data: cronLogs },
  ] = await Promise.all([
    supabase
      .from('artists')
      .select('id, name, status, current_index, youtube_channel_id, created_at')
      .order('status')
      .order('name'),
    supabase
      .from('view_snapshots')
      .select('artist_id, snapshot_date')
      .order('snapshot_date', { ascending: false }),
    supabase
      .from('cron_logs')
      .select('id, job, status, summary, created_at, finished_at')
      .order('created_at', { ascending: false })
      .limit(30),
  ])

  // スナップショット統計をアーティストIDでまとめる
  const statsMap = new Map<string, SnapshotStat>()
  for (const row of (snapshotStats ?? [])) {
    if (!statsMap.has(row.artist_id)) {
      statsMap.set(row.artist_id, { artist_id: row.artist_id, count: 0, last_date: row.snapshot_date })
    }
    statsMap.get(row.artist_id)!.count++
  }

  const artistList = (artists ?? []) as Artist[]
  const logList = (cronLogs ?? []) as CronLog[]

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

      {/* アーティスト一覧 */}
      <h2 className="text-sm font-semibold mb-3">アーティスト一覧</h2>
      <div className="bg-surface border border-border rounded-xl overflow-hidden mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-dim">
              <th className="text-left px-4 py-2.5 font-medium">名前</th>
              <th className="text-left px-4 py-2.5 font-medium">status</th>
              <th className="text-right px-4 py-2.5 font-medium">指数</th>
              <th className="text-right px-4 py-2.5 font-medium">スナップショット</th>
              <th className="text-right px-4 py-2.5 font-medium">最終取得日</th>
              <th className="text-right px-4 py-2.5 font-medium">追加日</th>
            </tr>
          </thead>
          <tbody>
            {artistList.map((artist, i) => {
              const stat = statsMap.get(artist.id)
              return (
                <tr key={artist.id} className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-surface2/50'}`}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <a
                        href={`/admin/artist/${artist.id}`}
                        className="hover:underline font-medium"
                      >
                        {artist.name}
                      </a>
                      <a
                        href={`https://www.youtube.com/channel/${artist.youtube_channel_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-dim hover:text-accent transition-colors flex-shrink-0"
                        title="YouTubeチャンネルを開く"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                        </svg>
                      </a>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      artist.status === 'active'
                        ? 'bg-mga/10 text-mga'
                        : 'bg-surface2 text-dim'
                    }`}>
                      {artist.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {artist.status === 'active' ? Math.floor(artist.current_index).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-dim">
                    {stat ? stat.count.toLocaleString() : 0}
                  </td>
                  <td className="px-4 py-2.5 text-right text-dim">
                    {stat?.last_date ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right text-dim">
                    {artist.created_at.split('T')[0]}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

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
