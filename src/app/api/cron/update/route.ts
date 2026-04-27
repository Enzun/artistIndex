/**
 * GET /api/cron/update
 * fetch + calc を順番に呼ぶ手動トリガー用エンドポイント。
 * 本番の自動実行は /api/cron/fetch と /api/cron/calc がそれぞれ Vercel Cron から呼ばれる。
 */

import { NextResponse } from 'next/server'
import { verifyCronAuth } from '../_lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const base = new URL(request.url).origin
  const headers = { authorization: request.headers.get('authorization') ?? '' }

  const fetchRes = await fetch(`${base}/api/cron/fetch`, { headers })
  const fetchData = await fetchRes.json()

  const calcRes = await fetch(`${base}/api/cron/calc`, { headers })
  const calcData = await calcRes.json()

  return NextResponse.json({ fetch: fetchData, calc: calcData })
}
