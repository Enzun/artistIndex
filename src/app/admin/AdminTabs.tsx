'use client'

import { useState } from 'react'
import AddArtistForm from './AddArtistForm'
import AdminArtistList from './AdminArtistList'
import { SHAPE_RANGES, SHAPE_EMOJI, MAX_PER_SHAPE, type TitleShape } from '@/lib/titles'

// ── 型定義 ────────────────────────────────────────────────────────────────

type Artist = {
  id: string
  name: string
  status: string
  current_index: number
  youtube_channel_id: string
  wikipedia_ja: string | null
  created_at: string
  thumbnail_url: string | null
  index_scale: number | null
}

type SnapshotStat = {
  artist_id: string
  count: number
  last_yt_increase_date: string | null
  wikipedia_null: boolean
}

type CronLog = {
  id: string
  job: string
  status: string
  summary: Record<string, unknown> | null
  created_at: string
  finished_at: string | null
}

type TitleRow = {
  id: string
  points_spent: number
  showcase_order: number | null
  user_id: string
}

type Props = {
  artists: Artist[]
  statsMap: Record<string, SnapshotStat>
  hIndexMap: Record<string, number | null>
  cronLogs: CronLog[]
  titles: TitleRow[]
  titleUserCount: number
}

// ── 実績称号の定義（title-types.mdをUI化）────────────────────────────────

type AchievementDef = {
  category: string
  name: string
  condition: string
  type: '動的' | '付与型'
  status: '未実装' | '実装済み'
  perArtist: boolean
}

const ACHIEVEMENT_DEFS: AchievementDef[] = [
  // 利益率系
  { category: '利益率', name: 'ハーフバガー', condition: '1案件で+50%以上で売却', type: '付与型', status: '未実装', perArtist: false },
  { category: '利益率', name: 'ダブルバガー', condition: '1案件で+100%以上で売却', type: '付与型', status: '未実装', perArtist: false },
  { category: '利益率', name: 'トリプルバガー', condition: '1案件で+200%以上で売却', type: '付与型', status: '未実装', perArtist: false },
  { category: '利益率', name: 'テンバガー', condition: '1案件で+1000%以上で売却', type: '付与型', status: '未実装', perArtist: false },
  // 早期発見系
  { category: '早期発見', name: '超監視者 [アーティスト]', condition: '公開から1日以内に購入・保有中', type: '動的', status: '未実装', perArtist: true },
  { category: '早期発見', name: '監視者 [アーティスト]', condition: '公開から3日以内に購入・保有中', type: '動的', status: '未実装', perArtist: true },
  { category: '早期発見', name: '発掘者 [アーティスト]', condition: '公開から7日以内に購入・保有中', type: '動的', status: '未実装', perArtist: true },
  { category: '早期発見', name: '先行者 [アーティスト]', condition: '公開から30日以内に購入・保有中', type: '動的', status: '未実装', perArtist: true },
  { category: '早期発見', name: '先見者 [アーティスト]', condition: '公開から90日以内に購入・保有中', type: '動的', status: '未実装', perArtist: true },
  // 長期保有系
  { category: '長期保有', name: '1ヶ月ホルダー [アーティスト]', condition: '初回購入から30日以上保有', type: '動的', status: '未実装', perArtist: true },
  { category: '長期保有', name: '3ヶ月ホルダー [アーティスト]', condition: '初回購入から90日以上保有', type: '動的', status: '未実装', perArtist: true },
  { category: '長期保有', name: '半年ホルダー [アーティスト]', condition: '初回購入から180日以上保有', type: '動的', status: '未実装', perArtist: true },
  { category: '長期保有', name: '年間ホルダー [アーティスト]', condition: '初回購入から365日以上保有', type: '動的', status: '未実装', perArtist: true },
  // 規模系
  { category: '規模', name: '大口投資家', condition: '1回の購入が10,000pt以上', type: '付与型', status: '未実装', perArtist: false },
  { category: '規模', name: '鯨', condition: '1回の購入が100,000pt以上', type: '付与型', status: '未実装', perArtist: false },
  // 多様性系
  { category: '多様性', name: '分散投資家', condition: '同時に3アーティスト以上保有', type: '動的', status: '未実装', perArtist: false },
  { category: '多様性', name: 'コレクター', condition: '同時に5アーティスト以上保有', type: '動的', status: '未実装', perArtist: false },
]

// ── 称号タブ ──────────────────────────────────────────────────────────────

