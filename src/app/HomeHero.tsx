'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'

type Artist = {
  id: string
  name: string
  thumbnail_url: string | null
  current_index: number
}

const HERO_COUNT = 12  // アイコン行に並べる人数

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
      <polyline
        points={pts}
        fill="none"
        stroke={rising ? '#22c55e' : '#ef4444'}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

function MiniSparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const w = 64, h = 24
  const rising = values.at(-1)! >= values[0]
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`)
    .join(' ')
  return (
    <svg width={w} height={h} className="overflow-visible flex-shrink-0">
      <polyline
        points={pts}
        fill="none"
        stroke={rising ? '#22c55e' : '#ef4444'}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function HomeHero({
  artists,
  histories,
}: {
  artists: Artist[]
  histories: Record<string, number[]>
}) {
  const heroArtists = artists.slice(0, HERO_COUNT)
  const [selectedId, setSelectedId] = useState(heroArtists[0]?.id ?? null)
  const [fading, setFading] = useState(false)
  const [query, setQuery] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function selectArtist(id: string) {
    if (id === selectedId || fading) return
    setFading(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setSelectedId(id)
      setFading(false)
    }, 160)
  }

  const selected = artists.find(a => a.id === selectedId) ?? heroArtists[0]
  const hist = selected ? (histories[selected.id] ?? []) : []
  const latest = hist.at(-1) ?? selected?.current_index ?? 0
  const prev = hist.at(-2)
  const rising = prev === undefined || latest >= prev
  const changePct = prev ? ((latest - prev) / prev) * 100 : null

  const filtered = query.trim()
    ? artists.filter(a => a.name.toLowerCase().includes(query.toLowerCase()))
    : artists

  return (
    <div>
      {/* ── ヒーローセクション ── */}
      <div className="mb-8">

        {/* アイコン行 */}
        <div className="flex gap-3 overflow-x-auto pb-3 mb-4 scrollbar-hide">
          {heroArtists.map((artist) => {
            const isSelected = artist.id === selectedId
            return (
              <button
                key={artist.id}
                onClick={() => selectArtist(artist.id)}
                className={`flex-shrink-0 transition-all duration-200 outline-none group ${
                  isSelected ? 'scale-110' : 'opacity-50 hover:opacity-80 hover:scale-105'
                }`}
                title={artist.name}
              >
                <div className={`rounded-full transition-all duration-200 ${
                  isSelected
                    ? 'ring-2 ring-offset-2 ring-mga'
                    : ''
                }`}>
                  {artist.thumbnail_url ? (
                    <Image
                      src={artist.thumbnail_url}
                      alt={artist.name}
                      width={52}
                      height={52}
                      className="rounded-full w-13 h-13 object-cover"
                    />
                  ) : (
                    <div className="w-13 h-13 rounded-full bg-border" />
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* パネル */}
        {selected && (
          <div
            className={`bg-surface border border-border rounded-2xl p-5 transition-all duration-200 ${
              fading ? 'opacity-0 translate-y-1' : 'opacity-100 translate-y-0'
            }`}
          >
            <div className="flex items-start gap-4">
              {/* 左: アイコン + テキスト */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {selected.thumbnail_url ? (
                  <Image
                    src={selected.thumbnail_url}
                    alt={selected.name}
                    width={64}
                    height={64}
                    className="rounded-full flex-shrink-0"
                  />
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
                      {changePct !== null
                        ? ` ${Math.abs(changePct).toFixed(2)}%`
                        : ' —'}
                    </span>
                    <span className="text-xs text-dim">前日比</span>
                  </div>
                </div>
              </div>

              {/* 右: 詳細リンク */}
              <Link
                href={`/artist/${selected.id}`}
                className="flex-shrink-0 text-xs text-dim border border-border rounded-lg px-3 py-1.5 hover:border-dim hover:text-text transition-colors"
              >
                詳細 →
              </Link>
            </div>

            {/* スパークライン */}
            {hist.length >= 2 && (
              <div className={`mt-4 ${rising ? 'text-green-500' : 'text-red-400'}`}>
                <Sparkline values={hist} rising={rising} />
              </div>
            )}
            {hist.length < 2 && (
              <p className="mt-4 text-xs text-dim">指数データ蓄積中...</p>
            )}
          </div>
        )}
      </div>

      {/* ── 検索 + 一覧 ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">アーティスト一覧</h2>
          <input
            type="text"
            placeholder="名前で検索..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="bg-white border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-dim transition-colors w-44"
          />
        </div>

        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          {filtered.map((artist, i) => {
            const h = histories[artist.id] ?? []
            const val = h.at(-1) ?? artist.current_index
            const p = h.at(-2)
            const up = p === undefined || val >= p
            const pct = p ? ((val - p) / p) * 100 : null
            const rank = artists.indexOf(artist) + 1

            return (
              <Link key={artist.id} href={`/artist/${artist.id}`}>
                <div className={`flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-surface2/50 transition-colors ${i % 2 === 0 ? '' : 'bg-surface2/30'}`}>
                  <span className="text-xs text-dim tabular-nums w-6 text-right flex-shrink-0">
                    {rank}
                  </span>
                  {artist.thumbnail_url ? (
                    <Image
                      src={artist.thumbnail_url}
                      alt={artist.name}
                      width={32}
                      height={32}
                      className="rounded-full flex-shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-border flex-shrink-0" />
                  )}
                  <span className="flex-1 text-sm font-medium truncate">{artist.name}</span>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {pct !== null && (
                      <span className={`text-xs tabular-nums ${up ? 'text-green-500' : 'text-red-400'}`}>
                        {up ? '+' : ''}{pct.toFixed(2)}%
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
