import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import type { ViewSnapshot, Investment } from '@/lib/types'
import InvestForm from './InvestForm'

function IndexChart({ snapshots }: { snapshots: ViewSnapshot[] }) {
  const values = snapshots.map((s) => s.index_value ?? 0).filter(Boolean)
  if (values.length < 2) return <p className="text-dim text-xs">データ蓄積中...</p>

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const w = 600, h = 120
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / range) * (h - 10) - 5}`)
    .join(' ')
  const dates = snapshots.filter((s) => s.index_value).map((s) => s.snapshot_date)

  return (
    <div className="bg-surface border border-border rounded-xl p-4 mb-6">
      <p className="text-xs text-dim mb-3">
        指数推移（{dates.at(0)} → {dates.at(-1)}）
      </p>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full overflow-visible">
        <polyline points={pts} fill="none" stroke="#4ade80" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

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

  if (!artist) notFound()

  const { data: snapshots } = await supabase
    .from('view_snapshots')
    .select('index_value, snapshot_date, daily_increase')
    .eq('artist_id', id)
    .order('snapshot_date', { ascending: true })
    .limit(90)

  const { data: { user } } = await supabase.auth.getUser()

  let userProfile = null
  let activeInvestment: Investment | null = null

  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('free_points')
      .eq('id', user.id)
      .single()
    userProfile = profile

    const { data: inv } = await supabase
      .from('investments')
      .select('*')
      .eq('user_id', user.id)
      .eq('artist_id', id)
      .eq('status', 'active')
      .maybeSingle()
    activeInvestment = inv
  }

  const currentIndex = artist.current_index as number
  const returnPts = activeInvestment
    ? Math.round(activeInvestment.points_invested * (currentIndex / activeInvestment.index_at_entry))
    : null

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">{artist.name}</h1>
      <p className="text-5xl font-bold tabular-nums text-mga mb-6 mt-3">
        {currentIndex.toFixed(1)}
      </p>

      <IndexChart snapshots={(snapshots ?? []) as ViewSnapshot[]} />

      {user ? (
        <div className="grid gap-4 md:grid-cols-2">
          {/* 所持ポイント・投入フォーム */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <p className="text-xs text-dim mb-3">所持ポイント</p>
            <p className="text-2xl font-bold tabular-nums mb-4">
              {userProfile?.free_points.toLocaleString() ?? 0} pt
            </p>
            {!activeInvestment && (
              <InvestForm artistId={id} currentIndex={currentIndex} />
            )}
            {activeInvestment && (
              <p className="text-xs text-dim">このアーティストに投入中のため追加投入不可</p>
            )}
          </div>

          {/* 現在の投入状況 */}
          {activeInvestment && returnPts !== null && (
            <div className="bg-surface border border-border rounded-xl p-5">
              <p className="text-xs text-dim mb-3">現在の投入状況</p>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-dim">投入時指数</span>
                <span>{activeInvestment.index_at_entry.toFixed(1)}</span>
              </div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-dim">投入ポイント</span>
                <span>{activeInvestment.points_invested.toLocaleString()} pt</span>
              </div>
              <div className="flex justify-between text-sm mb-3">
                <span className="text-dim">現在の価値</span>
                <span className={returnPts >= activeInvestment.points_invested ? 'text-mga' : 'text-accent'}>
                  {returnPts.toLocaleString()} pt
                  {' '}
                  ({returnPts >= activeInvestment.points_invested ? '+' : ''}
                  {((returnPts / activeInvestment.points_invested - 1) * 100).toFixed(1)}%)
                </span>
              </div>
              <form action="/api/withdraw" method="post">
                <input type="hidden" name="investment_id" value={activeInvestment.id} />
                <button
                  type="submit"
                  className="w-full bg-surface2 border border-border rounded-lg py-2 text-sm font-medium hover:border-dim transition-colors"
                >
                  回収する（{returnPts.toLocaleString()} pt）
                </button>
              </form>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-xl p-5 text-center">
          <p className="text-dim text-sm mb-3">ポイントを投入するにはログインが必要です</p>
          <a href="/login" className="text-sm underline hover:text-text transition-colors">
            ログイン
          </a>
        </div>
      )}
    </div>
  )
}
