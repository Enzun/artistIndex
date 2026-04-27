/**
 * GET /api/cron/calc
 * active アーティストの指数を計算して artists.current_index と
 * view_snapshots.index_value を更新する。
 * fetch の完了後に実行すること。
 */

import { NextResponse } from 'next/server'
import { verifyCronAuth, getServiceClient } from '../_lib/auth'
import { CronLogger } from '../_lib/logger'

export const dynamic = 'force-dynamic'

const K             = 3
const BASELINE_DAYS = 180

export async function GET(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb = getServiceClient()
  const logger = new CronLogger('calc', sb)
  await logger.start()

  const today = new Date().toISOString().split('T')[0]
  const baselineFrom = new Date(Date.now() - BASELINE_DAYS * 86400_000)
    .toISOString().split('T')[0]

  const summary: Record<string, unknown> = { date: today, ok: 0, skipped: 0, error: 0, errors: [] as string[] }

  try {
    const { data: artists, error } = await sb
      .from('artists')
      .select('id, name, current_index')
      .eq('status', 'active')
    if (error) throw error

    for (const artist of artists ?? []) {
      try {
        const { data: todaySnap } = await sb
          .from('view_snapshots')
          .select('daily_increase')
          .eq('artist_id', artist.id)
          .eq('snapshot_date', today)
          .maybeSingle()

        if (!todaySnap || Number(todaySnap.daily_increase) <= 0) {
          summary.skipped = (summary.skipped as number) + 1
          continue
        }

        const d = Number(todaySnap.daily_increase)

        const { data: history } = await sb
          .from('view_snapshots')
          .select('daily_increase')
          .eq('artist_id', artist.id)
          .gte('snapshot_date', baselineFrom)
          .lt('snapshot_date', today)
          .gt('daily_increase', 0)

        if (!history?.length) {
          summary.skipped = (summary.skipped as number) + 1
          continue
        }

        const B = history.reduce((s, r) => s + Number(r.daily_increase), 0) / history.length
        const newIndex = Number(artist.current_index) * Math.pow(d / B, K / 365)
        const rounded  = Math.round(newIndex * 100) / 100

        await sb.from('artists').update({ current_index: rounded }).eq('id', artist.id)
        await sb.from('view_snapshots')
          .update({ index_value: rounded })
          .eq('artist_id', artist.id)
          .eq('snapshot_date', today)

        summary.ok = (summary.ok as number) + 1
      } catch (err) {
        ;(summary.errors as string[]).push(`${artist.name}: ${err}`)
        summary.error = (summary.error as number) + 1
      }
    }

    await logger.finish('success', summary)
    return NextResponse.json(summary)
  } catch (err) {
    const msg = String(err)
    await logger.finish('error', { ...summary, fatal: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