function TitlesTab({ titles, titleUserCount }: { titles: TitleRow[]; titleUserCount: number }) {
  // 形状ごとの統計
  const shapeStats = SHAPE_RANGES.map(r => {
    const items = titles.filter(t => t.points_spent >= r.min && t.points_spent <= r.max)
    const showcased = items.filter(t => t.showcase_order !== null).length
    return { ...r, count: items.length, showcased }
  })

  const totalTitles = titles.length
  const totalShowcased = titles.filter(t => t.showcase_order !== null).length

  // カテゴリごとにグループ化
  const categories = Array.from(new Set(ACHIEVEMENT_DEFS.map(d => d.category)))

  return (
    <div className="flex flex-col gap-8">
      {/* サマリー */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-surface border border-border rounded-xl p-4 text-center">
          <p className="text-xs text-dim mb-1">称号総購入数</p>
          <p className="text-2xl font-bold tabular-nums">{totalTitles}</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4 text-center">
          <p className="text-xs text-dim mb-1">保有ユーザー数</p>
          <p className="text-2xl font-bold tabular-nums">{titleUserCount}</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4 text-center">
          <p className="text-xs text-dim mb-1">ショーケース設定中</p>
          <p className="text-2xl font-bold tabular-nums">{totalShowcased}</p>
        </div>
      </div>

      {/* 購入称号 種類一覧 */}
      <div>
        <h2 className="text-sm font-semibold mb-3">購入称号（{SHAPE_RANGES.length}種類・実装済み）</h2>
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-dim">
                <th className="text-left px-4 py-2.5 font-medium">形状</th>
                <th className="text-left px-4 py-2.5 font-medium">ptレンジ</th>
                <th className="text-center px-4 py-2.5 font-medium">上限</th>
                <th className="text-center px-4 py-2.5 font-medium">有効</th>
                <th className="text-center px-4 py-2.5 font-medium">画像</th>
                <th className="text-right px-4 py-2.5 font-medium">所持数</th>
                <th className="text-right px-4 py-2.5 font-medium">ショーケース中</th>
              </tr>
            </thead>
            <tbody>
              {shapeStats.map((s, i) => (
                <tr key={s.shape} className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-surface2/30'}`}>
                  <td className="px-4 py-2.5">
                    <span className="mr-1.5">{SHAPE_EMOJI[s.shape as TitleShape]}</span>
                    <span className="text-sm">{s.shape}</span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-dim tabular-nums">
                    {s.min.toLocaleString()} 〜 {s.max.toLocaleString()} pt
                  </td>
                  <td className="px-4 py-2.5 text-center text-xs text-dim">{MAX_PER_SHAPE}個</td>
                  <td className="px-4 py-2.5 text-center text-xs text-mga">✓</td>
                  <td className="px-4 py-2.5 text-center text-xs text-dim">絵文字のみ</td>
                  <td className="px-4 py-2.5 text-right text-sm tabular-nums font-medium">{s.count}</td>
                  <td className="px-4 py-2.5 text-right text-xs text-dim tabular-nums">{s.showcased}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 実績称号 */}
      <div>
        <h2 className="text-sm font-semibold mb-3">実績称号（未実装・候補）</h2>
        <div className="flex flex-col gap-4">
          {categories.map(cat => (
            <div key={cat}>
              <p className="text-xs text-dim font-medium mb-2">{cat}</p>
              <div className="bg-surface border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-dim">
                      <th className="text-left px-4 py-2 font-medium">称号名</th>
                      <th className="text-left px-4 py-2 font-medium">条件</th>
                      <th className="text-center px-4 py-2 font-medium">付与方式</th>
                      <th className="text-center px-4 py-2 font-medium">アーティスト別</th>
                      <th className="text-center px-4 py-2 font-medium">状態</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ACHIEVEMENT_DEFS.filter(d => d.category === cat).map((d, i) => (
                      <tr key={d.name} className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-surface2/30'}`}>
                        <td className="px-4 py-2 text-sm">{d.name}</td>
                        <td className="px-4 py-2 text-xs text-dim">{d.condition}</td>
                        <td className="px-4 py-2 text-center">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                            d.type === '動的' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'
                          }`}>
                            {d.type}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-center text-xs text-dim">
                          {d.perArtist ? '✓' : '—'}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <span className="text-xs px-1.5 py-0.5 rounded bg-surface2 text-dim font-medium">
                            {d.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── メインタブコンポーネント ──────────────────────────────────────────────

export default function AdminTabs({ artists, statsMap, hIndexMap, cronLogs, titles, titleUserCount }: Props) {
  const [tab, setTab] = useState<'artists' | 'titles'>('artists')

  return (
    <div>
      {/* タブナビゲーション */}
      <div className="flex border-b border-border mb-6">
        {([
          { key: 'artists', label: 'アーティスト' },
          { key: 'titles',  label: '称号' },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === key
                ? 'border-text text-text'
                : 'border-transparent text-dim hover:text-text'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* アーティストタブ */}
      {tab === 'artists' && (
        <div>
          <AddArtistForm />
          <AdminArtistList artists={artists} statsMap={statsMap} hIndexMap={hIndexMap} />

          <h2 className="text-sm font-semibold mb-3 mt-8">Cron ログ（直近30件）</h2>
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-dim">
                  <th className="text-left px-4 py-2.5 font-medium">job</th>
                  <th className="text-left px-4 py-2.5 font-medium">status</th>
                  <th className="text-left px-4 py-2.5 font-medium">summary</th>
                  <th className="text-right px-4 py-2.5 font-medium">実行日時</th>
                </tr>
              </thead>
              <tbody>
                {cronLogs.map((log, i) => (
                  <tr key={log.id} className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-surface2/50'}`}>
                    <td className="px-4 py-2.5 font-mono text-xs">{log.job}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        log.status === 'success' ? 'bg-mga/10 text-mga'
                        : log.status === 'error' ? 'bg-accent/10 text-accent'
                        : 'bg-surface2 text-dim'
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-dim font-mono">
                      {log.summary ? JSON.stringify(log.summary) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right text-dim text-xs">
                      {log.created_at.replace('T', ' ').substring(0, 16)}
                    </td>
                  </tr>
                ))}
                {cronLogs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-dim text-xs">ログがありません</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 称号タブ */}
      {tab === 'titles' && (
        <TitlesTab titles={titles} titleUserCount={titleUserCount} />
      )}
    </div>
  )
}
