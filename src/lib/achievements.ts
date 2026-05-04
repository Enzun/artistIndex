// ── 実績称号の内部コード定義 ────────────────────────────────────────────────
// 内部コード(type列)と表示名を分離することで、後から表示名だけ変更できる。
// DB に保存されるのは内部コードのみ。

export type AchievementCode =
  | 'half_bagger' | 'double_bagger' | 'triple_bagger' | 'ten_bagger'
  | 'investor' | 'big_investor' | 'rich' | 'whale'

/** 内部コード → 表示名（ここだけ変えれば全体に反映） */
export const ACHIEVEMENT_LABELS: Record<AchievementCode, string> = {
  half_bagger:   'ハーフバガー 🥳',
  double_bagger: 'ダブルバガー 🥳',
  triple_bagger: 'トリプルバガー 🥳',
  ten_bagger:    'テンバガー 🥳',
  investor:      '投資家',
  big_investor:  '大口投資家',
  rich:          '富豪',
  whale:         '鯨🐋',
}

// ── バガー系（売却時に判定・一生に一度） ─────────────────────────────────────
// multiplier = points_returned / points_invested の閾値
// 小さい順に定義（複数同時達成時は該当するものすべて付与）
export const BAGGER_THRESHOLDS: { code: AchievementCode; multiplier: number }[] = [
  { code: 'half_bagger',   multiplier: 1.5  }, // +50%
  { code: 'double_bagger', multiplier: 2.0  }, // +100%
  { code: 'triple_bagger', multiplier: 3.0  }, // +200%
  { code: 'ten_bagger',    multiplier: 11.0 }, // +1000%
]

// ── 規模系（購入時に判定・一生に一度） ───────────────────────────────────────
// 小さい順に定義（複数同時達成時は該当するものすべて付与）
export const SCALE_THRESHOLDS: { code: AchievementCode; minPoints: number }[] = [
  { code: 'investor',     minPoints: 10_000 },
  { code: 'big_investor', minPoints: 100_000 },
  { code: 'rich',         minPoints: 1_000_000 },
  { code: 'whale',        minPoints: 10_000_000 },
]

// ── ユーティリティ ────────────────────────────────────────────────────────────

/**
 * 売却損益からバガーラベルを返す（取引履歴カード表示用・DBなし）
 * 最高段のみ返す
 */
export function getBaggerLabel(pointsInvested: number, pointsReturned: number): string | null {
  if (pointsInvested <= 0) return null
  const ratio = pointsReturned / pointsInvested
  let best: AchievementCode | null = null
  for (const t of BAGGER_THRESHOLDS) {
    if (ratio >= t.multiplier) best = t.code
  }
  return best ? ACHIEVEMENT_LABELS[best] : null
}
