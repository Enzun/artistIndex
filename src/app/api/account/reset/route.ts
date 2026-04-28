import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const RESET_POINTS = 5000

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  // 投資履歴を全削除
  const { error: delError } = await supabase
    .from('investments')
    .delete()
    .eq('user_id', user.id)

  if (delError) return NextResponse.json({ error: 'リセットに失敗しました' }, { status: 500 })

  // ポイントをリセット
  const { error: updateError } = await supabase
    .from('users')
    .update({ free_points: RESET_POINTS })
    .eq('id', user.id)

  if (updateError) return NextResponse.json({ error: 'リセットに失敗しました' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
