import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import type { ViewSnapshot, Investment } from '@/lib/types'
import InvestForm from './InvestForm'
import InvestmentCard from './InvestmentCard'
import IndexChart from './IndexChart'
import ViewsChart from './ViewsChart'
import ArtistInfo from './ArtistInfo'

export default async function ArtistPage({
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

  if (!artist || artist.status !== 'active') notFound()

  const { data: snapshots } = await supabase
    .from('view_snapshots')
    .select('index_value, snapshot_date, daily_increase, total_views')
    .eq('artist_id', id)
    .order('snapshot_date', { ascending: true })
    .limit(400)

  const { data: { user } } = await supabase.auth.getUser()

  let userProfile = null
  let activeInvestments: Investment[] = []

  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('free_points')
      .eq('id', user.id)
      .single()
    userProfile = profile

    const { data: invList } = await supabase
      .from('investments')
      .select('*')
      .eq('user_id', user.id)
      .eq('artist_id', id)
      .eq('status', 'active')
      .order('created_at', { ascending: true })
    activeInvestments = (invList ?? []) as Investment[]
  }

  const rawIndex = artist.current_index as number
  const displayIndex = Math.floor(rawIndex)

  // 前日比：current_index が今日の値、直前スナップが昨日の値になるように選ぶ
  const todayJST = new Date(Date.now() + 9 * 3600_000).toISOString().split('T')[0]
  const withIndex = (snapshots ?? []).filter(s => s.index_value !== null)
  // 最新スナップが今日なら at(-2) が昨日、今日のスナップがなければ at(-1) が昨日
  const latestWithIndex = withIndex.at(-1)
  const prevSnap = latestWithIndex?.snapshot_date === todayJST
    ? withIndex.at(-2)
    : latestWithIndex
  const prevIndexValue = prevSnap?.index_value as number | undefined
  const dayChangePt  = prevIndexValue != null ? Math.floor(rawIndex) - Math.floor(prevIndexValue) : null
  const dayChangePct = prevIndexValue != null ? ((rawIndex - prevIndexValue) / prevIndexValue) * 100 : null

  // 最新の総再生数
  const latestTotalViews = (snapshots ?? []).at(-1)?.total_views as number ?? 0

  return (
    <div>
      {/* アーティスト名 + YouTube リンク */}
      <div className="flex items-center gap-3 mb-1">
        {artist.thumbnail_url && (
          <Image
            src={artist.thumbnail_url}
            alt={artist.name}
            width={48}
            height={48}
            className="rounded-full flex-shrink-0"
          />
        )}
        <h1 className="text-2xl font-bold">{artist.name}</h1>
        <a
          href={`https://www.youtube.com/channel/${artist.youtube_channel_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-dim hover:text-text transition-colors flex-shrink-0"
          title="YouTubeチャンネルを開く"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
          </svg>
        </a>
      </div>

      {/* 指数 + 前日比 */}
      <div className="flex items-end gap-3 mb-6 mt-2">
        <p className="text-5xl font-bold tabular-nums text-mga leading-none">
          {displayIndex} <span className="text-2xl font-semibold">pt</span>
        </p>
        {dayChangePct !== null && dayChangePt !== null && (
          <p className={`text-sm font-medium tabular-nums mb-1 ${dayChangePct >= 0 ? 'text-mga' : 'text-accent'}`}>
            前日比 {dayChangePt >= 0 ? '+' : ''}{dayChangePt.toLocaleString()}pt {dayChangePct >= 0 ? '+' : ''}{dayChangePct.toFixed(2)}%
          </p>
        )}
      </div>

      <IndexChart snapshots={(snapshots ?? []) as ViewSnapshot[]} />

      {user ? (
        <div className="flex flex-col gap-4">
          {/* 購入フォーム */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <InvestForm artistId={id} currentIndex={rawIndex} freePoints={userProfile?.free_points ?? 0} />
          </div>

          {/* 保有カード（集約表示・0枚でも表示） */}
          <InvestmentCard
            artistId={id}
            investments={activeInvestments}
            currentIndex={rawIndex}
          />
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-xl p-5 text-center">
          <p className="text-dim text-sm mb-3">カードを購入するにはログインが必要です</p>
          <div className="flex gap-4 justify-center">
            <a href="/signup" className="text-sm bg-text text-bg rounded-lg px-4 py-1.5 hover:opacity-80 transition-opacity">
              新規登録
            </a>
            <a href="/login" className="text-sm underline hover:text-text transition-colors">
              ログイン
            </a>
          </div>
        </div>
      )}

      {/* アーティスト情報 */}
      <div className="mt-4">
        <ArtistInfo
          channelId={artist.youtube_channel_id}
          totalViews={latestTotalViews}
          thumbnailUrl={artist.thumbnail_url}
          description={artist.description}
        />
      </div>

      <ViewsChart snapshots={(snapshots ?? []) as ViewSnapshot[]} />
    </div>
  )
}
