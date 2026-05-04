import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// showcase_order を設定（null で解除、1-3 でスロット指定）
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const { id } = await params
  const { showcase_order } = await request.json() as { showcase_order: number | null }

  // 同じスロットを使っている別の称号を解除
  if (showcase_order !== null) {
    await supabase
      .from('titles')
      .update({ showcase_order: null })
      .eq('user_id', user.id)
      .eq('showcase_order', showcase_order)
      .neq('id', id)
  }

  const { error } = await supabase
    .from('titles')
    .update({ showcase_order })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const { id } = await params

  const { error } = await supabase
    .from('titles')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: '削除に失敗しました' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
