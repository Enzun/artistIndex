import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PUT(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slot, kind, ref } = await req.json()
  if (!slot || !kind || !ref) return NextResponse.json({ error: 'Invalid params' }, { status: 400 })

  const { error } = await supabase
    .from('user_showcase')
    .upsert({ user_id: user.id, slot, kind, ref })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slot } = await req.json()
  const { error } = await supabase
    .from('user_showcase')
    .delete()
    .eq('user_id', user.id)
    .eq('slot', slot)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
