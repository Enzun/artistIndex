import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const { artist_id, shares } = await request.json()

  if (!artist_id || !shares || shares < 1) {
    return NextResponse.json({ error: '無効なパラメータです' }, { status: 400 })
  }

  const { data, error } = await supabase.rpc('withdraw_by_artist', {
    p_artist_id: artist_id,
    p_shares: shares,
  })

  if (error) {
    if (error.message.includes('insufficient_shares')) {
      return NextResponse.json({ error: '保有枚数を超えています' }, { status: 400 })
    }
    return NextResponse.json({ error: '回収に失敗しました' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, returned: data?.returned })
}
