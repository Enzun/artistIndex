import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const cookieStore = await cookies()
  const session = cookieStore.get('admin_session')?.value
  if (!session || session !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json() as Record<string, string | null>

  const allowed = ['wikipedia_ja']
  const update: Record<string, string | null> = {}
  for (const key of allowed) {
    if (key in body) update[key] = body[key] || null
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: '更新フィールドがありません' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { error } = await supabase.from('artists').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
