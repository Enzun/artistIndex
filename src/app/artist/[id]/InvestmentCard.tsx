'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  investmentId: string
  pointsInvested: number
  indexAtEntry: number
  currentIndex: number
}

export default function InvestmentCard({ investmentId, pointsInvested, indexAtEntry, currentIndex }: Props) {
  const totalShares = Math.round(pointsInvested / indexAtEntry)
  const [shares, setShares] = useState(totalShares)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const returnPts = Math.round(shares * currentIndex)
  const totalReturn = Math.round(totalShares * currentIndex)
  const changePct = (totalReturn / pointsInvested - 1) * 100

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
    <div className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-3">
      {/* 回収合計（上） */}
      <div className="flex justify-between items-baseline">
        <span className="text-base font-semibold tabular-nums">
          回収 = {returnPts.toLocaleString()} pt
        </span>
        <span className={`text-base font-bold tabular-nums ${changePct >= 0 ? 'text-mga' : 'text-accent'}`}>
          {changePct >= 0 ? '+' : ''}{changePct.toFixed(1)}%
        </span>
      </div>

      {/* 枚数セレクター */}
      <div className="flex items-center gap-2">
        <div className="flex items-center border border-border rounded-lg overflow-hidden bg-white">
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
        <button
          onClick={handleWithdraw}
          disabled={loading}
          className="ml-auto bg-mga/10 border border-mga/30 text-mga rounded-lg px-4 py-2 text-sm font-medium hover:bg-mga/20 transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          {loading ? '処理中...' : '回収'}
        </button>
      </div>

      {/* 詳細情報（下） */}
      <div className="flex gap-4 text-xs text-dim">
        <span>購入時指数: {Math.floor(indexAtEntry)}</span>
        <span>保有: {totalShares.toLocaleString()} 枚</span>
        <span>投入: {pointsInvested.toLocaleString()} pt</span>
      </div>

      {error && <p className="text-accent text-xs">{error}</p>}
    </div>
  )
}
