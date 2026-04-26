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
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <p className="text-xs text-dim">1枚 = {pricePerShare.toLocaleString()} pt</p>
      <div className="flex gap-2 items-center">
        <input
          type="number"
          min={1}
          required
          placeholder="枚数"
          value={shares}
          onChange={(e) => setShares(e.target.value)}
          className="flex-1 bg-surface2 border border-border rounded-lg px-3 py-2 text-sm text-text placeholder-dim focus:outline-none focus:border-dim"
        />
        <span className="text-sm text-dim whitespace-nowrap">枚</span>
      </div>
      {n > 0 && (
        <p className="text-xs text-dim">合計 {totalCost.toLocaleString()} pt</p>
      )}
      {error && <p className="text-accent text-xs">{error}</p>}
      <button
        type="submit"
        disabled={loading || n < 1}
        className="bg-mga/10 border border-mga/30 text-mga rounded-lg py-2 text-sm font-medium hover:bg-mga/20 transition-colors disabled:opacity-50"
      >
        {loading ? '処理中...' : `指数 ${pricePerShare} で購入する`}
      </button>
    </form>
  )
}
