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
  const [inputVal, setInputVal] = useState(String(totalShares))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const parsed = parseInt(inputVal, 10)
  const shares = isNaN(parsed) ? 0 : Math.min(Math.max(parsed, 1), totalShares)
  const returnPts = Math.round(shares * currentIndex)

  function handleBlur() {
    // フォーカスを外したときだけクランプして表示を整える
    if (isNaN(parsed) || parsed < 1) {
      setInputVal('1')
    } else if (parsed > totalShares) {
      setInputVal(String(totalShares))
    } else {
      setInputVal(String(parsed))
    }
  }

  async function handleWithdraw() {
    if (shares < 1) return
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
          <input
            type="text"
            inputMode="numeric"
            value={inputVal}
            onChange={e => setInputVal(e.target.value.replace(/[^0-9]/g, ''))}
            onBlur={handleBlur}
            disabled={loading}
            className="w-16 px-2 py-1.5 text-sm tabular-nums text-center focus:outline-none bg-transparent"
          />
        </div>
        <span className="text-xs text-dim">/ {totalShares} 枚</span>
      </div>
      <button
        onClick={handleWithdraw}
        disabled={loading || shares < 1}
        className="w-full bg-mga/10 border border-mga/30 text-mga rounded-lg py-2 text-sm font-medium hover:bg-mga/20 transition-colors disabled:opacity-50"
      >
        {loading ? '処理中...' : `回収する（${returnPts.toLocaleString()} pt）`}
      </button>
      {error && <p className="text-accent text-xs">{error}</p>}
    </div>
  )
}
