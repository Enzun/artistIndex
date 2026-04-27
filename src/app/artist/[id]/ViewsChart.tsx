'use client'

/**
 * ViewsChart — 日次再生数の推移グラフ（検証用、独立コンポーネント）
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

type Snapshot = { snapshot_date: string; daily_increase: number | null }

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
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`
  return String(v)
}

function CustomTooltip({ active, payload }: TooltipProps<number, string> & { payload?: Array<{ payload: { date: string; views: number } }> }) {
  if (!active || !payload?.length) return null
  const { date, views } = payload[0].payload
  return (
    <div className="bg-white border border-border rounded-lg px-3 py-2 shadow-lg text-xs">
      <p className="text-dim mb-1">{formatDate(date)}</p>
      <p className="text-text font-bold tabular-nums text-sm">{views.toLocaleString()}</p>
    </div>
  )
}

export default function ViewsChart({ snapshots }: { snapshots: Snapshot[] }) {
  const [period, setPeriod] = useState<typeof PERIODS[number]['label']>('3M')

  const allData = snapshots
    .filter(s => s.daily_increase !== null && s.daily_increase > 0)
    .map(s => ({ date: s.snapshot_date, views: s.daily_increase as number }))

  const selectedDays = PERIODS.find(p => p.label === period)?.days ?? Infinity
  const cutoff = selectedDays === Infinity
    ? ''
    : new Date(Date.now() - selectedDays * 86400_000).toISOString().split('T')[0]

  const data = cutoff ? allData.filter(d => d.date >= cutoff) : allData

  const availableDays = allData.length > 1
    ? Math.ceil((new Date(allData.at(-1)!.date).getTime() - new Date(allData[0].date).getTime()) / 86400_000)
    : 0

  // データ点が多い場合は棒グラフが細くなるので折れ線に切り替え
  const useBar = data.length <= 90

  if (allData.length < 2) return null

  const values = data.map(d => d.views)
  const maxVal = Math.max(...values)
  const yMax = Math.ceil(maxVal * 1.1)

  const tickCount = Math.min(6, data.length)
  const step = Math.floor((data.length - 1) / Math.max(tickCount - 1, 1))
  const xTicks = Array.from({ length: tickCount }, (_, i) =>
    data[Math.min(i * step, data.length - 1)].date,
  )

  return (
    <div className="bg-surface border border-border rounded-xl p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-dim">日次再生数</p>
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
            domain={[0, yMax]}
            tickFormatter={formatViews}
            tick={{ fill: '#6b7280', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f0f1f3' }} />
          {useBar
            ? <Bar dataKey="views" fill="#93c5fd" radius={[2, 2, 0, 0]} maxBarSize={12} />
            : <Line type="monotone" dataKey="views" stroke="#93c5fd" strokeWidth={1.5} dot={false} />
          }
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
