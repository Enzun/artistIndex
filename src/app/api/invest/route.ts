import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const body = await request.json()
  const { artist_id, points } = body

  if (!artist_id || !points || points < 1) {
    return NextResponse.json({ error: '無効なパラメータです' }, { status: 400 })
  }

  // get current index
  const { data: artist } = await supabase
    .from('artists')
    .select('current_index')
    .eq('id', artist_id)
    .single()

  if (!artist) return NextResponse.json({ error: 'アーティストが見つかりません' }, { status: 404 })

  const { error } = await supabase.rpc('invest', {
    p_user_id: user.id,
    p_artist_id: artist_id,
    p_points: points,
    p_current_index: artist.current_index,
  })

  if (error) {
    if (error.message.includes('insufficient_points')) {
      return NextResponse.json({ error: 'ポイントが不足しています' }, { status: 400 })
    }
    if (error.message.includes('already_invested')) {
      return NextResponse.json({ error: 'すでに投入中です' }, { status: 400 })
    }
    return NextResponse.json({ error: '投入に失敗しました' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
