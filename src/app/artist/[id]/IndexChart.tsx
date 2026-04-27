'use client'

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

type Snapshot = { snapshot_date: string; index_value: number | null }

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

function formatDateShort(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

function CustomTooltip({ active, payload }: TooltipProps<number, string> & { payload?: Array<{ payload: { date: string; index: number } }> }) {
  if (!active || !payload?.length) return null
  const { date, index } = payload[0].payload as { date: string; index: number }
  return (
    <div className="bg-white border border-border rounded-lg px-3 py-2 shadow-lg text-xs">
      <p className="text-dim mb-1">{formatDate(date)}</p>
      <p className="text-text font-bold tabular-nums text-sm">{Math.floor(index)}</p>
    </div>
  )
}

function CustomDot(props: {
  cx?: number; cy?: number; index?: number; dataLength?: number
}) {
  const { cx, cy, index, dataLength } = props
  if (index !== (dataLength ?? 0) - 1) return null
  return <circle cx={cx} cy={cy} r={4} fill="#16a34a" stroke="#ffffff" strokeWidth={2} />
}

export default function IndexChart({ snapshots }: { snapshots: Snapshot[] }) {
  const data = snapshots
    .filter((s) => s.index_value !== null)
    .map((s) => ({ date: s.snapshot_date, index: s.index_value as number }))

  if (data.length < 2) {
    return (
      <div className="bg-surface border border-border rounded-xl p-4 mb-6 h-36 flex items-center justify-center">
        <p className="text-dim text-xs">データ蓄積中...</p>
      </div>
    )
  }

  const values = data.map((d) => d.index)
  const minVal = Math.min(...values)
  const maxVal = Math.max(...values)
  const pad = (maxVal - minVal) * 0.12
  const yMin = Math.floor(minVal - pad)
  const yMax = Math.ceil(maxVal + pad)

  // X軸ティック: データ数に応じて間引く（最大6本）
  const tickCount = Math.min(6, data.length)
  const step = Math.floor((data.length - 1) / (tickCount - 1))
  const xTicks = Array.from({ length: tickCount }, (_, i) =>
    data[Math.min(i * step, data.length - 1)].date,
  )

  return (
    <div className="bg-surface border border-border rounded-xl p-4 mb-6">
      <p className="text-xs text-dim mb-4">指数推移</p>
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
            stroke="#16a34a"
            strokeWidth={1.5}
            dot={<CustomDot dataLength={data.length} />}
            activeDot={{ r: 4, fill: '#16a34a', stroke: '#ffffff', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
