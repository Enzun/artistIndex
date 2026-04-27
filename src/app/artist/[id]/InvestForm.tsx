'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function InvestForm({
  artistId,
  currentIndex,
  freePoints,
}: {
  artistId: string
  currentIndex: number
  freePoints: number
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
      {/* 価格情報（上） */}
      <div className="flex justify-between items-baseline">
        <span className="text-base font-semibold tabular-nums">
          1枚 = {pricePerShare.toLocaleString()} pt
        </span>
        <span className={`text-base font-bold tabular-nums ${totalCost > 0 ? 'text-text' : 'text-dim'}`}>
          合計 {totalCost > 0 ? totalCost.toLocaleString() : '—'} pt
        </span>
      </div>

      {/* 枚数入力 */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center border border-border rounded-lg overflow-hidden bg-white">
          <input
            type="number"
            min={1}
            max={100000}
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
          className="bg-accent/10 border border-accent/30 text-accent rounded-lg px-4 py-2 text-sm font-medium hover:bg-accent/20 transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          {loading ? '処理中...' : '購入'}
        </button>
      </div>

      {/* 所持ポイント（下・小さめ） */}
      <p className="text-xs text-dim text-right">
        所持ポイント: {freePoints.toLocaleString()} pt
      </p>

      {error && <p className="text-accent text-xs">{error}</p>}
    </form>
  )
}
