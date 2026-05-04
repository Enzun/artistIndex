'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { slotCost, BASE_SLOTS } from '@/lib/titles'
import { getBaggerLabel } from '@/lib/achievements'
import { getEarlyBirdTitle, getHolderTitle } from '@/lib/dynamicTitles'

type HoldingItem = {
  id: string
  name: string
  currentIndex: number
  totalShares: number
  totalInvested: number
  currentValue: number
  publishedAt: string | null
  earliestInvestmentAt: string
}

type HistoryItem = {
  id: string
  artistName: string
  pointsInvested: number
  pointsReturned: number | null
  createdAt: string
  withdrawnAt: string | null
  status: 'active' | 'withdrawn'
}

type Props = {
  holdings: HoldingItem[]
  history: HistoryItem[]
  pointSlots: number
  freePoints: number
}

const PERIODS = [
  { label: '全期間', months: null },
  { label: '3ヶ月', months: 3 },
  { label: '1ヶ月', months: 1 },
] as const

const STATUS_FILTERS = [
  { label: 'すべて',   value: 'all' },
  { label: '保有中',   value: 'active' },
  { label: '売却済み', value: 'withdrawn' },
] as const

export default function PortfolioTabs({ holdings, history, pointSlots, freePoints }: Props) {
  const [tab, setTab] = useState<'holdings' | 'history'>('holdings')
  const [slotLoading, setSlotLoading] = useState(false)
  const [slotError, setSlotError]     = useState('')
  const router = useRouter()

  const totalSlots = BASE_SLOTS + pointSlots
  const nextCost   = slotCost(pointSlots)
  const canBuySlot = freePoints >= nextCost

  async function handleBuySlot() {
    if (!confirm(`枠を1つ追加します。\n費用: ${nextCost.toLocaleString()} pt\n\nよろしいですか？`)) return
    setSlotLoading(true)
    setSlotError('')
    const res = await fetch('/api/slots', { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      router.refresh()
    } else {
      setSlotError(data.error ?? '枠の追加に失敗しました')
    }
    setSlotLoading(false)
  }

  const [artistFilter, setArtistFilter] = useState('')
  const [period, setPeriod] = useState<typeof PERIODS[number]['label']>('全期間')
  const [statusFilter, setStatusFilter] = useState<typeof STATUS_FILTERS[number]['value']>('all')

  // 取引履歴のアーティスト一覧（重複なし）
  const artistNames = Array.from(new Set(history.map(h => h.artistName))).sort()

  // フィルタ適用
  const filteredHistory = history.filter(h => {
    if (artistFilter && h.artistName !== artistFilter) return false
    if (statusFilter !== 'all' && h.status !== statusFilter) return false
    const months = PERIODS.find(p => p.label === period)?.months
    if (months) {
      const cutoff = new Date()
      cutoff.setMonth(cutoff.getMonth() - months)
      const compareDate = h.withdrawnAt ?? h.createdAt
      if (new Date(compareDate) < cutoff) return false
    }
    return true
  })

  const totalPnL = filteredHistory
    .filter(h => h.status === 'withdrawn')
    .reduce((s, h) => s + ((h.pointsReturned ?? 0) - h.pointsInvested), 0)

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
            {t === 'holdings' ? '保有中' : `取引履歴（${history.length}）`}
          </button>
        ))}
      </div>

      {/* 保有中 */}
      {tab === 'holdings' && (
        <div className="flex flex-col gap-3">
          {/* 枠数 */}
          <div className="flex items-center justify-between text-xs text-dim mb-1">
            <span>枠: {holdings.length} / {totalSlots}</span>
          </div>

          {/* 使用中の枠 */}
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
                  {/* 動的称号バッジ */}
                  {(() => {
                    const earlyTitle  = getEarlyBirdTitle(a.earliestInvestmentAt, a.publishedAt)
                    const holderTitle = getHolderTitle(a.earliestInvestmentAt)
                    if (!earlyTitle && !holderTitle) return null
                    return (
                      <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-border">
                        {earlyTitle && (
                          <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">
                            {earlyTitle}
                          </span>
                        )}
                        {holderTitle && (
                          <span className="text-xs bg-mga/10 text-mga px-2 py-0.5 rounded-full font-medium">
                            {holderTitle}
                          </span>
                        )}
                      </div>
                    )
                  })()}
                </div>
              </Link>
            )
          })}

          {/* 空枠 */}
          {Array.from({ length: totalSlots - holdings.length }).map((_, i) => (
            <Link key={`empty-${i}`} href="/">
              <div className="bg-surface border border-dashed border-border rounded-xl p-5 text-center hover:border-dim transition-colors">
                <p className="text-sm text-dim">空き枠 — アーティストを探す</p>
              </div>
            </Link>
          ))}

          {/* 枠追加カード */}
          <button
            onClick={handleBuySlot}
            disabled={slotLoading}
            className="bg-surface border border-dashed border-border rounded-xl p-5 text-center hover:border-dim transition-colors disabled:opacity-40 disabled:cursor-not-allowed w-full"
          >
            {slotLoading ? (
              <p className="text-sm text-dim">処理中...</p>
            ) : canBuySlot ? (
              <p className="text-sm text-dim">+ 枠を追加（{nextCost.toLocaleString()} pt）</p>
            ) : (
              <p className="text-sm text-dim">+ 枠を追加（{nextCost.toLocaleString()} pt）<span className="text-accent ml-1">ポイント不足</span></p>
            )}
            {slotError && <p className="text-xs text-accent mt-1">{slotError}</p>}
          </button>
        </div>
      )}

      {/* 取引履歴 */}
      {tab === 'history' && (
        <div>
          {/* フィルタ */}
          <div className="flex flex-wrap gap-2 mb-4">
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
              {STATUS_FILTERS.map(f => (
                <button
                  key={f.value}
                  onClick={() => setStatusFilter(f.value)}
                  className={`px-3 py-1.5 text-sm transition-colors ${
                    statusFilter === f.value ? 'bg-text text-bg font-medium' : 'text-dim hover:text-text'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
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
              {filteredHistory.some(h => h.status === 'withdrawn') && (
                <span className={totalPnL >= 0 ? 'text-mga' : 'text-accent'}>
                  売却損益合計: {totalPnL >= 0 ? '+' : ''}{totalPnL.toLocaleString()} pt
                </span>
              )}
            </div>
          )}

          {/* リスト */}
          {filteredHistory.length === 0 ? (
            <p className="text-dim text-sm text-center py-8">履歴がありません</p>
          ) : (
            <div className="flex flex-col gap-2">
              {filteredHistory.map(item => {
                const isSold = item.status === 'withdrawn'
                const pnl = isSold ? (item.pointsReturned ?? 0) - item.pointsInvested : null
                return (
                  <div key={item.id} className="bg-surface border border-border rounded-xl px-4 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium truncate">{item.artistName}</span>
                        {!isSold && (
                          <span className="text-xs text-mga bg-mga/10 px-1.5 py-0.5 rounded flex-shrink-0">保有中</span>
                        )}
                      </div>
                      {pnl !== null ? (
                        <span className={`text-sm font-bold tabular-nums flex-shrink-0 ${pnl >= 0 ? 'text-mga' : 'text-accent'}`}>
                          {pnl >= 0 ? '+' : ''}{pnl.toLocaleString()} pt
                        </span>
                      ) : (
                        <span className="text-xs text-dim flex-shrink-0">{item.createdAt.split('T')[0]}</span>
                      )}
                    </div>
                    <div className="flex gap-4 text-xs text-dim">
                      <span>購入 {item.pointsInvested.toLocaleString()} pt</span>
                      {isSold && item.pointsReturned !== null && (
                        <span>売却 {item.pointsReturned.toLocaleString()} pt</span>
                      )}
                      {isSold && item.pointsReturned !== null && (() => {
                        const bagger = getBaggerLabel(item.pointsInvested, item.pointsReturned)
                        return bagger ? (
                          <span className="bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded font-medium">
                            {bagger}
                          </span>
                        ) : null
                      })()}
                      {isSold && (
                        <span className="ml-auto">{(item.withdrawnAt ?? item.createdAt).split('T')[0]}</span>
                      )}
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
