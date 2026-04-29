/**
 * test_wikipedia.ts
 * Wikipedia Pageviews APIのテスト。指定した記事の直近30日の閲覧数を取得する。
 *
 * Usage:
 *   npx tsx scripts/test_wikipedia.ts "Mrs._GREEN_APPLE"
 *   npx tsx scripts/test_wikipedia.ts "米津玄師"
 */

const article = process.argv[2] ?? 'Mrs._GREEN_APPLE'

const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '')

async function main() {
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - 30)

  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/ja.wikipedia.org/all-access/all-agents/${encodeURIComponent(article)}/daily/${fmt(start)}/${fmt(end)}`

  console.log(`記事: ${article}`)
  console.log(`URL: ${url}\n`)

  const res = await fetch(url, {
    headers: { 'User-Agent': 'artistIndex-test/1.0' }
  })

  if (!res.ok) {
    console.error(`エラー: ${res.status} ${res.statusText}`)
    console.error(await res.text())
    process.exit(1)
  }

  const json = await res.json() as { items: { timestamp: string; views: number }[] }

  let total = 0
  for (const item of json.items) {
    const date = item.timestamp.slice(0, 8).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')
    console.log(`${date}  ${item.views.toLocaleString()} views`)
    total += item.views
  }

  console.log(`\n合計: ${total.toLocaleString()} views / ${json.items.length}日間`)
  console.log(`平均: ${Math.round(total / json.items.length).toLocaleString()} views/日`)
}

main().catch(console.error)
