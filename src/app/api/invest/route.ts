import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { BASE_SLOTS } from '@/lib/titles'
import { SCALE_THRESHOLDS } from '@/lib/achievements'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const body = await request.json()
  const { artist_id, points } = body

  if (!artist_id || !points || !Number.isInteger(points) || points < 1) {
    return NextResponse.json({ error: '無効なパラメータです' }, { status: 400 })
  }

  // get current index
  const { data: artist } = await supabase
    .from('artists')
    .select('current_index, status')
    .eq('id', artist_id)
    .single()

  if (!artist) return NextResponse.json({ error: 'アーティストが見つかりません' }, { status: 404 })
  if (artist.status !== 'active') return NextResponse.json({ error: '購入できないアーティストです' }, { status: 403 })

  // 枠チェック: 新しいアーティストの場合のみ確認
  const { data: activeInvs } = await supabase
    .from('investments')
    .select('artist_id')
    .eq('user_id', user.id)
    .eq('status', 'active')

  const holdingArtistIds = new Set((activeInvs ?? []).map(i => i.artist_id))

  if (!holdingArtistIds.has(artist_id)) {
    const { data: slotsRow } = await supabase
      .from('user_slots')
      .select('point_slots, paid_slots')
      .eq('user_id', user.id)
      .maybeSingle()
    const totalSlots = BASE_SLOTS + (slotsRow?.point_slots ?? 0) + (slotsRow?.paid_slots ?? 0)
    if (holdingArtistIds.size >= totalSlots) {
      return NextResponse.json(
        { error: `保有枠が上限（${totalSlots}組）です。ポートフォリオから枠を追加してください。` },
        { status: 400 },
      )
    }
  }

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

  // 規模系称号を付与（重複は無視・失敗しても投資は成功扱い）
  const scaleGrants = SCALE_THRESHOLDS
    .filter(s => points >= s.minPoints)
    .map(s => ({ user_id: user.id, type: s.code }))
  if (scaleGrants.length > 0) {
    await supabase
      .from('user_achievements')
      .upsert(scaleGrants, { onConflict: 'user_id,type', ignoreDuplicates: true })
  }

  return NextResponse.json({ ok: true })
}
