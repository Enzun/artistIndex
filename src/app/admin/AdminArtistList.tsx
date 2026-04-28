'use client'

import { useState } from 'react'

type Artist = {
  id: string
  name: string
  status: string
  current_index: number
  youtube_channel_id: string
  created_at: string
}

type SnapshotStat = {
  count: number
  last_date: string | null
}

export default function AdminArtistList({
  artists,
  statsMap,
}: {
  artists: Artist[]
  statsMap: Record<string, SnapshotStat>
}) {
  const [query, setQuery] = useState('')

  const filtered = query.trim()
    ? artists.filter(a => a.name.toLowerCase().includes(query.toLowerCase()))
    : artists

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">アーティスト一覧</h2>
        <input
          type="text"
          placeholder="名前で検索..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="bg-white border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-dim transition-colors w-48"
        />
      </div>
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
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
            {filtered.map((artist, i) => {
              const stat = statsMap[artist.id]
              return (
                <tr key={artist.id} className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-surface2/50'}`}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <a href={`/admin/artist/${artist.id}`} className="hover:underline font-medium">
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
                      artist.status === 'active' ? 'bg-mga/10 text-mga' : 'bg-surface2 text-dim'
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
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-dim text-xs">
                  「{query}」に一致するアーティストはいません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
