import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import type { ViewSnapshot } from '@/lib/types'
import AdminIndexChart from './AdminIndexChart'
import ViewsChart from '@/app/artist/[id]/ViewsChart'
import ActivateButton from './ActivateButton'
import { calcHIndex, DEFAULT_H_PARAMS, type SnapRow } from '@/lib/indexFormula'

export default async function AdminArtistPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: artist } = await supabase
    .from('artists')
    .select('*')
    .eq('id', id)
    .single()

  if (!artist) notFound()

  const { data: snapshots } = await supabase
    .from('view_snapshots')
    .select('id, artist_id, snapshot_date, index_value, daily_increase, total_views, wikipedia_pageviews')
    .eq('artist_id', id)
    .order('snapshot_date', { ascending: true })

  const snaps = (snapshots ?? []) as ViewSnapshot[]
  const totalSnaps = snaps.length
  const withIndex = snaps.filter(s => s.index_value !== null)
  const nullCount = totalSnaps - withIndex.length
  const firstSnap = snaps[0]?.snapshot_date ?? null
  const lastSnap = snaps.at(-1)?.snapshot_date ?? null
  const latestTotalViews = snaps.findLast(s => s.total_views)?.total_views ?? 0

  // H 式指数（最新値）
  const hParams = artist.index_scale
    ? { ...DEFAULT_H_PARAMS, SCALE: artist.index_scale }
    : DEFAULT_H_PARAMS
  const hIndex = calcHIndex(snaps as SnapRow[], hParams)

  // collecting: index_scale が保存済みならそれを使用
  const previewInitialIndex = artist.index_scale
    ? Math.floor(artist.index_scale).toLocaleString()
    : latestTotalViews
    ? Math.floor(Math.sqrt(latestTotalViews) * 10).toLocaleString()
    : null

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* ヘッダー */}
      <div className="flex items-center gap-2 mb-1">
        <Link href="/admin" className="text-xs text-dim hover:text-text transition-colors">
          ← Admin
        </Link>
      </div>

      <div className="flex items-start justify-between mb-6 mt-3">
        <div className="flex items-start gap-3">
          {artist.thumbnail_url && (
            <Image
              src={artist.thumbnail_url}
              alt={artist.name}
              width={56}
              height={56}
              className="rounded-full flex-shrink-0 mt-0.5"
            />
          )}
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold">{artist.name}</h1>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                artist.status === 'active'
                  ? 'bg-mga/10 text-mga'
                  : 'bg-surface2 text-dim border border-border'
              }`}>
                {artist.status}
              </span>
            </div>
            <a
              href={`https://www.youtube.com/channel/${artist.youtube_channel_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-dim hover:text-text transition-colors font-mono"
            >
              {artist.youtube_channel_id}
            </a>
          </div>
        </div>

        {artist.status === 'collecting' && (
          <ActivateButton artistId={id} />
        )}
        {artist.status === 'active' && (
          <Link
            href={`/artist/${id}`}
            className="text-xs text-dim border border-border rounded-lg px-3 py-1.5 hover:border-dim transition-colors"
          >
            公開ページを見る →
          </Link>
        )}
      </div>

      {/* 統計情報 */}
      <div className="grid grid-cols-2 gap-3 mb-6 sm:grid-cols-4">
        <div className="bg-surface border border-border rounded-xl p-4">
          <p className="text-xs text-dim mb-1">取得開始日</p>
          <p className="text-sm font-semibold">{artist.created_at.split('T')[0]}</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <p className="text-xs text-dim mb-1">初スナップショット</p>
          <p className="text-sm font-semibold">{firstSnap ?? '—'}</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <p className="text-xs text-dim mb-1">最終取得日</p>
          <p className="text-sm font-semibold">{lastSnap ?? '—'}</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <p className="text-xs text-dim mb-1">スナップショット</p>
          <p className="text-sm font-semibold tabular-nums">
            {totalSnaps.toLocaleString()} 件
            {nullCount > 0 && <span className="text-xs text-dim ml-1">(未計算 {nullCount})</span>}
          </p>
        </div>
      </div>

      {/* 最新データ */}
      <div className="grid grid-cols-2 gap-3 mb-6 sm:grid-cols-3">
        <div className="bg-surface border border-border rounded-xl p-4">
          <p className="text-xs text-dim mb-1">総再生数</p>
          <p className="text-sm font-semibold tabular-nums">{latestTotalViews.toLocaleString()}</p>
        </div>
        {artist.status === 'active' ? (
          <div className="bg-surface border border-border rounded-xl p-4">
            <p className="text-xs text-dim mb-1">H式指数（現在）</p>
            <p className="text-sm font-bold tabular-nums text-mga">
              {hIndex !== null ? `${Math.floor(hIndex).toLocaleString()} pt` : '—'}
            </p>
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-xl p-4">
            <p className="text-xs text-dim mb-1">公開時の初期値（SCALE）</p>
            <p className="text-sm font-semibold tabular-nums">
              {previewInitialIndex ? `${previewInitialIndex} pt` : '—'}
            </p>
          </div>
        )}
        {artist.status === 'active' && (
          <div className="bg-surface border border-border rounded-xl p-4">
            <p className="text-xs text-dim mb-1">SCALE（初期指数）</p>
            <p className="text-sm font-semibold tabular-nums">
              {artist.index_scale ? Math.floor(artist.index_scale).toLocaleString() : Math.floor(artist.initial_index).toLocaleString()} pt
            </p>
          </div>
        )}
      </div>

      {/* グラフ */}
      <AdminIndexChart snapshots={snaps} scale={artist.index_scale ?? null} />
      <ViewsChart snapshots={snaps} />

      {/* アイコン + 説明文 */}
      {(artist.thumbnail_url || artist.description) && (
        <div className="mt-6 flex items-start gap-4">
          {artist.thumbnail_url && (
            <Image
              src={artist.thumbnail_url}
              alt={artist.name}
              width={56}
              height={56}
              className="rounded-full flex-shrink-0"
            />
          )}
          {artist.description && (
            <p className="text-sm text-dim whitespace-pre-wrap">{artist.description}</p>
          )}
        </div>
      )}
    </div>
  )
}
