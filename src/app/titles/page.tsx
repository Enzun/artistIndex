import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import TitlesClient from './TitlesClient'
import { HOLDER_THRESHOLDS } from '@/lib/achievements'

export default async function TitlesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 並列フェッチ: プロフィール・購入称号・グローバル実績・保有中投資
  const [{ data: profile }, { data: titles }, { data: achievements }, { data: activeInvs }] =
    await Promise.all([
      supabase.from('users').select('free_points').eq('id', user.id).single(),
      supabase.from('titles').select('id, points_spent, created_at, showcase_order')
        .eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('user_achievements').select('type, achieved_at').eq('user_id', user.id),
      supabase.from('investments').select('artist_id, created_at')
        .eq('user_id', user.id).eq('status', 'active'),
    ])

  // 長期保有マイルストーンを確認してサイレントグラント（ignoreDuplicatesで重複は無視）
  const earliestByArtist = new Map<string, string>()
  for (const inv of activeInvs ?? []) {
    const cur = earliestByArtist.get(inv.artist_id)
    if (!cur || inv.created_at < cur) earliestByArtist.set(inv.artist_id, inv.created_at)
  }

  const holderGrants: { user_id: string; artist_id: string; type: string }[] = []
  const now = Date.now()
  for (const [artistId, earliest] of earliestByArtist) {
    const days = (now - new Date(earliest).getTime()) / 86_400_000
    for (const t of HOLDER_THRESHOLDS) {
      if (days >= t.minDays) holderGrants.push({ user_id: user.id, artist_id: artistId, type: t.code })
    }
  }
  if (holderGrants.length > 0) {
    await supabase.from('user_artist_achievements')
      .upsert(holderGrants, { onConflict: 'user_id,artist_id,type', ignoreDuplicates: true })
  }

  // アーティスト別実績称号を取得（長期保有グラント後に実行）
  const { data: artistAchievements } = await supabase
    .from('user_artist_achievements')
    .select('type, achieved_at, artist_id, artist:artists(name)')
    .eq('user_id', user.id)
    .order('achieved_at', { ascending: false })

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Link href="/portfolio" className="text-xs text-dim hover:text-text transition-colors">
          ← ポートフォリオ
        </Link>
      </div>
      <h1 className="text-xl font-bold mb-6">称号コレクション</h1>
      <TitlesClient
        titles={titles ?? []}
        freePoints={profile?.free_points ?? 0}
        achievements={achievements ?? []}
        artistAchievements={artistAchievements ?? []}
      />
    </div>
  )
}
