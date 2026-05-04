// ── 動的称号（DBなし・毎回計算） ─────────────────────────────────────────────
// 「保有中のみ有効」「売ると消える」タイプ。
// 保存コードは参考用（将来SNSシェア画像などに使う想定）。

export const EARLY_BIRD_THRESHOLDS: { code: string; label: string; maxDays: number }[] = [
  { code: 'ultra_watcher', label: '超監視者', maxDays: 1 },
  { code: 'watcher',       label: '監視者',   maxDays: 3 },
  { code: 'digger',        label: '発掘者',   maxDays: 7 },
  { code: 'pioneer',       label: '先行者',   maxDays: 30 },
  { code: 'visionary',     label: '先見者',   maxDays: 90 },
]

export const HOLDER_THRESHOLDS: { code: string; label: string; minDays: number }[] = [
  { code: 'holder_1m', label: '1ヶ月ホルダー', minDays: 30 },
  { code: 'holder_3m', label: '3ヶ月ホルダー', minDays: 90 },
  { code: 'holder_6m', label: '半年ホルダー',  minDays: 180 },
  { code: 'holder_1y', label: '年間ホルダー',  minDays: 365 },
]

/**
 * 早期発見称号ラベルを返す（最も厳しい適合段のみ）
 * @param investedAt  最初の購入日時（ISO文字列）
 * @param publishedAt アーティスト公開日時（ISO文字列 | null）
 */
export function getEarlyBirdTitle(investedAt: string, publishedAt: string | null): string | null {
  if (!publishedAt) return null
  const diffDays = (new Date(investedAt).getTime() - new Date(publishedAt).getTime()) / 86_400_000
  if (diffDays < 0) return null
  for (const t of EARLY_BIRD_THRESHOLDS) {
    if (diffDays <= t.maxDays) return t.label
  }
  return null
}

/**
 * 長期保有称号ラベルを返す（最高段のみ）
 * @param earliestInvestmentAt アーティストへの最初の購入日時（ISO文字列）
 */
export function getHolderTitle(earliestInvestmentAt: string): string | null {
  const diffDays = (Date.now() - new Date(earliestInvestmentAt).getTime()) / 86_400_000
  let best: string | null = null
  for (const t of HOLDER_THRESHOLDS) {
    if (diffDays >= t.minDays) best = t.label
  }
  return best
}
