import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { Artist, ViewSnapshot } from '@/lib/types'

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const w = 100, h = 36
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`)
    .join(' ')
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

export default async function PreviewPage() {
  const supabase = await createClient()

  const { data: artists } = await supabase
    .from('artists')
    .select('*')
    .eq('status', 'active')
    .order('current_index', { ascending: false })
    .limit(20)

  const histories: Record<string, number[]> = {}
  for (const artist of artists ?? []) {
    const { data: snaps } = await supabase
      .from('view_snapshots')
      .select('index_value, snapshot_date')
      .eq('artist_id', artist.id)
      .not('index_value', 'is', null)
      .order('snapshot_date', { ascending: true })
      .limit(30)
    histories[artist.id] = (snaps ?? []).map((s: Pick<ViewSnapshot, 'index_value'>) => s.index_value!)
  }

  return (
    <div>
      {/* CTA バー */}
      <div className="bg-text text-bg rounded-xl p-4 mb-6 flex items-center justify-between gap-4">
        <p className="text-sm">
          <span className="font-semibold">気に入ったら登録してみよう。</span>
          <span className="text-bg/60 ml-2 hidden sm:inline">登録すると売買できます。</span>
        </p>
        <Link
          href="/signup"
          className="flex-shrink-0 bg-bg text-text rounded-lg px-4 py-1.5 text-xs font-semibold hover:opacity-90 transition-opacity"
        >
          参加する →
        </Link>
      </div>

      <h1 className="text-xl font-bold mb-1">アーティスト一覧</h1>
      <p className="text-xs text-dim mb-6">上位20件を表示。売買するには登録が必要です。</p>

      <div className="grid gap-4">
        {(artists as Artist[])?.map((artist) => {
          const hist = histories[artist.id] ?? []
          const latest = hist.at(-1) ?? artist.current_index
          const prev = hist.at(-2)
          const changePct = prev ? ((latest - prev) / prev) * 100 : null

          return (
            <Link key={artist.id} href={`/artist/${artist.id}`}>
              <div className="bg-surface border border-border rounded-xl p-5 hover:border-dim transition-colors flex items-center justify-between">
                <div>
                  <p className="text-sm text-dim mb-1">{artist.name}</p>
                  <p className="text-3xl font-bold tabular-nums">{Math.floor(artist.current_index)}</p>
                  {changePct !== null && (
                    <p className={`text-xs mt-1 ${changePct >= 0 ? 'text-mga' : 'text-accent'}`}>
                      {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}% (前日比)
                    </p>
                  )}
                </div>
                <div className={hist.length >= 2
                  ? (changePct !== null && changePct >= 0 ? 'text-mga' : 'text-accent')
                  : 'text-dim'}>
                  <Sparkline values={hist.length >= 2 ? hist : [artist.initial_index, artist.current_index]} />
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      <div className="mt-8 text-center">
        <p className="text-sm text-dim mb-4">すべてのアーティストを見るには登録が必要です</p>
        <Link
          href="/signup"
          className="inline-block bg-text text-bg rounded-xl px-8 py-3 text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          参加する
        </Link>
      </div>
    </div>
  )
}
