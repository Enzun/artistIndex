'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type AddResult = {
  ok: true
  artist: {
    name: string
    channelTitle: string
    youtube: string
    spotify: string | null
    wikipedia: string | null
  }
} | {
  ok: false
  error: string
}

export default function AddArtistForm() {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AddResult | null>(null)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setResult(null)

    const res = await fetch('/api/admin/artist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const data = await res.json()

    if (res.ok) {
      setResult({ ok: true, artist: data.artist })
      setName('')
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
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="アーティスト名"
            required
            className="flex-1 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-dim bg-white"
          />
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="bg-text text-bg rounded-lg px-4 py-2 text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {loading ? '追加中...' : '追加'}
          </button>
        </div>

        {result && (
          result.ok ? (
            <div className="text-xs space-y-0.5">
              <p className="text-mga font-medium">✓ 追加: {result.artist.name}
                {result.artist.channelTitle !== result.artist.name && (
                  <span className="text-dim font-normal ml-1">（YT: {result.artist.channelTitle}）</span>
                )}
              </p>
              <p className="text-dim">
                YouTube: <span className="text-text font-mono">{result.artist.youtube}</span>
                {'　'}
                Spotify: {result.artist.spotify
                  ? <span className="text-text font-mono">{result.artist.spotify}</span>
                  : <span className="text-border">—</span>}
                {'　'}
                Wikipedia: {result.artist.wikipedia
                  ? <span className="text-text">{result.artist.wikipedia}</span>
                  : <span className="text-border">—</span>}
              </p>
            </div>
          ) : (
            <p className="text-xs text-accent">{result.error}</p>
          )
        )}
      </form>
    </div>
  )
}
