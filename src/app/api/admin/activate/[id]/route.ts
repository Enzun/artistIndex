import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // admin cookie check
  const cookieStore = await cookies()
  const session = cookieStore.get('admin_session')?.value
  if (!session || session !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { id } = await params
  const supabase = await createClient()

  // index_scale（アーティスト追加時に算出済み）を取得
  const { data: artistData } = await supabase
    .from('artists')
    .select('index_scale')
    .eq('id', id)
    .single()

  if (!artistData?.index_scale) {
    return NextResponse.json({ error: 'index_scale が未設定です' }, { status: 400 })
  }

  const initialIndex = artistData.index_scale

  const { error } = await supabase
    .from('artists')
    .update({
      status: 'active',
      current_index: initialIndex,
      initial_index: initialIndex,
      published_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'collecting')

  if (error) {
    return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, initial_index: initialIndex })
}
