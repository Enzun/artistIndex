'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getShape, getColorPosition, positionToColor, SHAPE_EMOJI, SHAPE_RANGES, MAX_PER_SHAPE } from '@/lib/titles'
import {
  ACHIEVEMENT_LABELS, BAGGER_THRESHOLDS, SCALE_THRESHOLDS,
  ARTIST_ACHIEVEMENT_LABELS, ARTIST_ACHIEVEMENT_EMOJI, ARTIST_ACHIEVEMENT_CONDITIONS,
  type ArtistAchievementCode,
} from '@/lib/achievements'

type Title = { id: string; points_spent: number; created_at: string; showcase_order: number | null }
type Achievement = { type: string; achieved_at: string }
type ArtistAchievement = {
  type: string
  achieved_at: string
  artist_id: string
  artist: { name: string } | { name: string }[] | null
}

type Props = {
  titles: Title[]
  freePoints: number
  achievements: Achievement[]
  artistAchievements: ArtistAchievement[]
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

export default function TitlesClient({ titles: initialTitles, freePoints: initialPoints, achievements, artistAchievements }: Props) {
  const [titles, setTitles]         = useState(initialTitles)
  const [freePoints, setFreePoints] = useState(initialPoints)
  const [input, setInput]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [pickerSlot, setPickerSlot] = useState<number | null>(null)
  const [shareMsg, setShareMsg]     = useState('')
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

  async function handleShare() {
    const showcased = [1, 2, 3]
      .map(slot => titles.find(t => t.showcase_order === slot))
      .filter(Boolean) as Title[]

    if (showcased.length === 0) {
      setShareMsg('称号をスロットにセットしてからシェアしてください')
      setTimeout(() => setShareMsg(''), 3000)
      return
    }

    const titleText = showcased
      .map(t => `${SHAPE_EMOJI[getShape(t.points_spent)]} ${getShape(t.points_spent)}（${t.points_spent.toLocaleString()}pt）`)
      .join(' / ')
    const text = `称号コレクション\n${titleText}`
    const url  = 'https://artist-index.vercel.app/'

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: 'artistIndex 称号', text, url })
        setShareMsg('シェアしました')
      } catch {
        // キャンセルは無視
      }
    } else {
      // フォールバック: Xに投稿
      const xUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(text + '\n' + url)}`
      window.open(xUrl, '_blank', 'noopener')
    }
    setTimeout(() => setShareMsg(''), 3000)
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
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-dim font-medium">シェア用称号（最大3つ）</p>
          <div className="flex items-center gap-2">
            {shareMsg && <span className="text-xs text-dim">{shareMsg}</span>}
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 text-xs border border-border rounded-lg px-3 py-1.5 text-dim hover:border-dim hover:text-text transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              シェア
            </button>
          </div>
        </div>
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
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-sm font-semibold">称号を獲得する</h2>
          <span className="text-xs text-dim">同じ形状は3つまで</span>
        </div>
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

      {/* 購入称号 */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold">購入称号</h2>
          <span className="text-xs text-dim">× で完全削除</span>
        </div>
        {titles.length === 0 ? (
          <p className="text-dim text-sm text-center py-8">まだ称号がありません</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {[...titles].sort((a, b) => a.points_spent - b.points_spent).map(t => (
              <TitleBadge
                key={t.id}
                pts={t.points_spent}
                onDiscard={() => handleDiscard(t.id, t.points_spent)}
              />
            ))}
          </div>
        )}
      </div>

      {/* アーティスト称号 */}
      <div className="mb-10">
        <h2 className="text-sm font-semibold mb-4">アーティスト称号</h2>
        <div className="flex flex-col gap-2">
          {(
            [
              'ultra_watcher', 'watcher', 'digger', 'pioneer',
              'holder_1m', 'holder_3m', 'holder_6m', 'holder_1y',
            ] as ArtistAchievementCode[]
          ).flatMap(code => {
            const achieved = artistAchievements.filter(a => a.type === code)
            if (achieved.length > 0) {
              return achieved.map((ach, i) => {
                const artistName = (Array.isArray(ach.artist) ? ach.artist[0]?.name : ach.artist?.name) ?? '—'
                return (
                  <div key={`${code}-${i}`} className="flex items-center gap-3 bg-surface border border-border rounded-xl px-4 py-3">
                    <span className="text-xl flex-shrink-0">{ARTIST_ACHIEVEMENT_EMOJI[code]}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{ARTIST_ACHIEVEMENT_LABELS[code]}</p>
                      <p className="text-xs text-dim truncate">{artistName}</p>
                    </div>
                    <span className="ml-auto text-xs text-dim flex-shrink-0">{ach.achieved_at.split('T')[0]}</span>
                  </div>
                )
              })
            }
            return [(
              <div key={code} className="flex items-center gap-3 bg-surface border border-border rounded-xl px-4 py-3 opacity-40">
                <span className="text-xl flex-shrink-0">{ARTIST_ACHIEVEMENT_EMOJI[code]}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{ARTIST_ACHIEVEMENT_LABELS[code]}</p>
                  <p className="text-xs text-dim">{ARTIST_ACHIEVEMENT_CONDITIONS[code]}</p>
                </div>
              </div>
            )]
          })}
        </div>
      </div>

      {/* 実績称号 */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold mb-4">実績称号</h2>

        {/* バガー系 */}
        <div className="mb-4">
          <p className="text-xs text-dim font-medium mb-2">📈 バガー（売却利益率）</p>
          <div className="grid grid-cols-2 gap-2">
            {BAGGER_THRESHOLDS.map(b => {
              const achieved = achievements.find(a => a.type === b.code)
              return (
                <div
                  key={b.code}
                  className={`rounded-xl border p-3 ${achieved ? 'border-orange-200 bg-orange-50' : 'border-border opacity-40'}`}
                >
                  <p className="text-sm font-medium">{ACHIEVEMENT_LABELS[b.code]}</p>
                  <p className="text-xs text-dim mt-0.5">
                    {achieved ? achieved.achieved_at.split('T')[0] : `+${Math.round((b.multiplier - 1) * 100)}%以上で売却`}
                  </p>
                </div>
              )
            })}
          </div>
        </div>

        {/* 規模系 */}
        <div>
          <p className="text-xs text-dim font-medium mb-2">💰 規模（1回の購入額）</p>
          <div className="grid grid-cols-2 gap-2">
            {SCALE_THRESHOLDS.map(s => {
              const achieved = achievements.find(a => a.type === s.code)
              return (
                <div
                  key={s.code}
                  className={`rounded-xl border p-3 ${achieved ? 'border-text/20 bg-surface2' : 'border-border opacity-40'}`}
                >
                  <p className="text-sm font-medium">{ACHIEVEMENT_LABELS[s.code]}</p>
                  <p className="text-xs text-dim mt-0.5">
                    {achieved ? achieved.achieved_at.split('T')[0] : `${s.minPoints.toLocaleString()}pt以上を購入`}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </div>

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
