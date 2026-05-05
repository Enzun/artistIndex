import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import HomeHero from '@/app/HomeHero'

export default async function PreviewPage() {
  const supabase = await createClient()

  const { data: artists } = await supabase
    .from('artists')
    .select('id, name, thumbnail_url, current_index')
    .eq('status', 'active')
    .order('current_index', { ascending: false })
    .limit(7)

  const list = artists ?? []

  const artistIds = list.map(a => a.id)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000).toISOString().split('T')[0]

  const { data: snapshots } = artistIds.length
    ? await supabase
        .from('view_snapshots')
        .select('artist_id, index_value, snapshot_date')
        .in('artist_id', artistIds)
        .gte('snapshot_date', thirtyDaysAgo)
        .not('index_value', 'is', null)
        .order('snapshot_date', { ascending: true })
    : { data: [] }

  const histories: Record<string, number[]> = {}
  for (const snap of snapshots ?? []) {
    if (!histories[snap.artist_id]) histories[snap.artist_id] = []
    histories[snap.artist_id].push(snap.index_value as number)
  }

  return (
    <div>
      {/* CTA バー */}
      <div className="bg-text text-bg rounded-xl p-4 mb-8 flex items-center justify-between gap-4">
        <p className="text-sm">
          <span className="font-semibold">気になったら登録してみよう。</span>
          <span className="text-bg/60 ml-2 hidden sm:inline">無料で始められます。</span>
        </p>
        <Link
          href="/signup"
          className="flex-shrink-0 bg-bg text-text rounded-lg px-4 py-1.5 text-xs font-semibold hover:opacity-90 transition-opacity"
        >
          参加する →
        </Link>
      </div>

      <HomeHero
        artists={list as { id: string; name: string; thumbnail_url: string | null; current_index: number }[]}
        histories={histories}
        isPreview
      />

      {/* 下部 CTA */}
      <div className="mt-10 text-center">
        <p className="text-sm text-dim mb-4">すべての機能を使うには登録が必要です</p>
        <Link
          href="/signup"
          className="inline-block bg-text text-bg rounded-xl px-8 py-3 text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          無料で参加する
        </Link>
      </div>
    </div>
  )
}
