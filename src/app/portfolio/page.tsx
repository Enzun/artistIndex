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

  const totalEval = items.reduce((s, i) => {
    return s + Math.round(i.points_invested * (i.artist.current_index / i.index_at_entry))
  }, 0)
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
      {items.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-dim text-sm mb-4">まだカードを持っていません</p>
          <Link href="/" className="text-sm underline hover:text-text transition-colors">
            アーティスト一覧へ
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((inv) => {
            const rawIndex = inv.artist.current_index
            const shares = Math.round(inv.points_invested / inv.index_at_entry)
            const returnPts = Math.round(inv.points_invested * (rawIndex / inv.index_at_entry))
            const changePct = (returnPts / inv.points_invested - 1) * 100
            return (
              <Link key={inv.id} href={`/artist/${inv.artist.id}`}>
                <div className="bg-surface border border-border rounded-xl p-5 hover:border-dim transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-semibold">{inv.artist.name}</span>
                    <span className={`text-sm font-bold tabular-nums ${changePct >= 0 ? 'text-mga' : 'text-accent'}`}>
                      {changePct >= 0 ? '+' : ''}{changePct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="grid grid-cols-4 text-sm gap-2">
                    <div>
                      <p className="text-xs text-dim mb-0.5">枚数</p>
                      <p className="tabular-nums">{shares.toLocaleString()} 枚</p>
                    </div>
                    <div>
                      <p className="text-xs text-dim mb-0.5">購入時指数</p>
                      <p className="tabular-nums">{Math.floor(inv.index_at_entry)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-dim mb-0.5">現在指数</p>
                      <p className="tabular-nums">{Math.floor(rawIndex)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-dim mb-0.5">現在の価値</p>
                      <p className={`tabular-nums ${returnPts >= inv.points_invested ? 'text-mga' : 'text-accent'}`}>
                        {returnPts.toLocaleString()} pt
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
