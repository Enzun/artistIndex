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
  const [shares, setShares] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const pricePerShare = Math.floor(currentIndex)
  const n = parseInt(shares)
  const totalCost = n > 0 ? n * pricePerShare : 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (n < 1) return
    setLoading(true)
    setError('')

    const res = await fetch('/api/invest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artist_id: artistId, points: totalCost }),
    })

    if (res.ok) {
      setShares('')
      router.refresh()
    } else {
      const data = await res.json()
      setError(data.error ?? '購入に失敗しました')
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center border border-border rounded-lg overflow-hidden bg-white">
          <input
            type="number"
            min={1}
            required
            placeholder="枚数を入力"
            value={shares}
            onChange={(e) => setShares(e.target.value)}
            className="flex-1 px-3 py-2 text-sm text-text placeholder-dim focus:outline-none bg-transparent"
          />
          <span className="pr-3 text-sm text-dim">枚</span>
        </div>
        <button
          type="submit"
          disabled={loading || n < 1}
          className="bg-mga/10 border border-mga/30 text-mga rounded-lg px-4 py-2 text-sm font-medium hover:bg-mga/20 transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          {loading ? '処理中...' : '購入'}
        </button>
      </div>
      <div className="flex justify-between text-xs text-dim px-0.5">
        <span>1枚 = {pricePerShare.toLocaleString()} pt</span>
        <span className={`tabular-nums font-medium ${n > 0 ? 'text-text' : ''}`}>
          合計 {totalCost > 0 ? totalCost.toLocaleString() : '—'} pt
        </span>
      </div>
      {error && <p className="text-accent text-xs">{error}</p>}
    </form>
  )
}
