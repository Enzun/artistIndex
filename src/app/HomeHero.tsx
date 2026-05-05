'use client'

import { useState, useRef, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'

type Artist = {
  id: string
  name: string
  thumbnail_url: string | null
  current_index: number
}

type RankType = 'index' | 'daily' | 'monthly'
type Phase = 'visible' | 'exit' | 'enter'

const HERO_COUNT = 5

const RANK_TABS: { key: RankType; label: string }[] = [
  { key: 'index',   label: '指数値' },
  { key: 'daily',   label: '前日比' },
  { key: 'monthly', label: '1ヶ月' },
]

function getScore(artist: Artist, hist: number[], type: RankType): number {
  if (type === 'index') return artist.current_index
  const last  = hist.at(-1) ?? artist.current_index
  if (type === 'daily') {
    const prev = hist.at(-2)
    return prev && prev > 0 ? (last - prev) / prev * 100 : 0
  }
  // monthly
  const first = hist[0]
  return first && first > 0 ? (last - first) / first * 100 : 0
}

function rankLabel(score: number, type: RankType): string {
  if (type === 'index') return Math.floor(score).toLocaleString() + ' pt'
  return (score >= 0 ? '+' : '') + score.toFixed(2) + '%'
}

function getTopArtists(
  artists: Artist[],
  histories: Record<string, number[]>,
  type: RankType,
): Artist[] {
  return [...artists]
    .sort((a, b) => getScore(b, histories[b.id] ?? [], type) - getScore(a, histories[a.id] ?? [], type))
    .slice(0, HERO_COUNT)
}

// ── Sparkline ──────────────────────────────────────────────────────────────

function Sparkline({ values, rising }: { values: number[]; rising: boolean }) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const w = 240, h = 52
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / range) * (h - 8) - 4}`)
    .join(' ')
  return (
    <svg width={w} height={h} className="overflow-visible w-full" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline points={pts} fill="none"
        stroke={rising ? '#22c55e' : '#ef4444'}
        strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function MiniSparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const w = 64, h = 24
  const rising = (values.at(-1) ?? 0) >= (values[0] ?? 0)
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`)
    .join(' ')
  return (
    <svg width={w} height={h} className="overflow-visible flex-shrink-0">
      <polyline points={pts} fill="none"
        stroke={rising ? '#22c55e' : '#ef4444'}
        strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function HomeHero({
  artists,
  histories,
  isPreview = false,
}: {
  artists: Artist[]
  histories: Record<string, number[]>
  isPreview?: boolean
}) {
  const [rankType, setRankType]   = useState<RankType>('index')
  const [heroList, setHeroList]   = useState<Artist[]>(() => getTopArtists(artists, histories, 'index'))
  const [selectedId, setSelectedId] = useState<string | null>(heroList[0]?.id ?? null)
  const [phase, setPhase]         = useState<Phase>('visible')
  const [query, setQuery]         = useState('')
  const transitioning = useRef(false)

  // ランキング切り替え（スライドアニメーション付き）
  const changeRank = useCallback((newType: RankType) => {
    if (newType === rankType || transitioning.current) return
    transitioning.current = true

    setPhase('exit')
    setTimeout(() => {
      const newList = getTopArtists(artists, histories, newType)
      setRankType(newType)
      setHeroList(newList)
      setSelectedId(newList[0]?.id ?? null)
      setPhase('enter')
      // enter → visible: 次フレームで transition を開始
      setTimeout(() => {
        setPhase('visible')
        transitioning.current = false
      }, 30)
    }, 220)
  }, [rankType, artists, histories])

  // パネル内アーティスト切り替え（フェード）
  const [panelFading, setPanelFading] = useState(false)
  const panelTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function selectArtist(id: string) {
    if (id === selectedId || panelFading) return
    setPanelFading(true)
    if (panelTimer.current) clearTimeout(panelTimer.current)
    panelTimer.current = setTimeout(() => {
      setSelectedId(id)
      setPanelFading(false)
    }, 160)
  }

  // 選択中アーティスト情報
  const selected = artists.find(a => a.id === selectedId) ?? heroList[0]
  const hist = selected ? (histories[selected.id] ?? []) : []
  const latest  = hist.at(-1) ?? selected?.current_index ?? 0
  const prev    = hist.at(-2)
  const rising  = prev === undefined || latest >= prev
  const changePct = prev ? ((latest - prev) / prev) * 100 : null

  // アイコン行 CSS
  const iconRowClass = [
    'flex gap-5 justify-center py-3 mb-4',
    'transition-all duration-220',
    phase === 'exit'    ? 'opacity-0 -translate-x-8 pointer-events-none' : '',
    phase === 'enter'   ? 'opacity-0  translate-x-8' : '',
    phase === 'visible' ? 'opacity-100 translate-x-0' : '',
  ].join(' ')

  // 検索 + ランキングソート
  const sortedAll = [...artists].sort(
    (a, b) => getScore(b, histories[b.id] ?? [], rankType) - getScore(a, histories[a.id] ?? [], rankType)
  )
  const filtered = isPreview
    ? sortedAll.slice(0, 7)
    : query.trim()
    ? sortedAll.filter(a => a.name.toLowerCase().includes(query.toLowerCase()))
    : sortedAll

  return (
    <div>
      {/* ── ヒーローセクション ── */}
      <div className="mb-8">

        {/* ランキングタイトル + タブ */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">ランキング</h2>
          <div className="flex gap-1 bg-surface border border-border rounded-lg p-0.5">
            {RANK_TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => changeRank(key)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all duration-150 ${
                  rankType === key
                    ? 'bg-text text-bg shadow-sm'
                    : 'text-dim hover:text-text'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* アイコン行 */}
        <div className={iconRowClass}>
          {heroList.map((artist, rank) => {
            const isSelected = artist.id === selectedId
            const score = getScore(artist, histories[artist.id] ?? [], rankType)
            return (
              <button
                key={artist.id}
                onClick={() => selectArtist(artist.id)}
                className="flex flex-col items-center gap-1.5 outline-none group"
                title={artist.name}
              >
                <div className={`transition-all duration-200 rounded-full ${
                  isSelected
                    ? 'ring-2 ring-offset-2 ring-mga scale-110'
                    : 'opacity-55 group-hover:opacity-90 group-hover:scale-105'
                }`}>
                  {artist.thumbnail_url ? (
                    <Image
                      src={artist.thumbnail_url}
                      alt={artist.name}
                      width={56}
                      height={56}
                      className="rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-border" />
                  )}
                </div>
                <span className={`text-xs tabular-nums transition-colors ${
                  isSelected ? 'text-text font-medium' : 'text-dim'
                }`}>
                  {rankType === 'index'
                    ? `#${rank + 1}`
                    : (score >= 0 ? '+' : '') + score.toFixed(1) + '%'}
                </span>
              </button>
            )
          })}
        </div>

        {/* パネル */}
        {selected && (
          <div className={`bg-surface border border-border rounded-2xl p-5 transition-all duration-160 ${
            panelFading ? 'opacity-0 translate-y-1' : 'opacity-100 translate-y-0'
          }`}>
            <div className="flex items-start gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {selected.thumbnail_url ? (
                  <Image src={selected.thumbnail_url} alt={selected.name}
                    width={64} height={64} className="rounded-full flex-shrink-0" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-border flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-xs text-dim mb-0.5 truncate">{selected.name}</p>
                  <p className="text-4xl font-bold tabular-nums leading-none">
                    {Math.floor(latest).toLocaleString()}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className={`text-xs font-medium tabular-nums ${rising ? 'text-green-500' : 'text-red-400'}`}>
                      {rising ? '▲' : '▼'}
                      {changePct !== null ? ` ${Math.abs(changePct).toFixed(2)}%` : ' —'}
                      {prev !== undefined && (
                        <span className="ml-1">
                          ({rising ? '+' : ''}{Math.floor(latest - prev).toLocaleString()} pt)
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-dim">前日比</span>
                  </div>
                </div>
              </div>
              <Link
                href={`/artist/${selected.id}`}
                className="flex-shrink-0 text-xs text-dim border border-border rounded-lg px-3 py-1.5 hover:border-dim hover:text-text transition-colors"
              >
                詳細 →
              </Link>
            </div>
            {hist.length >= 2 ? (
              <div className={`mt-4 ${rising ? 'text-green-500' : 'text-red-400'}`}>
                <Sparkline values={hist} rising={rising} />
              </div>
            ) : (
              <p className="mt-4 text-xs text-dim">指数データ蓄積中...</p>
            )}
          </div>
        )}
      </div>

      {/* ── 検索 + 一覧 ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold">アーティスト一覧</h2>
            {isPreview && <p className="text-xs text-dim mt-0.5">🔒 売買するには登録が必要です</p>}
          </div>
          {!isPreview && (
            <input
              type="text"
              placeholder="名前で検索..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="bg-white border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-dim transition-colors w-44"
            />
          )}
        </div>

        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          {filtered.map((artist, i) => {
            const h    = histories[artist.id] ?? []
            const val  = h.at(-1) ?? artist.current_index
            const p    = h.at(-2)
            const up   = p === undefined || val >= p
            const pct  = p ? ((val - p) / p) * 100 : null
            const rank = sortedAll.indexOf(artist) + 1
            const score = getScore(artist, h, rankType)

            return (
              <Link key={artist.id} href={`/artist/${artist.id}`}>
                <div className={`flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-surface2/50 transition-colors ${i % 2 === 0 ? '' : 'bg-surface2/30'}`}>
                  <span className="text-xs text-dim tabular-nums w-6 text-right flex-shrink-0">{rank}</span>
                  {artist.thumbnail_url ? (
                    <Image src={artist.thumbnail_url} alt={artist.name}
                      width={32} height={32} className="rounded-full flex-shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-border flex-shrink-0" />
                  )}
                  <span className="flex-1 text-sm font-medium truncate">{artist.name}</span>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {rankType === 'index' && pct !== null && (
                      <span className={`text-xs tabular-nums ${up ? 'text-green-500' : 'text-red-400'}`}>
                        {up ? '+' : ''}{pct.toFixed(2)}%
                      </span>
                    )}
                    {rankType !== 'index' && (
                      <span className={`text-xs tabular-nums ${score >= 0 ? 'text-green-500' : 'text-red-400'}`}>
                        {rankLabel(score, rankType)}
                      </span>
                    )}
                    <span className="text-sm font-bold tabular-nums w-20 text-right">
                      {Math.floor(val).toLocaleString()}
                    </span>
                    <div className={up ? 'text-green-500' : 'text-red-400'}>
                      <MiniSparkline values={h} />
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
          {filtered.length === 0 && (
            <div className="px-4 py-8 text-center text-dim text-xs">
              「{query}」に一致するアーティストはいません
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
