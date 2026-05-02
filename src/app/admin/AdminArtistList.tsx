'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

type Artist = {
  id: string
  name: string
  status: string
  current_index: number
  youtube_channel_id: string
  wikipedia_ja: string | null
  created_at: string
  thumbnail_url: string | null
}

type SnapshotStat = {
  count: number
  last_yt_increase_date: string | null
  wikipedia_null: boolean
}

type EditingState = { artistId: string; field: 'wikipedia'; value: string }

function WikipediaIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.09 13.119c-.936 1.932-2.217 4.548-2.853 5.728-.616 1.074-1.127.931-1.532.029-1.406-3.321-4.293-9.144-5.651-12.409-.251-.601-.441-.987-.619-1.139-.181-.15-.554-.24-1.122-.271C.103 5.033 0 4.982 0 4.898v-.455l.052-.045c.924-.005 5.401 0 5.401 0l.051.045v.434c0 .119-.075.176-.225.176l-.564.031c-.485.029-.727.164-.727.436 0 .135.053.33.166.601l3.824 9.219c.045-.102 2.685-5.407 2.685-5.407s-.744-1.829-1.192-2.326c-.35-.392-.68-.643-1.093-.803-.454-.164-.875-.192-.875-.192l-.043-.04v-.503l.056-.042c.147 0 4.604.002 4.604.002l.056.042v.468c0 .128-.066.191-.2.191l-.359.019c-.547.029-.82.215-.82.562 0 .136.042.299.124.493l3.869 9.219c1.016-2.246 2.988-6.56 3.404-7.574.253-.605.383-.972.383-1.148 0-.482-.348-.727-1.045-.736l-.537-.019c-.152 0-.229-.064-.229-.191v-.468l.056-.042c1.848 0 3.271.002 3.271.002l.057.042v.453c0 .119-.074.177-.22.177-.704.031-1.072.202-1.405.754-.197.334-2.463 5.455-2.463 5.455l2.913 6.624c1.101-2.275 3.305-6.913 3.756-7.966.254-.606.381-.973.381-1.148 0-.482-.349-.727-1.045-.736l-.536-.019c-.152 0-.23-.064-.23-.191v-.468l.056-.042H24v.453c0 .119-.074.177-.222.177-.703.031-1.116.259-1.448.811l-.087.15c-.048.086-3.877 8.5-5.459 11.844-.44.915-.925 1.067-1.384.171L12.09 13.12z"/>
    </svg>
  )
}

