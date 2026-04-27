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
  ReferenceLine,
} from 'recharts'
import type { TooltipProps } from 'recharts'

type Snapshot = { snapshot_date: string; index_value: number | null; daily_increase?: number | null }

const K = 3
const BASELINE = 180

// daily_increase だけを使って A2 式をその場で計算（DB書き込みなし）
// 開始日=100pt で正規化。初日 daily_increase=0 でも起点として使う
function calcPreview(snapshots: Snapshot[]): { date: string; index: number }[] {
  const data = snapshots
    .filter(s => s.daily_increase != null)
    .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))
  if (data.length < 1) return []

  const result: { date: string; index: number }[] = []
  let idx = 100
  result.push({ date: data[0].snapshot_date, index: 100 })

  for (let i = 1; i < data.length; i++) {
    const d = data[i].daily_increase ?? 0
    if (d > 0) {
      const hist = data.slice(Math.max(0, i - BASELINE), i).filter(r => (r.daily_increase ?? 0) > 0)
      if (hist.length > 0) {
        const B = hist.reduce((s, r) => s + (r.daily_increase ?? 0), 0) / hist.length
        idx = idx * Math.pow(d / B, K / 365)
      }
    }
    result.push({ date: data[i].snapshot_date, index: Math.round(idx * 100) / 100 })
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

function CustomTooltip({ active, payload }: TooltipProps<number, string> & { payload?: Array<{ payload: { date: string; index: number } }> }) {
  if (!active || !payload?.length) return null
  const { date, index } = payload[0].payload as { date: string; index: number }
  return (
    <div className="bg-white border border-border rounded-lg px-3 py-2 shadow-lg text-xs">
      <p className="text-dim mb-1">{formatDate(date)}</p>
      <p className="text-text font-bold tabular-nums text-sm">{index.toFixed(1)} pt</p>
    </div>
  )
}

function CustomDot(props: { cx?: number; cy?: number; index?: number; dataLength?: number }) {
  const { cx, cy, index, dataLength } = props
  if (index !== (dataLength ?? 0) - 1) return null
  return <circle cx={cx} cy={cy} r={4} fill="#2563eb" stroke="#ffffff" strokeWidth={2} />
}

// 取得開始日=100ptに正規化したA2指数プレビュー
// index_value がない場合は daily_increase から A2 式でその場計算
export default function AdminIndexChart({ snapshots }: { snapshots: Snapshot[] }) {
  const [period, setPeriod] = useState<typeof PERIODS[number]['label']>('ALL')

  const withValue = snapshots.filter(s => s.index_value !== null)
  const useCalc = withValue.length === 0  // index_value が全 NULL → daily_increase から計算

  // index_value あり: 先頭=100pt に正規化
  // index_value なし: A2 式でその場計算
  const firstVal = withValue[0]?.index_value ?? null
  const allData: { date: string; index: number }[] = useCalc
    ? calcPreview(snapshots)
    : withValue.map(s => ({
        date: s.snapshot_date,
        index: firstVal ? (s.index_value! / firstVal) * 100 : s.index_value!,
      }))

  const selectedDays = PERIODS.find(p => p.label === period)?.days ?? Infinity
  const cutoff = selectedDays === Infinity
    ? ''
    : new Date(Date.now() - selectedDays * 86400_000).toISOString().split('T')[0]

  const data = cutoff ? allData.filter(d => d.date >= cutoff) : allData

  if (allData.length < 2) {
    return (
      <div className="bg-surface border border-border rounded-xl p-4 mb-4 h-36 flex items-center justify-center">
        <p className="text-dim text-xs">データ蓄積中 ({withValue.length}件)</p>
      </div>
    )
  }

  const values = data.map(d => d.index)
  const minVal = Math.min(...values)
  const maxVal = Math.max(...values)
  const pad = (maxVal - minVal) * 0.12 || maxVal * 0.05
  const yMin = Math.floor(minVal - pad)
  const yMax = Math.ceil(maxVal + pad)

  const tickCount = Math.min(6, data.length)
  const step = Math.floor((data.length - 1) / Math.max(tickCount - 1, 1))
  const xTicks = Array.from({ length: tickCount }, (_, i) =>
    data[Math.min(i * step, data.length - 1)].date,
  )

  const availableDays = allData.length > 0
    ? Math.ceil((new Date(allData.at(-1)!.date).getTime() - new Date(allData[0].date).getTime()) / 86400_000)
    : 0

  const latest = data.at(-1)?.index ?? 100
  const latestChange = latest - 100
  const latestChangePct = latestChange

  return (
    <div className="bg-surface border border-border rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-dim">
          {useCalc ? '指数プレビュー（再生数から計算・取得開始日=100pt）' : '指数推移（プレビュー・取得開始日=100pt）'}
        </p>
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
      <p className={`text-xs mb-3 tabular-nums ${latestChange >= 0 ? 'text-mga' : 'text-accent'}`}>
        現在: {latest.toFixed(1)} pt ({latestChange >= 0 ? '+' : ''}{latestChangePct.toFixed(1)}%)
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
          <ReferenceLine y={100} stroke="#e2e4e8" strokeDasharray="4 2" />
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
