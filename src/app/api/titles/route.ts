import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { getShape, MAX_PER_SHAPE } from '@/lib/titles'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const { data } = await supabase
    .from('titles')
    .select('id, points_spent, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const { points_spent } = await request.json() as { points_spent?: number }
  if (!points_spent || !Number.isInteger(points_spent) || points_spent < 1 || points_spent > 999999) {
    return NextResponse.json({ error: '無効なポイント数です（1〜999,999）' }, { status: 400 })
  }

  const shape = getShape(points_spent)

  // 同じ形の保有数チェック
  const { count } = await supabase
    .from('titles')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .in('points_spent', await (async () => {
      // 同じ形になるpoints_spentを持つ既存称号を数える（shape列がないのでクライアント側でフィルタ）
      // ここではRPCの代わりに全件取得してフィルタ
      return []
    })())

  // 同じ形の称号を全件取得してカウント
  const { data: existing } = await supabase
    .from('titles')
    .select('points_spent')
    .eq('user_id', user.id)

  const sameShapeCount = (existing ?? []).filter(t => getShape(t.points_spent) === shape).length
  if (sameShapeCount >= MAX_PER_SHAPE) {
    return NextResponse.json(
      { error: `${shape}はすでに${MAX_PER_SHAPE}個保有しています。1個捨ててから購入してください。` },
      { status: 409 },
    )
  }

  // ポイント確認・消費
  const { data: profile } = await supabase
    .from('users')
    .select('free_points')
    .eq('id', user.id)
    .single()

  if (!profile || profile.free_points < points_spent) {
    return NextResponse.json({ error: 'ポイントが不足しています' }, { status: 400 })
  }

  const { error: updateErr } = await supabase
    .from('users')
    .update({ free_points: profile.free_points - points_spent })
    .eq('id', user.id)
  if (updateErr) return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 })

  const { data: title, error: insertErr } = await supabase
    .from('titles')
    .insert({ user_id: user.id, points_spent })
    .select('id, points_spent, created_at')
    .single()
  if (insertErr) return NextResponse.json({ error: '称号の作成に失敗しました' }, { status: 500 })

  return NextResponse.json(title)
}
