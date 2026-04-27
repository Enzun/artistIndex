'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function WithdrawButton({
  investmentId,
  totalShares,
  currentIndex,
}: {
  investmentId: string
  totalShares: number
  currentIndex: number
}) {
  const [shares, setShares] = useState(totalShares)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const returnPts = Math.round(shares * currentIndex)

  async function handleWithdraw() {
    setLoading(true)
    setError('')
    const body = new FormData()
    body.append('investment_id', investmentId)
    body.append('shares', String(shares))
    const res = await fetch('/api/withdraw', { method: 'POST', body })
    if (res.ok) {
      router.refresh()
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? '回収に失敗しました')
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="flex items-center border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => setShares(s => Math.max(1, s - 1))}
            disabled={loading || shares <= 1}
            className="px-3 py-1.5 text-sm text-dim hover:text-text disabled:opacity-30 transition-colors"
          >−</button>
          <span className="px-2 py-1.5 text-sm tabular-nums min-w-[3rem] text-center">{shares}</span>
          <button
            onClick={() => setShares(s => Math.min(totalShares, s + 1))}
            disabled={loading || shares >= totalShares}
            className="px-3 py-1.5 text-sm text-dim hover:text-text disabled:opacity-30 transition-colors"
          >＋</button>
        </div>
        <span className="text-xs text-dim">/ {totalShares} 枚</span>
      </div>
      <button
        onClick={handleWithdraw}
        disabled={loading}
        className="w-full bg-mga/10 border border-mga/30 text-mga rounded-lg py-2 text-sm font-medium hover:bg-mga/20 transition-colors disabled:opacity-50"
      >
        {loading ? '処理中...' : `回収する（${returnPts.toLocaleString()} pt）`}
      </button>
      {error && <p className="text-accent text-xs">{error}</p>}
    </div>
  )
}
