'use client'

/**
 * ViewsChart — 再生数グラフ（日次増加 / 累計切り替え）
 * このファイルと page.tsx の <ViewsChart /> 行を削除するだけで完全に除去できる。
 */

import { useState } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import type { TooltipProps } from 'recharts'

type Snapshot = { snapshot_date: string; daily_increase: number | null; total_views?: number | null }

const PERIODS = [
  { label: '1M',  days: 30 },
  { label: '3M',  days: 90 },
  { label: '6M',  days: 180 },
  { label: '1Y',  days: 365 },
  { label: 'ALL', days: Infinity },
] as const

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

function formatDateShort(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatViews(v: number) {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`
  return String(v)
}

function CustomTooltip({ active, payload, mode }: TooltipProps<number, string> & { payload?: Array<{ payload: { date: string; value: number } }>; mode: 'daily' | 'total' }) {
  if (!active || !payload?.length) return null
  const { date, value } = payload[0].payload
  return (
    <div className="bg-white border border-border rounded-lg px-3 py-2 shadow-lg text-xs">
      <p className="text-dim mb-1">{formatDate(date)}</p>
      <p className="text-text font-bold tabular-nums text-sm">{value.toLocaleString()}</p>
      <p className="text-dim">{mode === 'daily' ? '再生/日' : '累計再生数'}</p>
    </div>
  )
}

export default function ViewsChart({ snapshots }: { snapshots: Snapshot[] }) {
  const [period, setPeriod] = useState<typeof PERIODS[number]['label']>('3M')
  const [mode, setMode] = useState<'daily' | 'total'>('daily')

  // 日次モード: daily_increase > 0 のみ
  const dailyData = snapshots
    .filter(s => s.daily_increase !== null && s.daily_increase > 0)
    .map(s => ({ date: s.snapshot_date, value: s.daily_increase as number }))

  // 累計モード: total_views があるもの全件
  const totalData = snapshots
    .filter(s => s.total_views != null)
    .map(s => ({ date: s.snapshot_date, value: s.total_views as number }))

  const activeRaw = mode === 'daily' ? dailyData : totalData

  // 日次モードは daily_data が空なら累計に自動切り替えて表示（ただし切り替えボタンは残す）
  const hasDaily = dailyData.length >= 1
  const hasTotal = totalData.length >= 1

  if (!hasDaily && !hasTotal) return null

  const selectedDays = PERIODS.find(p => p.label === period)?.days ?? Infinity
  const cutoff = selectedDays === Infinity
    ? ''
    : new Date(Date.now() - selectedDays * 86400_000).toISOString().split('T')[0]

  const data = cutoff ? activeRaw.filter(d => d.date >= cutoff) : activeRaw

  const availableDays = activeRaw.length > 1
    ? Math.ceil((new Date(activeRaw.at(-1)!.date).getTime() - new Date(activeRaw[0].date).getTime()) / 86400_000)
    : 0

  const useBar = mode === 'daily' && data.length <= 90

  const values = data.map(d => d.value)
  const maxVal = values.length ? Math.max(...values) : 0
  const yMax = Math.ceil(maxVal * 1.1) || 1

  const tickCount = Math.min(6, data.length)
  const step = data.length > 1 ? Math.floor((data.length - 1) / Math.max(tickCount - 1, 1)) : 0
  const xTicks = data.length > 0
    ? Array.from({ length: tickCount }, (_, i) => data[Math.min(i * step, data.length - 1)].date)
    : []

  return (
    <div className="bg-surface border border-border rounded-xl p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1">
          <button
            onClick={() => setMode('daily')}
            className={`px-2 py-0.5 rounded text-xs transition-colors ${
              mode === 'daily' ? 'bg-text text-bg font-medium' : 'text-dim hover:text-text'
            }`}
          >
            日次
          </button>
          <button
            onClick={() => setMode('total')}
            className={`px-2 py-0.5 rounded text-xs transition-colors ${
              mode === 'total' ? 'bg-text text-bg font-medium' : 'text-dim hover:text-text'
            }`}
          >
            累計
          </button>
        </div>
        <div className="flex gap-1">
          {PERIODS.map(({ label, days }) => {
            const available = days === Infinity || availableDays >= days * 0.8
            return (
              <button
                key={label}
                onClick={() => available && setPeriod(label)}
                className={`px-2 py-0.5 rounded text-xs tabular-nums transition-colors ${
                  period === label
                    ? 'bg-text text-bg font-medium'
                    : available
                    ? 'text-dim hover:text-text'
                    : 'text-border cursor-default'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {data.length === 0 ? (
        <div className="h-[140px] flex items-center justify-center text-xs text-dim">
          {mode === 'daily' ? '日次再生数のデータがありません' : 'データがありません'}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={140}>
          <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e4e8" vertical={false} />
            <XAxis
              dataKey="date"
              ticks={xTicks}
              tickFormatter={formatDateShort}
              tick={{ fill: '#6b7280', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[mode === 'total' ? 'auto' : 0, yMax]}
              tickFormatter={formatViews}
              tick={{ fill: '#6b7280', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={45}
            />
            <Tooltip content={<CustomTooltip mode={mode} />} cursor={{ fill: '#f0f1f3' }} />
            {useBar
              ? <Bar dataKey="value" fill="#93c5fd" radius={[2, 2, 0, 0]} maxBarSize={12} />
              : <Line type="monotone" dataKey="value" stroke="#93c5fd" strokeWidth={1.5} dot={false} />
            }
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
