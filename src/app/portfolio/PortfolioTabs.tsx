'use client'

import { useState } from 'react'
import Link from 'next/link'

type HoldingItem = {
  id: string
  name: string
  currentIndex: number
  totalShares: number
  totalInvested: number
  currentValue: number
}

type HistoryItem = {
  id: string
  artistName: string
  pointsInvested: number
  pointsReturned: number
  createdAt: string
  withdrawnAt: string
}

type Props = {
  holdings: HoldingItem[]
  history: HistoryItem[]
}

const PERIODS = [
  { label: '全期間', months: null },
  { label: '3ヶ月', months: 3 },
  { label: '1ヶ月', months: 1 },
] as const

export default function PortfolioTabs({ holdings, history }: Props) {
  const [tab, setTab] = useState<'holdings' | 'history'>('holdings')
  const [artistFilter, setArtistFilter] = useState('')
  const [period, setPeriod] = useState<typeof PERIODS[number]['label']>('全期間')

  // 取引履歴のアーティスト一覧（重複なし）
  const artistNames = Array.from(new Set(history.map(h => h.artistName))).sort()

  // フィルタ適用
  const filteredHistory = history.filter(h => {
    if (artistFilter && h.artistName !== artistFilter) return false
    const months = PERIODS.find(p => p.label === period)?.months
    if (months) {
      const cutoff = new Date()
      cutoff.setMonth(cutoff.getMonth() - months)
      if (new Date(h.withdrawnAt) < cutoff) return false
    }
    return true
  })

  const totalPnL = filteredHistory.reduce((s, h) => s + (h.pointsReturned - h.pointsInvested), 0)

  return (
    <>
      {/* タブ */}
      <div className="flex border-b border-border mb-6">
        {(['holdings', 'history'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t
                ? 'border-text text-text'
                : 'border-transparent text-dim hover:text-text'
            }`}
          >
            {t === 'holdings' ? `保有中（${holdings.length}）` : `取引履歴（${history.length}）`}
          </button>
        ))}
      </div>

      {/* 保有中 */}
      {tab === 'holdings' && (
        holdings.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-dim text-sm mb-4">まだカードを持っていません</p>
            <Link href="/" className="text-sm underline hover:text-text transition-colors">
              アーティスト一覧へ
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {holdings.map((a) => {
              const pnl = a.currentValue - a.totalInvested
              const pnlPct = a.totalInvested > 0 ? (a.currentValue / a.totalInvested - 1) * 100 : 0
              const avgEntry = a.totalShares > 0 ? Math.floor(a.totalInvested / a.totalShares) : 0
              return (
                <Link key={a.id} href={`/artist/${a.id}`}>
                  <div className="bg-surface border border-border rounded-xl p-5 hover:border-dim transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-semibold">{a.name}</span>
                      <span className={`text-sm font-bold tabular-nums ${pnlPct >= 0 ? 'text-mga' : 'text-accent'}`}>
                        {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="grid grid-cols-4 text-sm gap-2">
                      <div>
                        <p className="text-xs text-dim mb-0.5">保有</p>
                        <p className="tabular-nums">{a.totalShares.toLocaleString()} 枚</p>
                      </div>
                      <div>
                        <p className="text-xs text-dim mb-0.5">平均単価</p>
                        <p className="tabular-nums">{avgEntry.toLocaleString()} pt</p>
                      </div>
                      <div>
                        <p className="text-xs text-dim mb-0.5">現在値</p>
                        <p className="tabular-nums">{Math.floor(a.currentIndex).toLocaleString()} pt</p>
                      </div>
                      <div>
                        <p className="text-xs text-dim mb-0.5">総損益</p>
                        <p className={`tabular-nums ${pnl >= 0 ? 'text-mga' : 'text-accent'}`}>
                          {pnl >= 0 ? '+' : ''}{pnl.toLocaleString()} pt
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )
      )}

      {/* 取引履歴 */}
      {tab === 'history' && (
        <div>
          {/* フィルタ */}
          <div className="flex flex-wrap gap-3 mb-4">
            <select
              value={artistFilter}
              onChange={e => setArtistFilter(e.target.value)}
              className="border border-border rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-dim"
            >
              <option value="">全アーティスト</option>
              {artistNames.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <div className="flex rounded-lg border border-border overflow-hidden">
              {PERIODS.map(p => (
                <button
                  key={p.label}
                  onClick={() => setPeriod(p.label)}
                  className={`px-3 py-1.5 text-sm transition-colors ${
                    period === p.label ? 'bg-text text-bg font-medium' : 'text-dim hover:text-text'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* 集計 */}
          {filteredHistory.length > 0 && (
            <div className="flex gap-4 text-xs text-dim mb-4">
              <span>{filteredHistory.length}件</span>
              <span className={totalPnL >= 0 ? 'text-mga' : 'text-accent'}>
                損益合計: {totalPnL >= 0 ? '+' : ''}{totalPnL.toLocaleString()} pt
              </span>
            </div>
          )}

          {/* リスト */}
          {filteredHistory.length === 0 ? (
            <p className="text-dim text-sm text-center py-8">履歴がありません</p>
          ) : (
            <div className="flex flex-col gap-2">
              {filteredHistory.map(item => {
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
      )}
    </>
  )
}
