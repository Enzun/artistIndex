export type TitleShape =
  | '葉っぱ' | 'メダル' | '盾' | '剣' | 'トロフィ'
  | '王冠' | '水晶' | '星' | 'リンゴ(色)' | 'リンゴ(大)'

type ShapeRange = { shape: TitleShape; min: number; max: number }

export const SHAPE_RANGES: ShapeRange[] = [
  { shape: '葉っぱ',    min: 1,      max: 99 },
  { shape: 'メダル',    min: 100,    max: 999 },
  { shape: '盾',        min: 1000,   max: 4999 },
  { shape: '剣',        min: 5000,   max: 9999 },
  { shape: 'トロフィ',  min: 10000,  max: 19999 },
  { shape: '王冠',      min: 20000,  max: 49999 },
  { shape: '水晶',      min: 50000,  max: 99999 },
  { shape: '星',        min: 100000, max: 199999 },
  { shape: 'リンゴ(色)', min: 200000, max: 499999 },
  { shape: 'リンゴ(大)', min: 500000, max: 999999 },
]

export const MAX_PER_SHAPE = 3
export const BASE_SLOTS    = 3

export function getShape(pts: number): TitleShape {
  for (const r of SHAPE_RANGES) {
    if (pts <= r.max) return r.shape
  }
  return 'リンゴ(大)'
}

/** 0〜1: その形の範囲内での色の位置 */
export function getColorPosition(pts: number): number {
  for (const r of SHAPE_RANGES) {
    if (pts <= r.max) {
      return (pts - r.min) / (r.max - r.min)
    }
  }
  return 1
}

/**
 * 位置(0〜1)からHSL文字列を返す。
 * 白→緑→青→赤→銅→銀→金 の順でグラデーション。
 * デザイン確定後に差し替え予定。
 */
export function positionToColor(pos: number): string {
  const stops: [number, string][] = [
    [0.00, 'hsl(0,0%,92%)'],      // 白
    [0.20, 'hsl(140,55%,45%)'],   // 緑
    [0.40, 'hsl(210,75%,50%)'],   // 青
    [0.55, 'hsl(0,75%,50%)'],     // 赤
    [0.68, 'hsl(20,65%,42%)'],    // 銅
    [0.80, 'hsl(0,0%,72%)'],      // 銀
    [1.00, 'hsl(45,85%,52%)'],    // 金
  ]
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, c0] = stops[i]
    const [t1, c1] = stops[i + 1]
    if (pos <= t1) {
      // とりあえず両端の色をそのまま返す（SVG実装後に補間する）
      return pos - t0 < t1 - pos ? c0 : c1
    }
  }
  return stops.at(-1)![1]
}

/** point_slots 個目を追加するコスト（0始まり） */
export function slotCost(currentPointSlots: number): number {
  return 250 * Math.pow(2, currentPointSlots)
}

/** 形のプレースホルダー絵文字（SVG実装前の仮） */
export const SHAPE_EMOJI: Record<TitleShape, string> = {
  '葉っぱ':    '🍃',
  'メダル':    '🏅',
  '盾':        '🛡️',
  '剣':        '⚔️',
  'トロフィ':  '🏆',
  '王冠':      '👑',
  '水晶':      '💎',
  '星':        '⭐',
  'リンゴ(色)': '🍎',
  'リンゴ(大)': '🍎',
}
