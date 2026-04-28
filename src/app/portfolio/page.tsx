import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Investment } from '@/lib/types'
import PortfolioTabs from './PortfolioTabs'

export default async function PortfolioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: slotsRow }] = await Promise.all([
    supabase.from('users').select('free_points').eq('id', user.id).single(),
    supabase.from('user_slots').select('point_slots').eq('user_id', user.id).maybeSingle(),
  ])

  const { data: investments } = await supabase
    .from('investments')
    .select('*, artist:artists(id, name, current_index)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: true })

  const { data: history } = await supabase
    .from('investments')
    .select('id, points_invested, points_returned, created_at, withdrawn_at, artist:artists(name)')
    .eq('user_id', user.id)
    .eq('status', 'withdrawn')
    .order('withdrawn_at', { ascending: false })

  type InvestmentWithArtist = Investment & {
    artist: { id: string; name: string; current_index: number }
  }

  const items = (investments ?? []) as InvestmentWithArtist[]

  // アーティストごとに集約
  const artistMap = new Map<string, {
    id: string
    name: string
    currentIndex: number
    totalShares: number
    totalInvested: number
  }>()
  const returnMap = new Map<string, number>()

  for (const inv of items) {
    const { id, name, current_index } = inv.artist
    const shares = Math.round(inv.points_invested / inv.index_at_entry)
    const invReturn = Math.round(inv.points_invested * (current_index / inv.index_at_entry))
    if (!artistMap.has(id)) {
      artistMap.set(id, { id, name, currentIndex: current_index, totalShares: 0, totalInvested: 0 })
      returnMap.set(id, 0)
    }
    const entry = artistMap.get(id)!
    entry.totalShares += shares
    entry.totalInvested += inv.points_invested
    returnMap.set(id, (returnMap.get(id) ?? 0) + invReturn)
  }

  const holdings = Array.from(artistMap.values()).map(a => ({
    ...a,
    currentValue: returnMap.get(a.id) ?? 0,
  }))

  const totalEval = Array.from(returnMap.values()).reduce((s, v) => s + v, 0)
  const freePoints = profile?.free_points ?? 0
  const totalPoints = freePoints + totalEval

  const historyItems = (history ?? []).map((h) => {
    const artist = Array.isArray(h.artist) ? h.artist[0] : h.artist
    return {
      id: h.id,
      artistName: (artist as { name: string } | null)?.name ?? '—',
      pointsInvested: h.points_invested,
      pointsReturned: (h.points_returned as number | null) ?? 0,
      createdAt: h.created_at,
      withdrawnAt: (h.withdrawn_at as string | null) ?? h.created_at,
    }
  })

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">ポートフォリオ</h1>

      {/* サマリー */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {[
          { label: '所持ポイント', value: `${freePoints.toLocaleString()} pt` },
          { label: '評価額', value: `${totalEval.toLocaleString()} pt` },
          { label: '総ポイント', value: `${totalPoints.toLocaleString()} pt` },
        ].map(({ label, value }) => (
          <div key={label} className="bg-surface border border-border rounded-xl p-4 text-center">
            <p className="text-xs text-dim mb-1">{label}</p>
            <p className="text-xl font-bold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <PortfolioTabs
        holdings={holdings}
        history={historyItems}
        pointSlots={slotsRow?.point_slots ?? 0}
        freePoints={freePoints}
      />
    </div>
  )
}
