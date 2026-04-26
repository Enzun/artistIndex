import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Investment } from '@/lib/types'

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
    .order('created_at', { ascending: false })

  type InvestmentWithArtist = Investment & {
    artist: { id: string; name: string; current_index: number }
  }

  const items = (investments ?? []) as InvestmentWithArtist[]

  const totalInvested = items.reduce((s, i) => s + i.points_invested, 0)
  const totalCurrent = items.reduce((s, i) => {
    const ret = Math.round(i.points_invested * (i.artist.current_index / i.index_at_entry))
    return s + ret
  }, 0)

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">ポートフォリオ</h1>

      {/* サマリー */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {[
          { label: '所持ポイント', value: `${profile?.free_points.toLocaleString() ?? 0} pt` },
          { label: '投入中合計', value: `${totalInvested.toLocaleString()} pt` },
          {
            label: '現在の評価額',
            value: `${totalCurrent.toLocaleString()} pt`,
            highlight: totalCurrent >= totalInvested,
          },
        ].map(({ label, value, highlight }) => (
          <div key={label} className="bg-surface border border-border rounded-xl p-4 text-center">
            <p className="text-xs text-dim mb-1">{label}</p>
            <p className={`text-xl font-bold tabular-nums ${highlight ? 'text-mga' : ''}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* 投入一覧 */}
      {items.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-dim text-sm mb-4">まだポイントを投入していません</p>
          <Link href="/" className="text-sm underline hover:text-text transition-colors">
            アーティスト一覧へ
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((inv) => {
            const returnPts = Math.round(
              inv.points_invested * (inv.artist.current_index / inv.index_at_entry),
            )
            const changePct = (returnPts / inv.points_invested - 1) * 100
            return (
              <div key={inv.id} className="bg-surface border border-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <Link href={`/artist/${inv.artist.id}`} className="font-semibold hover:text-dim transition-colors">
                    {inv.artist.name}
                  </Link>
                  <span className={`text-sm font-bold tabular-nums ${changePct >= 0 ? 'text-mga' : 'text-accent'}`}>
                    {changePct >= 0 ? '+' : ''}{changePct.toFixed(1)}%
                  </span>
                </div>
                <div className="grid grid-cols-3 text-sm text-dim gap-2 mb-4">
                  <div>
                    <p className="text-xs mb-0.5">投入時指数</p>
                    <p className="text-text tabular-nums">{inv.index_at_entry.toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="text-xs mb-0.5">現在指数</p>
                    <p className="text-text tabular-nums">{inv.artist.current_index.toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="text-xs mb-0.5">投入 → 現在</p>
                    <p className="text-text tabular-nums">
                      {inv.points_invested.toLocaleString()} → {returnPts.toLocaleString()} pt
                    </p>
                  </div>
                </div>
                <form action="/api/withdraw" method="post">
                  <input type="hidden" name="investment_id" value={inv.id} />
                  <button
                    type="submit"
                    className="w-full bg-surface2 border border-border rounded-lg py-2 text-sm hover:border-dim transition-colors"
                  >
                    回収する（{returnPts.toLocaleString()} pt）
                  </button>
                </form>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
