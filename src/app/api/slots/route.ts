import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { slotCost } from '@/lib/titles'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  // 現在の枠数を取得（なければ作成）
  let { data: slots } = await supabase
    .from('user_slots')
    .select('point_slots, paid_slots')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!slots) {
    await supabase.from('user_slots').insert({ user_id: user.id, point_slots: 0, paid_slots: 0 })
    slots = { point_slots: 0, paid_slots: 0 }
  }

  const cost = slotCost(slots.point_slots)

  const { data: profile } = await supabase
    .from('users')
    .select('free_points')
    .eq('id', user.id)
    .single()

  if (!profile || profile.free_points < cost) {
    return NextResponse.json({ error: `ポイントが不足しています（必要: ${cost.toLocaleString()} pt）` }, { status: 400 })
  }

  const { error: updateErr } = await supabase
    .from('users')
    .update({ free_points: profile.free_points - cost })
    .eq('id', user.id)
  if (updateErr) return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 })

  const { error: slotErr } = await supabase
    .from('user_slots')
    .update({ point_slots: slots.point_slots + 1 })
    .eq('user_id', user.id)
  if (slotErr) return NextResponse.json({ error: '枠の更新に失敗しました' }, { status: 500 })

  return NextResponse.json({ ok: true, newPointSlots: slots.point_slots + 1 })
}
