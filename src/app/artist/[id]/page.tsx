import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import type { ViewSnapshot, Investment } from '@/lib/types'
import InvestForm from './InvestForm'
import WithdrawButton from './WithdrawButton'

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
      .order('created_at', { ascending: false })
    activeInvestments = (invList ?? []) as Investment[]
  }

  const rawIndex = artist.current_index as number
  const displayIndex = Math.floor(rawIndex)

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">{artist.name}</h1>
      <p className="text-5xl font-bold tabular-nums text-mga mb-6 mt-3">
        {displayIndex}
      </p>

      <IndexChart snapshots={(snapshots ?? []) as ViewSnapshot[]} />

      {user ? (
        <div className="flex flex-col gap-4">
          {/* 所持ポイント・購入フォーム */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <p className="text-xs text-dim mb-1">所持ポイント</p>
            <p className="text-2xl font-bold tabular-nums mb-4">
              {userProfile?.free_points.toLocaleString() ?? 0} pt
            </p>
            <InvestForm artistId={id} currentIndex={rawIndex} />
          </div>

          {/* 保有カード一覧 */}
          {activeInvestments.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-dim px-1">保有カード</p>
              {activeInvestments.map((inv) => {
                const shares = Math.round(inv.points_invested / inv.index_at_entry)
                const returnPts = Math.round(inv.points_invested * (rawIndex / inv.index_at_entry))
                const changePct = (returnPts / inv.points_invested - 1) * 100
                return (
                  <div key={inv.id} className="bg-surface border border-border rounded-xl p-5">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="text-sm font-semibold tabular-nums">{shares.toLocaleString()} 枚</p>
                        <p className="text-xs text-dim mt-0.5">購入時指数: {Math.floor(inv.index_at_entry)}</p>
                      </div>
                      <span className={`text-sm font-bold tabular-nums ${changePct >= 0 ? 'text-mga' : 'text-accent'}`}>
                        {changePct >= 0 ? '+' : ''}{changePct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between text-sm mb-3">
                      <span className="text-dim">現在の価値</span>
                      <span className={returnPts >= inv.points_invested ? 'text-mga' : 'text-accent'}>
                        {returnPts.toLocaleString()} pt
                      </span>
                    </div>
                    <WithdrawButton investmentId={inv.id} returnPts={returnPts} />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-xl p-5 text-center">
          <p className="text-dim text-sm mb-3">カードを購入するにはログインが必要です</p>
          <a href="/login" className="text-sm underline hover:text-text transition-colors">
            ログイン
          </a>
        </div>
      )}
    </div>
  )
}
