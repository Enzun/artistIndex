'use client'

import { useState } from 'react'

type HistoryItem = {
  id: string
  artistName: string
  pointsInvested: number
  pointsReturned: number
  createdAt: string
  withdrawnAt: string
}

export default function HistorySection({ items }: { items: HistoryItem[] }) {
  const [open, setOpen] = useState(false)

  if (items.length === 0) return null

  return (
    <div className="mt-8">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 text-sm text-dim hover:text-text transition-colors w-full"
      >
        <span className="font-medium">取引履歴</span>
        <span className="text-xs">({items.length}件)</span>
        <svg
          className={`w-4 h-4 ml-auto transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-2">
          {items.map(item => {
            const pnl = item.pointsReturned - item.pointsInvested
            return (
              <div key={item.id} className="bg-surface border border-border rounded-xl px-4 py-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium">{item.artistName}</span>
                  <span className={`text-sm font-bold tabular-nums ${pnl >= 0 ? 'text-mga' : 'text-accent'}`}>
                    {pnl >= 0 ? '+' : ''}{pnl.toLocaleString()} pt
                  </span>
                </div>
                <div className="flex gap-4 text-xs text-dim">
                  <span>投入 {item.pointsInvested.toLocaleString()} pt</span>
                  <span>受取 {item.pointsReturned.toLocaleString()} pt</span>
                  <span className="ml-auto">{item.withdrawnAt.split('T')[0]}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
