import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import TitlesClient from './TitlesClient'

export default async function TitlesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: titles }, { data: achievements }] = await Promise.all([
    supabase.from('users').select('free_points').eq('id', user.id).single(),
    supabase.from('titles').select('id, points_spent, created_at, showcase_order').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('user_achievements').select('type, achieved_at').eq('user_id', user.id),
  ])

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
      />
    </div>
  )
}
