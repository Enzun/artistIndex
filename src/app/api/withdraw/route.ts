import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { BAGGER_THRESHOLDS } from '@/lib/achievements'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const { artist_id, shares } = await request.json()

  if (!artist_id || !shares || !Number.isInteger(shares) || shares < 1) {
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

  // バガー系称号: 直近15秒以内にwithdraownになった投資を確認（失敗しても売却は成功扱い）
  const since = new Date(Date.now() - 15_000).toISOString()
  const { data: recentWithdrawn } = await supabase
    .from('investments')
    .select('id, points_invested, points_returned')
    .eq('user_id', user.id)
    .eq('artist_id', artist_id)
    .eq('status', 'withdrawn')
    .gte('withdrawn_at', since)

  for (const inv of recentWithdrawn ?? []) {
    if (!inv.points_returned || inv.points_invested <= 0) continue
    const ratio = inv.points_returned / inv.points_invested
    const baggers = BAGGER_THRESHOLDS
      .filter(b => ratio >= b.multiplier)
      .map(b => ({ user_id: user.id, type: b.code, ref_investment_id: inv.id }))
    if (baggers.length > 0) {
      await supabase
        .from('user_achievements')
        .upsert(baggers, { onConflict: 'user_id,type', ignoreDuplicates: true })
    }
  }

  return NextResponse.json({ ok: true, returned: data?.returned })
}
