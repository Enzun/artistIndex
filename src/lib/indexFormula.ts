/**
 * H式（B+Eブレンド）指数計算
 *
 * index = (1 - blendW) × E  +  blendW × B
 *   B = total_views^yta × SF × max(wR, 0.1)^wb
 *   E = B × max(ytM, 0.05)^ytg
 *   SF = SCALE / startViews^yta   （アーティスト追加日の総再生数を基準）
 *   ytM = avg(daily_rate, ws日) / avg(daily_rate, wlYt日)
 *   wR  = avg(wiki_pv, ws日)    / avg(wiki_pv,    wlWiki日)
 *
 * daily_rate: YouTube更新日の増分を区間日数で均等割りし、非更新日に補間
 */

export type SnapRow = {
  snapshot_date: string
  total_views: number
  daily_increase: number
  wikipedia_pageviews: number | null
}

type SnapWithRate = SnapRow & { daily_rate: number }

export type HParams = {
  SCALE:   number  // 基準指数（アーティスト追加日がこの値になる）
  yta:     number  // total_views のべき乗
  ytg:     number  // ytMomentum のべき乗
  wb:      number  // wiki_ratio のべき乗
  ws:      number  // 短期ウィンドウ（日）
  wlWiki:  number  // Wikiベースライン（日）
  wlYt:    number  // YTベースライン（日）
  blendW:  number  // B割合（0=E式のみ, 1=累積のみ）
}

/** Admin用デフォルトパラメータ（Formula.txt 候補B ★推奨） */
export const DEFAULT_H_PARAMS: HParams = {
  SCALE:  500,
  yta:    1.15,
  ytg:    0.85,
  wb:     0.15,
  ws:     1,
  wlWiki: 14,
  wlYt:   14,
  blendW: 0.70,
}

// ─── 内部ユーティリティ ────────────────────────────────────────────────────────

function interpolateDailyRates(snaps: SnapRow[]): SnapWithRate[] {
  const rates = new Array(snaps.length).fill(0)
  let prevIdx = -1
  for (let i = 0; i < snaps.length; i++) {
    if (snaps[i].daily_increase > 0) {
      if (prevIdx >= 0) {
        const interval = i - prevIdx
        const rate = snaps[i].daily_increase / interval
        for (let j = prevIdx + 1; j <= i; j++) rates[j] = rate
      }
      prevIdx = i
    }
  }
  if (prevIdx >= 0) {
    const last = rates[prevIdx]
    for (let j = prevIdx + 1; j < snaps.length; j++) rates[j] = last
  }
  return snaps.map((s, i) => ({ ...s, daily_rate: rates[i] }))
}

function rollMean(vals: number[]): number {
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
}

function rollWiki(snaps: SnapWithRate[], i: number, win: number): number {
  return rollMean(
    snaps.slice(Math.max(0, i - win + 1), i + 1).map(s => s.wikipedia_pageviews ?? 0)
  )
}

function rollYt(snaps: SnapWithRate[], i: number, win: number): number {
  return rollMean(
    snaps.slice(Math.max(0, i - win + 1), i + 1)
      .map(s => s.daily_rate)
      .filter(v => v > 0)
  )
}

// ─── 公開API ──────────────────────────────────────────────────────────────────

/**
 * スナップショット列からH式指数の最終値を計算する。
 * - snaps は snapshot_date 昇順でソート済みであること
 * - データ不足（< MIN_DAYS）の場合は null を返す
 */
export function calcHIndex(
  snaps: SnapRow[],
  params: HParams = DEFAULT_H_PARAMS,
  minDays = 1,
): number | null {
  if (snaps.length < minDays) return null

  const startViews = snaps[0].total_views
  if (!startViews) return null

  const { SCALE, yta, ytg, wb, ws, wlWiki, wlYt, blendW } = params
  const SF = SCALE / Math.pow(startViews, yta)
  const withRates = interpolateDailyRates(snaps)
  const i = withRates.length - 1
  const s = withRates[i]
  if (!s.total_views) return null

  const ytShort = rollYt(withRates, i, ws)
  const ytLong  = rollYt(withRates, i, wlYt)
  const ytMom   = ytLong > 0 ? Math.max(ytShort / ytLong, 0.05) : 1.0

  const wShort  = rollWiki(withRates, i, ws)
  const wLong   = rollWiki(withRates, i, wlWiki)
  const wRatio  = Math.max(wShort / Math.max(wLong, 5), 0.1)

  const bVal = Math.pow(s.total_views, yta) * SF * Math.pow(wRatio, wb)
  const eVal = bVal * Math.pow(ytMom, ytg)
  return (1 - blendW) * eVal + blendW * bVal
}
