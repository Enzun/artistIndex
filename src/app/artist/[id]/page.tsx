import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import type { ViewSnapshot, Investment } from '@/lib/types'
import InvestForm from './InvestForm'
import InvestmentCard from './InvestmentCard'
import IndexChart from './IndexChart'
import ViewsChart from './ViewsChart'

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
      <ViewsChart snapshots={(snapshots ?? []) as ViewSnapshot[]} />

      {user ? (
        <div className="flex flex-col gap-4">
          {/* 購入フォーム */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <InvestForm artistId={id} currentIndex={rawIndex} freePoints={userProfile?.free_points ?? 0} />
          </div>

          {/* 保有カード一覧 */}
          {activeInvestments.length > 0 && (
            <div className="flex flex-col gap-3">
              {activeInvestments.map((inv) => (
                <InvestmentCard
                  key={inv.id}
                  investmentId={inv.id}
                  pointsInvested={inv.points_invested}
                  indexAtEntry={inv.index_at_entry}
                  currentIndex={rawIndex}
                />
              ))}
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
