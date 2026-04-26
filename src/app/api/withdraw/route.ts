import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const formData = await request.formData()
  const investment_id = formData.get('investment_id') as string

  if (!investment_id) {
    return NextResponse.json({ error: '無効なパラメータです' }, { status: 400 })
  }

  const { error } = await supabase.rpc('withdraw', {
    p_user_id: user.id,
    p_investment_id: investment_id,
  })

  if (error) {
    if (error.message.includes('investment_not_found')) {
      return NextResponse.json({ error: '投入が見つかりません' }, { status: 404 })
    }
    return NextResponse.json({ error: '回収に失敗しました' }, { status: 500 })
  }

  // redirect back to referrer or portfolio
  const referer = request.headers.get('referer') ?? '/portfolio'
  return NextResponse.redirect(new URL(referer, request.url))
}
