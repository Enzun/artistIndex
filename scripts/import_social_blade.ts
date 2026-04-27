#!/usr/bin/env tsx
/**
 * 月次再生数JSONファイルから view_snapshots に日次推定値をインポートする
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/import_social_blade.ts <artist_id> --file <jsonファイル> [--dry-run]
 *
 * JSONフォーマット（data/mga_monthly.json など）:
 *   [
 *     { "month": "2025-01", "monthly_views": 45000000 },
 *     { "month": "2025-02", "monthly_views": 38000000 }
 *   ]
 *
 * --dry-run: DBへの書き込みを行わず、解析結果のみ表示
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// ── 定数 ───────────────────────────────────────────────────────────────────────
const K = 3
const BASELINE_DAYS = 180

// ── ユーティリティ ─────────────────────────────────────────────────────────────
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function mean(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
}

function normalizeMonth(raw: string): string | null {
  const map: Record<string, string> = {
    Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
    Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
  }
  const m = raw.trim().match(/^(\w{3})\s+(\d{4})$/)
  if (!m) return null
  const mo = map[m[1]]
  return mo ? `${m[2]}-${mo}` : null
}

// ── Social Blade フェッチ ──────────────────────────────────────────────────────
async function fetchSocialBlade(channelId: string): Promise<string> {
  const url = `https://socialblade.com/youtube/channel/${channelId}`
  console.log(`GET ${url}`)
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
  return res.text()
}

// ── HTMLパース ────────────────────────────────────────────────────────────────
type MonthlyRecord = { month: string; monthly_views: number }

function parseMonthlyViews(html: string): MonthlyRecord[] {
  const results: MonthlyRecord[] = []

  // Social Blade の月次テーブルは以下のような構造:
  // <div id="YouTubeUserDetailStats">
  //   各行に: 月名 | subscriber変化 | total subscribers | view変化 | total views | 収益
  // </div>
  //
  // "view変化"（Video Views Gained）が monthly_views に相当する

  // アプローチ1: 月名＋数字の近接パターン（最も汎用的）
  // Social Blade は "Jan 2025" のような月名の後ろ数行以内に各数値を置く
  const monthPattern = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})\b/g
  const allText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

  let match: RegExpExecArray | null
  while ((match = monthPattern.exec(allText)) !== null) {
    const normalized = normalizeMonth(`${match[1]} ${match[2]}`)
    if (!normalized) continue

    // この月名の後ろ200文字以内にある数値群を探す
    const window = allText.slice(match.index, match.index + 300)

    // 数値をすべて抽出（カンマ区切り含む）
    const nums = [...window.matchAll(/[\d,]+/g)]
      .map(m => parseInt(m[0].replace(/,/g, ''), 10))
      .filter(n => !isNaN(n) && n > 0)

    // Social Blade の列順: subscriber変化, total subscribers, view変化, total views, ...
    // view変化（monthly views）は通常4番目前後の大きい数値
    // 月次再生数として妥当な範囲: 10万〜10億
    const candidates = nums.filter(n => n >= 100_000 && n <= 1_000_000_000)

    if (candidates.length > 0) {
      // 既に同月が登録済みでなければ追加
      if (!results.find(r => r.month === normalized)) {
        results.push({ month: normalized, monthly_views: candidates[0] })
      }
    }
  }

  return results.sort((a, b) => a.month.localeCompare(b.month))
}

// ── 日次推定値の生成 ───────────────────────────────────────────────────────────
type DailyRecord = { date: string; daily_increase: number; total_views: number }

function generateDailyRecords(
  monthly: MonthlyRecord[],
  totalViewsAtAddition: bigint,
  additionDate: string,
): DailyRecord[] {
  // 月次データから全日付の daily_increase を生成（月内は均等配分）
  const daily: DailyRecord[] = []
  for (const { month, monthly_views } of monthly) {
    const [y, mo] = month.split('-').map(Number)
    const days = daysInMonth(y, mo)
    const perDay = Math.round(monthly_views / days)
    for (let d = 1; d <= days; d++) {
      const date = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      daily.push({ date, daily_increase: perDay, total_views: 0 })
    }
  }
  daily.sort((a, b) => a.date.localeCompare(b.date))

  // 追加日の total_views を基準に、前後を積算して total_views を推定
  // 追加日以前: total_views[t] = total_views[additionDate] - sum(daily_increase[t+1..additionDate])
  // 追加日以後: total_views[t] = total_views[additionDate] + sum(daily_increase[additionDate+1..t])
  const addIdx = daily.findIndex(r => r.date === additionDate)
  let base = Number(totalViewsAtAddition)

  if (addIdx >= 0) {
    daily[addIdx].total_views = base
    // 前方向
    for (let i = addIdx - 1; i >= 0; i--) {
      base -= daily[i + 1].daily_increase
      daily[i].total_views = Math.max(0, base)
    }
    base = Number(totalViewsAtAddition)
    // 後方向
    for (let i = addIdx + 1; i < daily.length; i++) {
      base += daily[i].daily_increase
      daily[i].total_views = base
    }
  }

  return daily
}

// ── 指数値の計算（A2手法） ──────────────────────────────────────────────────────
function calcIndexValues(
  daily: DailyRecord[],
  initialIndex: number,
  additionDate: string,
): Map<string, number> {
  // 全期間を通して指数を計算し、追加日の値が initialIndex に一致するようスケール
  const hist: number[] = []
  let rawIdx = 100
  const raw = new Map<string, number>()

  for (const { date, daily_increase } of daily) {
    const B = hist.length > 0 ? mean(hist) : daily_increase
    if (daily_increase > 0 && B > 0) {
      rawIdx *= Math.pow(daily_increase / B, K / 365)
    }
    raw.set(date, rawIdx)
    hist.push(daily_increase)
    if (hist.length > BASELINE_DAYS) hist.shift()
  }

  // 追加日が履歴範囲外の場合、直近平均で外挿して追加日まで延長
  let anchor = raw.get(additionDate)
  if (!anchor) {
    const lastRec = daily.at(-1)
    if (lastRec) {
      let curDate = lastRec.date
      let curIdx = raw.get(curDate)!
      const recentMean = mean(hist.slice(-30).filter(v => v > 0))
      while (curDate < additionDate) {
        const d = new Date(curDate)
        d.setDate(d.getDate() + 1)
        curDate = d.toISOString().split('T')[0]
        const B = mean(hist)
        if (recentMean > 0 && B > 0) {
          curIdx *= Math.pow(recentMean / B, K / 365)
        }
        raw.set(curDate, curIdx)
        hist.push(recentMean)
        if (hist.length > BASELINE_DAYS) hist.shift()
      }
      anchor = raw.get(additionDate)
    }
  }
  if (!anchor || anchor === 0) return raw
  const scale = initialIndex / anchor

  const scaled = new Map<string, number>()
  for (const [date, idx] of raw) {
    scaled.set(date, idx * scale)
  }
  return scaled
}

// ── DB書き込み ─────────────────────────────────────────────────────────────────
async function importToDb(
  artistId: string,
  daily: DailyRecord[],
  indexValues: Map<string, number>,
  additionDate: string,
): Promise<void> {
  let upserted = 0
  let skipped = 0

  for (const rec of daily) {
    if (rec.date >= additionDate) {
      skipped++
      continue  // 追加日以降は実データ優先
    }

    const index_value = indexValues.get(rec.date) ?? null

    // 既存レコードは index_value のみ更新、新規は全列挿入
    const { error } = await supabase.from('view_snapshots').upsert({
      artist_id: artistId,
      total_views: rec.total_views,
      daily_increase: rec.daily_increase,
      index_value,
      snapshot_date: rec.date,
    }, { onConflict: 'artist_id,snapshot_date' })

    if (error) {
      console.error(`  エラー (${rec.date}): ${error.message}`)
    } else {
      upserted++
    }
  }

  console.log(`  upsert: ${upserted}件 / スキップ: ${skipped}件`)
}

// ── メイン ────────────────────────────────────────────────────────────────────
async function main() {
  const artistId = process.argv[2]
  const dryRun = process.argv.includes('--dry-run')
  const fileArg = process.argv.indexOf('--file')
  const filePath = fileArg >= 0 ? process.argv[fileArg + 1] : null

  if (!filePath) {
    console.error('--file オプションが必要です')
    console.error('例: npx tsx --env-file=.env scripts/import_social_blade.ts <artist_id> --file data/mga_monthly.json')
    process.exit(1)
  }

  if (!artistId) {
    console.error('Usage: npx tsx scripts/import_social_blade.ts <artist_id> [--dry-run]')
    process.exit(1)
  }

  // ENV確認
  console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? '✓' : '✗ 未設定')
  console.log('SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓' : '✗ 未設定')

  // アーティスト情報取得
  const { data: artist, error: artistErr } = await supabase
    .from('artists')
    .select('*')
    .eq('id', artistId)
    .maybeSingle()
  if (artistErr) {
    console.error('DBエラー:', artistErr.message)
    process.exit(1)
  }
  if (!artist) {
    // 全アーティスト一覧を表示して確認
    const { data: all } = await supabase.from('artists').select('id, name')
    console.error('アーティストが見つかりません。登録済み一覧:')
    for (const a of all ?? []) console.log(`  ${a.id}  ${a.name}`)
    process.exit(1)
  }
  console.log(`\nアーティスト: ${artist.name} (${artist.youtube_channel_id})`)

  // 追加日 = artist.created_at（歴史データを入れても変わらない基準日）
  const additionDate = artist.created_at.slice(0, 10)

  // 追加日のスナップショットから total_views を取得（なければ直後の実データを使う）
  const { data: addSnap } = await supabase
    .from('view_snapshots')
    .select('total_views, snapshot_date')
    .eq('artist_id', artistId)
    .gte('snapshot_date', additionDate)
    .order('snapshot_date', { ascending: true })
    .limit(1)
    .maybeSingle()

  const totalViewsAtAddition = BigInt(addSnap?.total_views ?? 0)
  console.log(`追加日: ${additionDate} / 総再生数: ${Number(totalViewsAtAddition).toLocaleString()}`)

  // JSONファイル読み込み
  if (!fs.existsSync(filePath)) {
    console.error(`ファイルが見つかりません: ${filePath}`)
    process.exit(1)
  }
  const monthly: MonthlyRecord[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  console.log(`\nファイル読み込み: ${filePath} (${monthly.length}件)`)
  for (const m of monthly) {
    console.log(`  ${m.month}: ${m.monthly_views.toLocaleString()} views/月`)
  }

  // 追加日より前のデータのみ使用
  const historical = monthly.filter(m => m.month < additionDate.slice(0, 7))
  console.log(`\n追加日(${additionDate})より前のデータ: ${historical.length}件`)

  if (historical.length === 0) {
    console.warn('インポートするデータがありません（追加日より前の月次データが必要）')
    process.exit(0)
  }

  // 日次レコード生成
  const daily = generateDailyRecords(historical, totalViewsAtAddition, additionDate)
  console.log(`日次レコード数: ${daily.length}件 (${daily[0]?.date} 〜 ${daily.at(-1)?.date})`)

  // 指数計算
  const indexValues = calcIndexValues(daily, artist.initial_index, additionDate)
  const sampleDates = [daily[0]?.date, daily[Math.floor(daily.length / 2)]?.date, daily.at(-1)?.date].filter(Boolean)
  console.log('\n指数サンプル:')
  for (const d of sampleDates) {
    console.log(`  ${d}: ${(indexValues.get(d!) ?? 0).toFixed(1)}`)
  }

  if (dryRun) {
    console.log('\n--dry-run: DBへの書き込みをスキップしました')
    return
  }

  // DB書き込み
  console.log('\nDBへ書き込み中...')
  await importToDb(artistId, daily, indexValues, additionDate)
  console.log('完了')
}

main().catch(console.error)
