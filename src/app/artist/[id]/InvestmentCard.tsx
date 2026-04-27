'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Investment } from '@/lib/types'

type Props = {
  artistId: string
  investments: Investment[]
  currentIndex: number
}

export default function InvestmentCard({ artistId, investments, currentIndex }: Props) {
  const totalShares = investments.reduce((s, inv) => s + Math.round(inv.points_invested / inv.index_at_entry), 0)
  const totalInvested = investments.reduce((s, inv) => s + inv.points_invested, 0)
  const avgEntry = totalShares > 0 ? totalInvested / totalShares : 0
  const pricePerShare = Math.floor(currentIndex)

  const [shares, setShares] = useState(totalShares > 0 ? totalShares : 0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const returnPts = Math.round(shares * currentIndex)
  const totalValue = Math.round(totalShares * currentIndex)
  const totalPnL = totalValue - totalInvested
  const pnlPct = totalInvested > 0 ? (totalValue / totalInvested - 1) * 100 : 0
  const noShares = totalShares === 0

  async function handleSell() {
    setLoading(true)
    setError('')
    const res = await fetch('/api/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artist_id: artistId, shares }),
    })
    if (res.ok) {
      router.refresh()
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? '売却に失敗しました')
      setLoading(false)
    }
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-3">
      {/* 行1: 1枚=Xpt  合計-pt */}
      <div className="flex justify-between items-baseline">
        <span className="text-base font-semibold tabular-nums">
          1枚 = {pricePerShare.toLocaleString()} pt
        </span>
        <span className={`text-base font-bold tabular-nums ${!noShares && returnPts > 0 ? 'text-text' : 'text-dim'}`}>
          合計 {!noShares && returnPts > 0 ? returnPts.toLocaleString() : '—'} pt
        </span>
      </div>

      {/* 行2: 枚数入力 + 売却ボタン */}
      <div className="flex items-center gap-2">
        <div className={`flex items-center border rounded-lg overflow-hidden bg-white ${noShares ? 'border-border opacity-40' : 'border-border'}`}>
          <button
            onClick={() => setShares(s => Math.max(1, s - 1))}
            disabled={loading || noShares || shares <= 1}
            className="px-3 py-1.5 text-sm text-dim hover:text-text disabled:opacity-30 transition-colors"
          >−</button>
          <input
            type="number"
            min={1}
            max={totalShares || 1}
            value={noShares ? 0 : shares}
            disabled={noShares}
            onChange={(e) => {
              const v = parseInt(e.target.value)
              if (!isNaN(v)) setShares(Math.min(totalShares, Math.max(1, v)))
            }}
            className="w-16 py-1.5 text-sm tabular-nums text-center focus:outline-none bg-transparent disabled:text-dim"
          />
          <button
            onClick={() => setShares(s => Math.min(totalShares, s + 1))}
            disabled={loading || noShares || shares >= totalShares}
            className="px-3 py-1.5 text-sm text-dim hover:text-text disabled:opacity-30 transition-colors"
          >＋</button>
        </div>
        <span className="text-xs text-dim">/ {totalShares} 枚</span>
        <button
          onClick={handleSell}
          disabled={loading || noShares}
          className="ml-auto bg-mga/10 border border-mga/30 text-mga rounded-lg px-4 py-2 text-sm font-medium hover:bg-mga/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {loading ? '処理中...' : '売却'}
        </button>
      </div>

      {/* 行3: 詳細情報 */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-dim">
        <span>平均単価: {noShares ? '—' : `${Math.floor(avgEntry).toLocaleString()} pt`}</span>
        <span>保有: {totalShares.toLocaleString()} 枚</span>
        {!noShares && (
          <>
            <span className={totalPnL >= 0 ? 'text-mga' : 'text-accent'}>
              総損益: {totalPnL >= 0 ? '+' : ''}{totalPnL.toLocaleString()} pt
            </span>
            <span className={pnlPct >= 0 ? 'text-mga' : 'text-accent'}>
              {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%
            </span>
          </>
        )}
      </div>

      {error && <p className="text-accent text-xs">{error}</p>}
    </div>
  )
}
