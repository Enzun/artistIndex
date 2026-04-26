'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function InvestForm({
  artistId,
  currentIndex,
}: {
  artistId: string
  currentIndex: number
}) {
  const [points, setPoints] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/invest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artist_id: artistId, points: parseInt(points) }),
    })

    if (res.ok) {
      router.refresh()
    } else {
      const data = await res.json()
      setError(data.error ?? '投入に失敗しました')
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <input
        type="number"
        min={1}
        required
        placeholder="投入ポイント数"
        value={points}
        onChange={(e) => setPoints(e.target.value)}
        className="bg-surface2 border border-border rounded-lg px-3 py-2 text-sm text-text placeholder-dim focus:outline-none focus:border-dim"
      />
      {error && <p className="text-accent text-xs">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="bg-mga/10 border border-mga/30 text-mga rounded-lg py-2 text-sm font-medium hover:bg-mga/20 transition-colors disabled:opacity-50"
      >
        {loading ? '処理中...' : `指数 ${currentIndex.toFixed(1)} で投入する`}
      </button>
    </form>
  )
}
