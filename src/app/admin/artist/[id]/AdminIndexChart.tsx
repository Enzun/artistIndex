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
import { calcHIndex, DEFAULT_H_PARAMS, type SnapRow } from '@/lib/indexFormula'

type Snapshot = {
  snapshot_date: string
  index_value: number | null
  daily_increase?: number | null
  total_views?: number | null
  wikipedia_pageviews?: number | null
}

type ChartPoint = { date: string; index: number }

function buildHTimeSeries(snapshots: Snapshot[], scale: number | null): ChartPoint[] {
  const sorted = [...snapshots].sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))
  const params = scale ? { ...DEFAULT_H_PARAMS, SCALE: scale } : DEFAULT_H_PARAMS
  const result: ChartPoint[] = []

  for (let i = 0; i < sorted.length; i++) {
    const val = calcHIndex(sorted.slice(0, i + 1) as SnapRow[], params)
    if (val !== null) {
      result.push({ date: sorted[i].snapshot_date, index: Math.round(val * 100) / 100 })
    }
  }
  return result
}

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

function CustomTooltip({ active, payload }: TooltipProps<number, string> & { payload?: Array<{ payload: ChartPoint }> }) {
  if (!active || !payload?.length) return null
  const { date, index } = payload[0].payload
  return (
    <div className="bg-white border border-border rounded-lg px-3 py-2 shadow-lg text-xs">
      <p className="text-dim mb-1">{formatDate(date)}</p>
      <p className="text-text font-bold tabular-nums text-sm">{index.toLocaleString(undefined, { maximumFractionDigits: 1 })} pt</p>
    </div>
  )
}

function CustomDot(props: { cx?: number; cy?: number; index?: number; dataLength?: number }) {
  const { cx, cy, index, dataLength } = props
  if (index !== (dataLength ?? 0) - 1) return null
  return <circle cx={cx} cy={cy} r={4} fill="#2563eb" stroke="#ffffff" strokeWidth={2} />
}

export default function AdminIndexChart({
  snapshots,
  scale = null,
}: {
  snapshots: Snapshot[]
  scale?: number | null
}) {
  const [period, setPeriod] = useState<typeof PERIODS[number]['label']>('ALL')

  const allData = buildHTimeSeries(snapshots, scale)

  const selectedDays = PERIODS.find(p => p.label === period)?.days ?? Infinity
  const cutoff = selectedDays === Infinity
    ? ''
    : new Date(Date.now() - selectedDays * 86400_000).toISOString().split('T')[0]

  const data = cutoff ? allData.filter(d => d.date >= cutoff) : allData

  if (allData.length < 2) {
    return (
      <div className="bg-surface border border-border rounded-xl p-4 mb-4 h-36 flex items-center justify-center">
        <p className="text-dim text-xs">データ蓄積中 ({snapshots.length}件)</p>
      </div>
    )
  }

  const availableDays = Math.ceil(
    (new Date(allData.at(-1)!.date).getTime() - new Date(allData[0].date).getTime()) / 86400_000
  )

  const values = data.map(d => d.index)
  const minVal = Math.min(...values)
  const maxVal = Math.max(...values)
  const pad = (maxVal - minVal) * 0.12 || maxVal * 0.05
  const yMin = Math.floor(minVal - pad)
  const yMax = Math.ceil(maxVal + pad)

  const tickCount = Math.min(6, data.length)
  const xTicks = Array.from({ length: tickCount }, (_, i) => {
    if (i === tickCount - 1) return data[data.length - 1].date
    const idx = Math.round(i * (data.length - 1) / (tickCount - 1))
    return data[idx].date
  })

  const latest = data.at(-1)!.index
  const first = data[0].index
  const changePct = first > 0 ? ((latest - first) / first) * 100 : 0

  return (
    <div className="bg-surface border border-border rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-dim">H式指数推移</p>
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
      <p className={`text-xs mb-3 tabular-nums ${changePct >= 0 ? 'text-mga' : 'text-accent'}`}>
        現在: {latest.toLocaleString(undefined, { maximumFractionDigits: 1 })} pt
        {' '}({changePct >= 0 ? '+' : ''}{changePct.toFixed(1)}% 期間内)
      </p>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
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
            domain={[yMin, yMax]}
            tick={{ fill: '#6b7280', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: '#e2e4e8', strokeWidth: 1 }}
          />
          <Line
            type="monotone"
            dataKey="index"
            stroke="#2563eb"
            strokeWidth={1.5}
            dot={<CustomDot dataLength={data.length} />}
            activeDot={{ r: 4, fill: '#2563eb', stroke: '#ffffff', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
