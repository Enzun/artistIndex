'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getShape, getColorPosition, positionToColor, SHAPE_EMOJI, SHAPE_RANGES, MAX_PER_SHAPE } from '@/lib/titles'

type Title = { id: string; points_spent: number; created_at: string }

type Props = {
  titles: Title[]
  freePoints: number
}

function TitleBadge({ pts, onDiscard }: { pts: number; onDiscard?: () => void }) {
  const shape  = getShape(pts)
  const pos    = getColorPosition(pts)
  const color  = positionToColor(pos)
  const emoji  = SHAPE_EMOJI[shape]

  return (
    <div
      className="relative flex flex-col items-center gap-1 p-3 rounded-xl border"
      style={{ borderColor: color, background: `${color}18` }}
    >
      <span className="text-3xl">{emoji}</span>
      <span className="text-xs font-medium" style={{ color }}>{shape}</span>
      <span className="text-xs text-dim tabular-nums">{pts.toLocaleString()} pt</span>
      {onDiscard && (
        <button
          onClick={onDiscard}
          className="absolute top-1 right-1 text-dim hover:text-accent transition-colors text-xs leading-none"
          title="捨てる"
        >
          ✕
        </button>
      )}
    </div>
  )
}

export default function TitlesClient({ titles: initialTitles, freePoints: initialPoints }: Props) {
  const [titles, setTitles]       = useState(initialTitles)
  const [freePoints, setFreePoints] = useState(initialPoints)
  const [input, setInput]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const router = useRouter()

  const pts = parseInt(input) || 0

  // 購入プレビュー
  const previewShape = pts >= 1 && pts <= 999999 ? getShape(pts) : null
  const previewPos   = previewShape ? getColorPosition(pts) : 0
  const previewColor = previewShape ? positionToColor(previewPos) : ''
  const sameShapeOwned = previewShape
    ? titles.filter(t => getShape(t.points_spent) === previewShape).length
    : 0
  const canBuy = previewShape && pts <= freePoints && sameShapeOwned < MAX_PER_SHAPE

  // 形ごとにグループ化
  const shapeOrder = SHAPE_RANGES.map(r => r.shape)
  const grouped = shapeOrder
    .map(shape => ({
      shape,
      items: titles.filter(t => getShape(t.points_spent) === shape),
    }))
    .filter(g => g.items.length > 0)

  async function handleBuy() {
    if (!canBuy) return
    setLoading(true)
    setError('')
    const res = await fetch('/api/titles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points_spent: pts }),
    })
    const data = await res.json()
    if (res.ok) {
      setTitles(prev => [data, ...prev])
      setFreePoints(p => p - pts)
      setInput('')
      router.refresh()
    } else {
      setError(data.error ?? '購入に失敗しました')
    }
    setLoading(false)
  }

  async function handleDiscard(id: string, pts: number) {
    if (!confirm(`${pts.toLocaleString()}ptの${getShape(pts)}を捨てますか？`)) return
    const res = await fetch(`/api/titles/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setTitles(prev => prev.filter(t => t.id !== id))
      router.refresh()
    }
  }

  return (
    <div>
      {/* ポイント残高 */}
      <p className="text-sm text-dim mb-6">所持ポイント: <span className="font-bold text-text tabular-nums">{freePoints.toLocaleString()} pt</span></p>

      {/* 購入フォーム */}
      <div className="bg-surface border border-border rounded-xl p-5 mb-8">
        <h2 className="text-sm font-semibold mb-4">称号を獲得する</h2>
        <div className="flex gap-3 items-start">
          <div className="flex-1">
            <input
              type="number"
              min={1}
              max={999999}
              value={input}
              onChange={e => { setInput(e.target.value); setError('') }}
              placeholder="消費ポイント数を入力"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-dim bg-white tabular-nums"
            />
            {error && <p className="text-xs text-accent mt-1">{error}</p>}
            {previewShape && (
              <p className="text-xs text-dim mt-1">
                → <span style={{ color: previewColor }} className="font-medium">{previewShape}</span>
                {sameShapeOwned >= MAX_PER_SHAPE && (
                  <span className="text-accent ml-1">（上限: 1個捨てる必要あり）</span>
                )}
                {pts > freePoints && (
                  <span className="text-accent ml-1">（ポイント不足）</span>
                )}
              </p>
            )}
          </div>

          {/* プレビューバッジ */}
          {previewShape && (
            <div className="flex-shrink-0">
              <TitleBadge pts={pts} />
            </div>
          )}

          <button
            onClick={handleBuy}
            disabled={loading || !canBuy}
            className="flex-shrink-0 bg-text text-bg rounded-lg px-4 py-2 text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? '処理中...' : '獲得'}
          </button>
        </div>
      </div>

      {/* 保有称号 */}
      {grouped.length === 0 ? (
        <p className="text-dim text-sm text-center py-12">まだ称号がありません</p>
      ) : (
        <div className="flex flex-col gap-6">
          {grouped.map(({ shape, items }) => (
            <div key={shape}>
              <p className="text-xs text-dim font-medium mb-3">
                {SHAPE_EMOJI[shape]} {shape}（{items.length}/{MAX_PER_SHAPE}）
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {items.map(t => (
                  <TitleBadge
                    key={t.id}
                    pts={t.points_spent}
                    onDiscard={() => handleDiscard(t.id, t.points_spent)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
