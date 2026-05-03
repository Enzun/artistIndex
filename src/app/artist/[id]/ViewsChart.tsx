'use client'

import { useState } from 'react'
import {
  ResponsiveContainer,
  LineChart,
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
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function formatViews(v: number) {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`
  return String(v)
}

function CustomTooltip({ active, payload }: TooltipProps<number, string> & { payload?: Array<{ payload: { date: string; value: number } }> }) {
  if (!active || !payload?.length) return null
  const { date, value } = payload[0].payload
  return (
    <div className="bg-white border border-border rounded-lg px-3 py-2 shadow-lg text-xs">
      <p className="text-dim mb-1">{date}</p>
      <p className="text-text font-bold tabular-nums text-sm">{value.toLocaleString()}</p>
      <p className="text-dim">累計再生数</p>
    </div>
  )
}

export default function ViewsChart({ snapshots }: { snapshots: Snapshot[] }) {
  const [period, setPeriod] = useState<typeof PERIODS[number]['label']>('ALL')

  const allData = snapshots
    .filter(s => s.total_views != null)
    .map(s => ({ date: s.snapshot_date, value: s.total_views as number }))

  if (allData.length < 2) return null

  const selectedDays = PERIODS.find(p => p.label === period)?.days ?? Infinity
  const cutoff = selectedDays === Infinity
    ? ''
    : new Date(Date.now() - selectedDays * 86400_000).toISOString().split('T')[0]

  const data = cutoff ? allData.filter(d => d.date >= cutoff) : allData

  const availableDays = allData.length > 1
    ? Math.ceil((new Date(allData.at(-1)!.date).getTime() - new Date(allData[0].date).getTime()) / 86400_000)
    : 0

  const values = data.map(d => d.value)
  const maxVal = values.length ? Math.max(...values) : 0
  const minVal = values.length ? Math.min(...values) : 0
  const pad = (maxVal - minVal) * 0.05 || maxVal * 0.05

  const tickCount = Math.min(6, data.length)
  const step = data.length > 1 ? Math.floor((data.length - 1) / Math.max(tickCount - 1, 1)) : 0
  const xTicks = data.length > 0
    ? Array.from({ length: tickCount }, (_, i) => data[Math.min(i * step, data.length - 1)].date)
    : []

  return (
    <div className="bg-surface border border-border rounded-xl p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-dim">累計再生数</p>
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
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e4e8" vertical={false} />
          <XAxis
            dataKey="date"
            ticks={xTicks}
            tickFormatter={formatDate}
            tick={{ fill: '#6b7280', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[Math.floor(minVal - pad), Math.ceil(maxVal + pad)]}
            tickFormatter={formatViews}
            tick={{ fill: '#6b7280', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={45}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#e2e4e8', strokeWidth: 1 }} />
          <Line type="monotone" dataKey="value" stroke="#93c5fd" strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
