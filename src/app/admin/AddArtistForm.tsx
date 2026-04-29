'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AddArtistForm() {
  const [name, setName] = useState('')
  const [channelInput, setChannelInput] = useState('')
  const [spotifyId, setSpotifyId] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ ok: true; artistName: string; channelTitle: string } | { ok: false; error: string } | null>(null)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setResult(null)

    const res = await fetch('/api/admin/artist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, channelInput, spotifyId: spotifyId.trim() || null }),
    })
    const data = await res.json()

    if (res.ok) {
      setResult({ ok: true, artistName: data.artist.name, channelTitle: data.artist.channelTitle })
      setName('')
      setChannelInput('')
      setSpotifyId('')
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
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs text-dim block mb-1">アーティスト名</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Mrs. GREEN APPLE"
              required
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-dim bg-white"
            />
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

        <div>
          <label className="text-xs text-dim block mb-1">Spotify Artist ID（任意）</label>
          <input
            type="text"
            value={spotifyId}
            onChange={e => setSpotifyId(e.target.value)}
            placeholder="open.spotify.com/artist/ここのID"
            className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-dim bg-white font-mono"
          />
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
