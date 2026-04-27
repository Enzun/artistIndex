import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const formData = await request.formData()
  const investment_id = formData.get('investment_id') as string
  const shares_str    = formData.get('shares') as string | null
  const shares        = shares_str ? parseInt(shares_str, 10) : null

  if (!investment_id) {
    return NextResponse.json({ error: '無効なパラメータです' }, { status: 400 })
  }

  const { error } = await supabase.rpc('withdraw', {
    p_investment_id: investment_id,
    p_shares: shares,
  })

  if (error) {
    if (error.message.includes('investment_not_found')) {
      return NextResponse.json({ error: '既に回収済みです' }, { status: 404 })
    }
    if (error.message.includes('invalid_shares')) {
      return NextResponse.json({ error: '無効な枚数です' }, { status: 400 })
    }
    return NextResponse.json({ error: '回収に失敗しました' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
