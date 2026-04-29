'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AddArtistForm() {
  const [name, setName] = useState('')
  const [channelInput, setChannelInput] = useState('')
  const [spotifyId, setSpotifyId] = useState('')
  const [spotifyName, setSpotifyName] = useState<string | null>(null)
  const [wikipediaJa, setWikipediaJa] = useState('')
  const [searching, setSearching] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ ok: true; artistName: string; channelTitle: string } | { ok: false; error: string } | null>(null)
  const router = useRouter()

  async function handleSearch() {
    if (!name.trim()) return
    setSearching(true)
    setSpotifyName(null)
    try {
      const res = await fetch(`/api/admin/search-artist?name=${encodeURIComponent(name.trim())}`)
      const data = await res.json() as {
        spotify:   { id: string } | null
        wikipedia: { title: string } | null
        youtube:   { id: string } | null
      }
          if (data.spotify)   { setSpotifyId(data.spotify.id); setSpotifyName('MusicBrainz') }
      if (data.wikipedia) { setWikipediaJa(data.wikipedia.title) }
      if (data.youtube && !channelInput.trim()) { setChannelInput(data.youtube.id) }
    } catch { /* ignore */ }
    setSearching(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setResult(null)

    const res = await fetch('/api/admin/artist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        channelInput,
        spotifyId: spotifyId.trim() || null,
        wikipediaJa: wikipediaJa.trim() || null,
      }),
    })
    const data = await res.json()

    if (res.ok) {
      setResult({ ok: true, artistName: data.artist.name, channelTitle: data.artist.channelTitle })
      setName('')
      setChannelInput('')
      setSpotifyId('')
      setSpotifyName(null)
      setWikipediaJa('')
      router.refresh()
    } else {
      setResult({ ok: false, error: data.error ?? '追加に失敗しました' })
    }
    setLoading(false)
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-5 mb-8">
      <h2 className="text-sm font-semibold mb-4">アーティストを追加</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {/* 名前 + Channel ID */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs text-dim block mb-1">アーティスト名</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={name}
                onChange={e => { setName(e.target.value); setSpotifyName(null) }}
                placeholder="Mrs. GREEN APPLE"
                required
                className="flex-1 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-dim bg-white"
              />
              <button
                type="button"
                onClick={handleSearch}
                disabled={searching || !name.trim()}
                className="border border-border rounded-lg px-3 py-2 text-xs text-dim hover:text-text hover:border-dim transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {searching ? '検索中...' : '自動検索'}
              </button>
            </div>
          </div>
          <div className="flex-1">
            <label className="text-xs text-dim block mb-1">Channel ID または @ハンドル</label>
            <input
              type="text"
              value={channelInput}
              onChange={e => setChannelInput(e.target.value)}
              placeholder="UCxxxxxxxx または @handle"
              required
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-dim bg-white font-mono"
            />
          </div>
        </div>

        {/* Spotify + Wikipedia */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs text-dim block mb-1">
              Spotify Artist ID（任意）
              {spotifyName && <span className="ml-2 text-mga">→ {spotifyName}</span>}
            </label>
            <input
              type="text"
              value={spotifyId}
              onChange={e => { setSpotifyId(e.target.value); setSpotifyName(null) }}
              placeholder="open.spotify.com/artist/ここのID"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-dim bg-white font-mono"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-dim block mb-1">Wikipedia 記事名（任意）</label>
            <input
              type="text"
              value={wikipediaJa}
              onChange={e => setWikipediaJa(e.target.value)}
              placeholder="Mrs. GREEN APPLE（ja.wikipedia.org の記事名）"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-dim bg-white"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={loading || !name.trim() || !channelInput.trim()}
            className="bg-text text-bg rounded-lg px-4 py-2 text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? '追加中...' : '追加'}
          </button>

          {result && (
            result.ok ? (
              <p className="text-xs text-mga">
                ✓ 追加しました: {result.artistName}
                {result.channelTitle !== result.artistName && (
                  <span className="text-dim ml-1">（YT: {result.channelTitle}）</span>
                )}
              </p>
            ) : (
              <p className="text-xs text-accent">{result.error}</p>
            )
          )}
        </div>
      </form>
    </div>
  )
}
