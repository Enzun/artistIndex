'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function WithdrawButton({
  investmentId,
  returnPts,
}: {
  investmentId: string
  returnPts: number
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleWithdraw() {
    setLoading(true)
    setError('')
    const body = new FormData()
    body.append('investment_id', investmentId)
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
    <div className="flex flex-col gap-1">
      <button
        onClick={handleWithdraw}
        disabled={loading}
        className="w-full bg-surface2 border border-border rounded-lg py-2 text-sm font-medium hover:border-dim transition-colors disabled:opacity-50"
      >
        {loading ? '処理中...' : `回収する（${returnPts.toLocaleString()} pt）`}
      </button>
      {error && <p className="text-accent text-xs">{error}</p>}
    </div>
  )
}
