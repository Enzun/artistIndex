import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
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
  const totalInvested = Array.from(artistMap.values()).reduce((s, a) => s + a.totalInvested, 0)
  const unrealizedPnL = totalEval - totalInvested
  const freePoints = profile?.free_points ?? 0
  const totalPoints = freePoints + totalEval

  // 保有中（未売却）を履歴に含める
  const activeHistoryItems = items.map(inv => ({
    id: inv.id,
    artistName: inv.artist.name,
    pointsInvested: inv.points_invested,
    pointsReturned: null as number | null,
    createdAt: inv.created_at,
    withdrawnAt: null as string | null,
    status: 'active' as const,
  }))

  const withdrawnHistoryItems = (history ?? []).map((h) => {
    const artist = Array.isArray(h.artist) ? h.artist[0] : h.artist
    return {
      id: h.id,
      artistName: (artist as { name: string } | null)?.name ?? '—',
      pointsInvested: h.points_invested,
      pointsReturned: (h.points_returned as number | null),
      createdAt: h.created_at,
      withdrawnAt: (h.withdrawn_at as string | null),
      status: 'withdrawn' as const,
    }
  })

  const historyItems = [...activeHistoryItems, ...withdrawnHistoryItems]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return (
    <div>
      {/* タイトル + 称号 */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">ポートフォリオ</h1>
        <Link
          href="/titles"
          className="text-xs border border-border rounded-lg px-3 py-1.5 text-dim hover:border-dim hover:text-text transition-colors"
        >
          🏅 称号
        </Link>
      </div>

      {/* サマリー */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {[
          { label: '所持ポイント', value: `${freePoints.toLocaleString()} pt`, sub: null, subColor: '' },
          { label: '評価額', value: `${totalEval.toLocaleString()} pt`, sub: totalInvested > 0 ? `${unrealizedPnL >= 0 ? '+' : ''}${unrealizedPnL.toLocaleString()} pt` : null, subColor: unrealizedPnL >= 0 ? 'text-mga' : 'text-accent' },
          { label: '総ポイント', value: `${totalPoints.toLocaleString()} pt`, sub: null, subColor: '' },
        ].map(({ label, value, sub, subColor }) => (
          <div key={label} className="bg-surface border border-border rounded-xl p-4 text-center">
            <p className="text-xs text-dim mb-1">{label}</p>
            <p className="text-xl font-bold tabular-nums">{value}</p>
            {sub && <p className={`text-xs tabular-nums mt-0.5 ${subColor}`}>{sub}</p>}
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
