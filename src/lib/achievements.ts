// ── 実績称号の内部コード定義 ────────────────────────────────────────────────
// 内部コード(type列)と表示名を分離することで、後から表示名だけ変更できる。
// DB に保存されるのは内部コードのみ。

// ── グローバル称号（user_achievements テーブル） ──────────────────────────────

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

/** バガー系: 売却時に判定・一生に一度（小さい順） */
export const BAGGER_THRESHOLDS: { code: AchievementCode; multiplier: number }[] = [
  { code: 'half_bagger',   multiplier: 1.5  }, // +50%
  { code: 'double_bagger', multiplier: 2.0  }, // +100%
  { code: 'triple_bagger', multiplier: 3.0  }, // +200%
  { code: 'ten_bagger',    multiplier: 11.0 }, // +1000%
]

/** 規模系: 購入時に判定・一生に一度（小さい順） */
export const SCALE_THRESHOLDS: { code: AchievementCode; minPoints: number }[] = [
  { code: 'investor',     minPoints: 10_000 },
  { code: 'big_investor', minPoints: 100_000 },
  { code: 'rich',         minPoints: 1_000_000 },
  { code: 'whale',        minPoints: 10_000_000 },
]

// ── アーティスト別称号（user_artist_achievements テーブル） ──────────────────

export type ArtistAchievementCode =
  | 'ultra_watcher' | 'watcher' | 'digger' | 'pioneer'
  | 'holder_1m' | 'holder_3m' | 'holder_6m' | 'holder_1y'

/** 内部コード → 表示名 */
export const ARTIST_ACHIEVEMENT_LABELS: Record<ArtistAchievementCode, string> = {
  ultra_watcher: '超監視者',
  watcher:       '監視者',
  digger:        '発掘者',
  pioneer:       '先行者',
  holder_1m:     '1ヶ月ホルダー',
  holder_3m:     '3ヶ月ホルダー',
  holder_6m:     '半年ホルダー',
  holder_1y:     '年間ホルダー',
}

/** 内部コード → 絵文字 */
export const ARTIST_ACHIEVEMENT_EMOJI: Record<ArtistAchievementCode, string> = {
  ultra_watcher: '👁️',
  watcher:       '👀',
  digger:        '🔍',
  pioneer:       '🚀',
  holder_1m:     '📅',
  holder_3m:     '📆',
  holder_6m:     '🗓️',
  holder_1y:     '🏆',
}

/** 早期発見系: 購入時に判定・永続（最大日数が小さい順） */
export const EARLY_BIRD_THRESHOLDS: { code: ArtistAchievementCode; maxDays: number }[] = [
  { code: 'ultra_watcher', maxDays: 1 },
  { code: 'watcher',       maxDays: 3 },
  { code: 'digger',        maxDays: 7 },
  { code: 'pioneer',       maxDays: 30 },
]

/** 長期保有系: ページ訪問時に確認・永続（最小日数が小さい順） */
export const HOLDER_THRESHOLDS: { code: ArtistAchievementCode; minDays: number }[] = [
  { code: 'holder_1m', minDays: 30 },
  { code: 'holder_3m', minDays: 90 },
  { code: 'holder_6m', minDays: 180 },
  { code: 'holder_1y', minDays: 365 },
]

/** 内部コード → 達成条件テキスト（未達成時の表示用） */
export const ARTIST_ACHIEVEMENT_CONDITIONS: Record<ArtistAchievementCode, string> = {
  ultra_watcher: '公開から1日以内に購入',
  watcher:       '公開から3日以内に購入',
  digger:        '公開から7日以内に購入',
  pioneer:       '公開から30日以内に購入',
  holder_1m:     '初回購入から30日以上保有',
  holder_3m:     '初回購入から90日以上保有',
  holder_6m:     '初回購入から180日以上保有',
  holder_1y:     '初回購入から365日以上保有',
}

/**
 * 購入時の経過日数からアーティスト早期発見称号コードを返す（最も厳しい段のみ）
 * 例: 2日目購入 → 'watcher'（監視者）
 */
export function getEarlyBirdCode(diffDays: number): ArtistAchievementCode | null {
  if (diffDays < 0) return null
  for (const t of EARLY_BIRD_THRESHOLDS) {
    if (diffDays <= t.maxDays) return t.code
  }
  return null // 90日超はなし
}

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
