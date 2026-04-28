import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Investment } from '@/lib/types'
import HistorySection from './HistorySection'

export default async function PortfolioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('free_points')
    .eq('id', user.id)
    .single()

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

  for (const inv of items) {
    const { id, name, current_index } = inv.artist
    const shares = Math.round(inv.points_invested / inv.index_at_entry)
    if (!artistMap.has(id)) {
      artistMap.set(id, { id, name, currentIndex: current_index, totalShares: 0, totalInvested: 0 })
    }
    const entry = artistMap.get(id)!
    entry.totalShares += shares
    entry.totalInvested += inv.points_invested
  }

  const grouped = Array.from(artistMap.values())

  const totalEval = grouped.reduce((s, a) => s + a.totalShares * Math.floor(a.currentIndex), 0)
  const freePoints = profile?.free_points ?? 0
  const totalPoints = freePoints + totalEval

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

      {/* カード一覧 */}
      {grouped.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-dim text-sm mb-4">まだカードを持っていません</p>
          <Link href="/" className="text-sm underline hover:text-text transition-colors">
            アーティスト一覧へ
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {grouped.map((a) => {
            const pricePerShare = Math.floor(a.currentIndex)
            const currentValue = a.totalShares * pricePerShare
            const avgEntry = a.totalShares > 0 ? Math.floor(a.totalInvested / a.totalShares) : 0
            const pnl = currentValue - a.totalInvested
            const pnlPct = a.totalInvested > 0 ? (currentValue / a.totalInvested - 1) * 100 : 0
            return (
              <Link key={a.id} href={`/artist/${a.id}`}>
                <div className="bg-surface border border-border rounded-xl p-5 hover:border-dim transition-colors">
                  {/* 行1: アーティスト名 + 損益% */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-semibold">{a.name}</span>
                    <span className={`text-sm font-bold tabular-nums ${pnlPct >= 0 ? 'text-mga' : 'text-accent'}`}>
                      {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%
                    </span>
                  </div>
                  {/* 行2: 詳細数値 */}
                  <div className="grid grid-cols-4 text-sm gap-2">
                    <div>
                      <p className="text-xs text-dim mb-0.5">保有</p>
                      <p className="tabular-nums">{a.totalShares.toLocaleString()} 枚</p>
                    </div>
                    <div>
                      <p className="text-xs text-dim mb-0.5">平均単価</p>
                      <p className="tabular-nums">{avgEntry.toLocaleString()} pt</p>
                    </div>
                    <div>
                      <p className="text-xs text-dim mb-0.5">現在値</p>
                      <p className="tabular-nums">{Math.floor(a.currentIndex).toLocaleString()} pt</p>
                    </div>
                    <div>
                      <p className="text-xs text-dim mb-0.5">総損益</p>
                      <p className={`tabular-nums ${pnl >= 0 ? 'text-mga' : 'text-accent'}`}>
                        {pnl >= 0 ? '+' : ''}{pnl.toLocaleString()} pt
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      <HistorySection
        items={(history ?? []).map((h) => {
          const artist = Array.isArray(h.artist) ? h.artist[0] : h.artist
          return {
            id: h.id,
            artistName: (artist as { name: string } | null)?.name ?? '—',
            pointsInvested: h.points_invested,
            pointsReturned: (h.points_returned as number | null) ?? 0,
            createdAt: h.created_at,
            withdrawnAt: (h.withdrawn_at as string | null) ?? h.created_at,
          }
        })}
      />
    </div>
  )
}
