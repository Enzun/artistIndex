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

export default async function HomePage() {
  const supabase = await createClient()

  const { data: artists } = await supabase
    .from('artists')
    .select('*')
    .eq('status', 'active')
    .order('current_index', { ascending: false })

  // 各アーティストの直近30日の指数履歴
  const histories: Record<string, number[]> = {}
  for (const artist of artists ?? []) {
    const { data: snaps } = await supabase
      .from('view_snapshots')
      .select('index_value, snapshot_date')
      .eq('artist_id', artist.id)
      .not('index_value', 'is', null)
      .order('snapshot_date', { ascending: true })
      .limit(30)
    histories[artist.id] = (snaps ?? [])
      .map((s: Pick<ViewSnapshot, 'index_value'>) => s.index_value!)
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">アーティスト一覧</h1>
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
      {!artists?.length && (
        <p className="text-dim text-sm">アーティストが登録されていません。</p>
      )}
    </div>
  )
}
