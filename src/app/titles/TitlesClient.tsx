'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getShape, getColorPosition, positionToColor, SHAPE_EMOJI, SHAPE_RANGES, MAX_PER_SHAPE } from '@/lib/titles'

type Title = { id: string; points_spent: number; created_at: string; showcase_order: number | null }

type Props = {
  titles: Title[]
  freePoints: number
}

function TitleBadge({ pts, onDiscard, compact }: { pts: number; onDiscard?: () => void; compact?: boolean }) {
  const shape = getShape(pts)
  const pos   = getColorPosition(pts)
  const color = positionToColor(pos)
  const emoji = SHAPE_EMOJI[shape]

  if (compact) {
    return (
      <div
        className="flex flex-col items-center gap-0.5 p-2 rounded-xl border w-full"
        style={{ borderColor: color, background: `${color}18` }}
      >
        <span className="text-2xl">{emoji}</span>
        <span className="text-xs font-medium leading-tight text-center" style={{ color }}>{shape}</span>
        <span className="text-xs text-dim tabular-nums">{pts.toLocaleString()}pt</span>
      </div>
    )
  }

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

// ── ショーケーススロット ────────────────────────────────────────────────────

function ShowcaseSlot({
  slot,
  title,
  onClick,
  onRemove,
}: {
  slot: number
  title: Title | null
  onClick: () => void
  onRemove: () => void
}) {
  if (!title) {
    return (
      <button
        onClick={onClick}
        className="flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border h-24 w-full hover:border-dim transition-colors text-dim"
      >
        <span className="text-xl">＋</span>
        <span className="text-xs">スロット {slot}</span>
      </button>
    )
  }

  const shape = getShape(title.points_spent)
  const color = positionToColor(getColorPosition(title.points_spent))

  return (
    <div className="relative">
      <button onClick={onClick} className="w-full">
        <TitleBadge pts={title.points_spent} compact />
      </button>
      <button
        onClick={e => { e.stopPropagation(); onRemove() }}
        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-surface border border-border text-dim hover:text-accent transition-colors text-xs flex items-center justify-center"
        title="外す"
      >
        ✕
      </button>
    </div>
  )
}

// ── ピッカーモーダル ──────────────────────────────────────────────────────

function TitlePicker({
  titles,
  currentId,
  onSelect,
  onClose,
}: {
  titles: Title[]
  currentId: string | null
  onSelect: (title: Title) => void
  onClose: () => void
}) {
  const shapeOrder = SHAPE_RANGES.map(r => r.shape)
  const grouped = shapeOrder
    .map(shape => ({ shape, items: titles.filter(t => getShape(t.points_spent) === shape) }))
    .filter(g => g.items.length > 0)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-bg border border-border rounded-2xl p-5 w-full max-w-sm max-h-[70vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold">称号を選ぶ</p>
          <button onClick={onClose} className="text-dim hover:text-text transition-colors text-sm">✕</button>
        </div>
        {grouped.length === 0 ? (
          <p className="text-dim text-sm text-center py-6">称号がありません</p>
        ) : (
          <div className="flex flex-col gap-4">
            {grouped.map(({ shape, items }) => (
              <div key={shape}>
                <p className="text-xs text-dim mb-2">{SHAPE_EMOJI[shape]} {shape}</p>
                <div className="grid grid-cols-3 gap-2">
                  {items.map(t => {
                    const color = positionToColor(getColorPosition(t.points_spent))
                    const isSelected = t.id === currentId
                    return (
                      <button
                        key={t.id}
                        onClick={() => onSelect(t)}
                        className="relative rounded-xl border-2 transition-all"
                        style={{
                          borderColor: isSelected ? color : 'transparent',
                          outline: isSelected ? `2px solid ${color}` : 'none',
                        }}
                      >
                        <TitleBadge pts={t.points_spent} compact />
                        {isSelected && (
                          <span className="absolute top-1 right-1 text-xs" style={{ color }}>✓</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── メインコンポーネント ──────────────────────────────────────────────────

export default function TitlesClient({ titles: initialTitles, freePoints: initialPoints }: Props) {
  const [titles, setTitles]         = useState(initialTitles)
  const [freePoints, setFreePoints] = useState(initialPoints)
  const [input, setInput]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [pickerSlot, setPickerSlot] = useState<number | null>(null)  // 開いているスロット番号
  const router = useRouter()

  const pts = parseInt(input) || 0

  const previewShape    = pts >= 1 && pts <= 999999 ? getShape(pts) : null
  const previewPos      = previewShape ? getColorPosition(pts) : 0
  const previewColor    = previewShape ? positionToColor(previewPos) : ''
  const sameShapeOwned  = previewShape ? titles.filter(t => getShape(t.points_spent) === previewShape).length : 0
  const canBuy          = previewShape && pts <= freePoints && sameShapeOwned < MAX_PER_SHAPE

  const shapeOrder = SHAPE_RANGES.map(r => r.shape)
  const grouped = shapeOrder
    .map(shape => ({ shape, items: titles.filter(t => getShape(t.points_spent) === shape) }))
    .filter(g => g.items.length > 0)

  // ショーケース: スロット1〜3
  const showcaseSlots = [1, 2, 3].map(slot =>
    titles.find(t => t.showcase_order === slot) ?? null
  )

  async function handleSetShowcase(titleId: string, slot: number) {
    const res = await fetch(`/api/titles/${titleId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ showcase_order: slot }),
    })
    if (res.ok) {
      setTitles(prev => prev.map(t => {
        if (t.showcase_order === slot && t.id !== titleId) return { ...t, showcase_order: null }
        if (t.id === titleId) return { ...t, showcase_order: slot }
        return t
      }))
    }
    setPickerSlot(null)
  }

  async function handleRemoveShowcase(titleId: string) {
    const res = await fetch(`/api/titles/${titleId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ showcase_order: null }),
    })
    if (res.ok) {
      setTitles(prev => prev.map(t => t.id === titleId ? { ...t, showcase_order: null } : t))
    }
  }

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
      setTitles(prev => [{ ...data, showcase_order: null }, ...prev])
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

  const pickerCurrentId = pickerSlot !== null
    ? (titles.find(t => t.showcase_order === pickerSlot)?.id ?? null)
    : null

  return (
    <div>
      {/* ショーケース */}
      <div className="mb-6">
        <p className="text-xs text-dim font-medium mb-3">シェア用称号（最大3つ）</p>
        <div className="grid grid-cols-3 gap-3">
          {showcaseSlots.map((title, i) => (
            <ShowcaseSlot
              key={i}
              slot={i + 1}
              title={title}
              onClick={() => setPickerSlot(i + 1)}
              onRemove={() => title && handleRemoveShowcase(title.id)}
            />
          ))}
        </div>
      </div>

      {/* 所持ポイント */}
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
                {sameShapeOwned >= MAX_PER_SHAPE && <span className="text-accent ml-1">（上限: 1個捨てる必要あり）</span>}
                {pts > freePoints && <span className="text-accent ml-1">（ポイント不足）</span>}
              </p>
            )}
          </div>
          {previewShape && <div className="flex-shrink-0"><TitleBadge pts={pts} /></div>}
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

      {/* ピッカーモーダル */}
      {pickerSlot !== null && (
        <TitlePicker
          titles={titles}
          currentId={pickerCurrentId}
          onSelect={t => handleSetShowcase(t.id, pickerSlot)}
          onClose={() => setPickerSlot(null)}
        />
      )}
    </div>
  )
}