export default function AdminArtistList({
  artists,
  statsMap,
}: {
  artists: Artist[]
  statsMap: Record<string, SnapshotStat>
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<EditingState | null>(null)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const cancelRef = useRef(false)

  const filtered = query.trim()
    ? artists.filter(a => a.name.toLowerCase().includes(query.toLowerCase()))
    : artists

  function startEdit(artistId: string, current: string | null) {
    setEditing({ artistId, field: 'wikipedia', value: current ?? '' })
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  async function handleSave() {
    if (!editing || saving) return
    const artist = artists.find(a => a.id === editing.artistId)
    if (!artist) return

    if (editing.value === (artist.wikipedia_ja ?? '')) { setEditing(null); return }

    setSaving(true)
    await fetch(`/api/admin/artist/${editing.artistId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wikipedia_ja: editing.value || null }),
    })

    setSaving(false)
    setEditing(null)
    router.refresh()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') inputRef.current?.blur()  // blur → onBlur → handleSave（一本化）
    if (e.key === 'Escape') { cancelRef.current = true; setEditing(null) }
  }

  async function handleBlur() {
    if (cancelRef.current) { cancelRef.current = false; return }
    await handleSave()
  }

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
              <th className="text-left px-4 py-2.5 font-medium">Wikipedia</th>
              <th className="text-right px-4 py-2.5 font-medium">YT更新</th>
              <th className="text-right px-4 py-2.5 font-medium">指数</th>
              <th className="text-right px-4 py-2.5 font-medium">スナップ</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((artist, i) => {
              const stat = statsMap[artist.id]
              const isActive = artist.status === 'active'
              const isEditingWiki = editing?.artistId === artist.id && editing.field === 'wikipedia'

              // YT更新日の色分け
              const ytDate = stat?.last_yt_increase_date ?? null
              const ytDaysAgo = ytDate
                ? Math.floor((Date.now() - new Date(ytDate).getTime()) / 86400000)
                : null
              const ytColor = ytDaysAgo === null ? 'text-border'
                : ytDaysAgo <= 7  ? 'text-green-500'
                : ytDaysAgo <= 21 ? 'text-yellow-500'
                : 'text-red-400'
              const ytLabel = ytDate
                ? (() => { const d = new Date(ytDate); return `${d.getMonth()+1}/${d.getDate()}` })()
                : '—'

              return (
                <tr key={artist.id} className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-surface2/50'}`}>
                  {/* 名前列 */}
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${isActive ? 'bg-mga' : 'bg-border'}`}
                        title={artist.status}
                      />
                      {artist.thumbnail_url ? (
                        <Image src={artist.thumbnail_url} alt="" width={24} height={24} className="rounded-full flex-shrink-0" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-border flex-shrink-0" />
                      )}
                      <a href={`/admin/artist/${artist.id}`} className="hover:underline font-medium">
                        {artist.name}
                      </a>
                      <a
                        href={`https://www.youtube.com/channel/${artist.youtube_channel_id}`}
                        target="_blank" rel="noopener noreferrer"
                        className="text-dim hover:text-accent transition-colors flex-shrink-0"
                        title={artist.youtube_channel_id}
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                        </svg>
                      </a>
                    </div>
                  </td>

                  {/* Wikipedia列: アイコン（リンク）+ タイトル（クリックで編集） */}
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <a
                        href={artist.wikipedia_ja ? `https://ja.wikipedia.org/wiki/${encodeURIComponent(artist.wikipedia_ja.replace(/ /g, '_'))}` : '#'}
                        target="_blank" rel="noopener noreferrer"
                        onClick={e => { if (!artist.wikipedia_ja) e.preventDefault() }}
                        className={`flex-shrink-0 transition-colors ${artist.wikipedia_ja ? 'text-dim hover:text-text' : 'text-border cursor-default'}`}
                        title={artist.wikipedia_ja ? 'Wikipediaで開く' : undefined}
                      >
                        <WikipediaIcon />
                      </a>
                      {isEditingWiki ? (
                        <input
                          ref={inputRef}
                          value={editing.value}
                          onChange={e => setEditing({ ...editing, value: e.target.value })}
                          onKeyDown={handleKeyDown}
                          onBlur={handleBlur}
                          disabled={saving}
                          placeholder="Wikipedia記事名"
                          className="text-xs border border-border rounded px-1.5 py-0.5 w-40 focus:outline-none focus:border-dim bg-white"
                        />
                      ) : (
                        <button
                          onClick={() => startEdit(artist.id, artist.wikipedia_ja)}
                          className={`text-xs text-left hover:text-text transition-colors truncate max-w-[10rem] ${stat?.wikipedia_null ? 'text-red-400' : artist.wikipedia_ja ? 'text-dim' : 'text-border'}`}
                          title={artist.wikipedia_ja ?? 'クリックして編集'}
                        >
                          {artist.wikipedia_ja ?? '—'}
                        </button>
                      )}
                    </div>
                  </td>

                  {/* YT更新列: daily_increase>0 だった最終日 */}
                  <td className={`px-4 py-2.5 text-right text-xs tabular-nums ${ytColor}`}
                      title={ytDate ?? 'データなし'}>
                    {ytLabel}
                  </td>

                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {isActive ? Math.floor(artist.current_index).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-dim">
                    {stat ? stat.count.toLocaleString() : 0}
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-dim text-xs">
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
