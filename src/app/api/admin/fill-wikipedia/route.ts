/**
 * POST /api/admin/fill-wikipedia
 * view_snapshots.wikipedia_pageviews が NULL の行を Wikimedia API で埋める。
 * 日付ごとに top-1000 を一括取得し、残りは個別取得。
 * 何度実行しても安全。
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

export const maxDuration = 60

const WIKI_UA = 'artistIndex-admin/1.0 (https://artist-index.vercel.app/)'

async function fetchTop(date: string): Promise<Map<string, number>> {
  const [y, m, d] = date.split('-')
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/top/ja.wikipedia.org/all-access/${y}/${m}/${d}`
  const res = await fetch(url, {
    headers: { 'User-Agent': WIKI_UA },
    signal: AbortSignal.timeout(12000),
  })
  if (!res.ok) return new Map()
  const data = await res.json() as { items: [{ articles: { article: string; views: number }[] }] }
  const map = new Map<string, number>()
  for (const { article, views } of data.items[0].articles) {
    map.set(article, views)
    map.set(article.replace(/_/g, ' '), views)
  }
  return map
}

async function fetchSingle(title: string, date: string): Promise<number | null> {
  const encoded = encodeURIComponent(title.replace(/ /g, '_'))
  const d = date.replace(/-/g, '')
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/ja.wikipedia.org/all-access/all-agents/${encoded}/daily/${d}/${d}`
  const res = await fetch(url, {
    headers: { 'User-Agent': WIKI_UA },
    signal: AbortSignal.timeout(8000),
  })
  if (res.status === 404) return null
  if (!res.ok) return null
  const data = await res.json() as { items?: { views: number }[] }
  return data.items?.[0]?.views ?? null
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const session = cookieStore.get('admin_session')?.value
  if (!session || session !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const sb = createAdminClient()

  // wikipedia_ja があるアーティストの一覧
  const { data: artists, error: aErr } = await sb
    .from('artists')
    .select('id, wikipedia_ja')
    .not('wikipedia_ja', 'is', null)
  if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 })

  const titleMap = new Map((artists ?? []).map(a => [a.id, a.wikipedia_ja as string]))
  const artistIds = [...titleMap.keys()]
  if (!artistIds.length) return NextResponse.json({ ok: true, filled: 0 })

  // NULL 行を全取得（ページネーション）
  type NullRow = { artist_id: string; snapshot_date: string }
  const nullRows: NullRow[] = []
  let offset = 0
  while (true) {
    const { data } = await sb
      .from('view_snapshots')
      .select('artist_id, snapshot_date')
      .in('artist_id', artistIds)
      .is('wikipedia_pageviews', null)
      .order('snapshot_date')
      .range(offset, offset + 999)
    if (!data?.length) break
    nullRows.push(...(data as NullRow[]))
    if (data.length < 1000) break
    offset += 1000
  }

  if (!nullRows.length) return NextResponse.json({ ok: true, filled: 0, message: 'NULLなし' })

  // 日付ごとにグループ化
  const byDate = new Map<string, NullRow[]>()
  for (const row of nullRows) {
    if (!byDate.has(row.snapshot_date)) byDate.set(row.snapshot_date, [])
    byDate.get(row.snapshot_date)!.push(row)
  }

  let filled = 0
  let notFound = 0

  for (const [date, rows] of byDate) {
    // top-1000 を一括取得
    const topMap = await fetchTop(date)

    const remaining: NullRow[] = []
    const updates: { artist_id: string; snapshot_date: string; wikipedia_pageviews: number }[] = []

    for (const row of rows) {
      const title = titleMap.get(row.artist_id)
      if (!title) continue
      const views = topMap.get(title) ?? topMap.get(title.replace(/ /g, '_'))
      if (views !== undefined) {
        updates.push({ artist_id: row.artist_id, snapshot_date: row.snapshot_date, wikipedia_pageviews: views })
      } else {
        remaining.push(row)
      }
    }

    // top-1000 に入らなかった分を個別取得（3並列）
    const CONCURRENCY = 3
    for (let i = 0; i < remaining.length; i += CONCURRENCY) {
      const chunk = remaining.slice(i, i + CONCURRENCY)
      const settled = await Promise.allSettled(
        chunk.map(row => fetchSingle(titleMap.get(row.artist_id)!, date))
      )
      settled.forEach((r, j) => {
        if (r.status === 'fulfilled' && r.value !== null) {
          updates.push({
            artist_id: chunk[j].artist_id,
            snapshot_date: chunk[j].snapshot_date,
            wikipedia_pageviews: r.value,
          })
        } else {
          notFound++
        }
      })
      if (i + CONCURRENCY < remaining.length) await sleep(300)
    }

    // まとめて update
    for (const u of updates) {
      await sb
        .from('view_snapshots')
        .update({ wikipedia_pageviews: u.wikipedia_pageviews })
        .eq('artist_id', u.artist_id)
        .eq('snapshot_date', u.snapshot_date)
      filled++
    }
  }

  return NextResponse.json({
    ok: true,
    null_rows:  nullRows.length,
    dates:      byDate.size,
    filled,
    not_found:  notFound,
  })
}
