'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CONTACT_EMAIL } from '@/lib/config'

// ── ヘルプ ────────────────────────────────────────────────────────────────

const HELP_ITEMS = [
  {
    q: 'このアプリは何ですか？',
    a: 'アーティストの「人気指数」をポイントで売買するシミュレーションゲームです。指数が上がれば利益、下がれば損失になります。ポイントはゲーム内通貨で、現実のお金は動きません。無料で遊べます。',
  },
  {
    q: '指数はどうやって決まりますか？',
    a: 'YouTubeのチャンネル総再生数をもとに独自の計算式で算出し、毎日深夜0時頃に自動更新されます。再生数の伸びが続くと指数が上がり、伸びが鈍化すると下がります。登録者数ではなく「再生数の増加ペース」を重視した設計です。',
  },
  {
    q: '指数がおかしい・実際の人気と違う気がする',
    a: '指数はYouTube再生数の増加ペースをもとにした独自計算値であり、実際の知名度・人気と完全には一致しません。「事務所所属アーティストはデビュー曲で再生数が一気に増えるため指数が高くなりやすい」など、構造上の偏りが生じる場合があります。あくまでゲームの数値としてお楽しみください。',
  },
  {
    q: '好きなアーティストが登録されていない',
    a: 'アーティストは運営が順次追加しています。現在β版のため掲載数は限られています。リクエストはお問い合わせメールまでお気軽にどうぞ。必ずしも追加できるとは限りませんが、参考にさせていただきます。',
  },
  {
    q: '指数が急落した・急騰した',
    a: '再生数の伸びが急変した場合に指数が大きく動くことがあります。また、データ取得のタイミングによって一時的な誤差が生じる場合があります。翌日以降に落ち着くケースがほとんどです。明らかな異常値を発見した場合はお問い合わせください。',
  },
  {
    q: '購入・売却の方法は？',
    a: 'アーティストページの「購入」フォームからポイントを使って購入できます。売却はポートフォリオページの取引履歴カードにある「売却」ボタンから行えます。売却額は売却時点の指数に基づいて計算されます。',
  },
  {
    q: '称号とは何ですか？',
    a: '特定の条件を達成すると自動で付与されるバッジです。「公開直後に購入」「長期保有」「大きな利益で売却」などの条件があります。称号ページで確認・シェアができ、シェア用スロットに最大3つセットできます。',
  },
  {
    q: 'ポイントが足りません',
    a: '登録時に5,000ptが無料で付与されます。売買で増やすことができます。また、設定ページの「データをリセットする」を実行すると、全取引履歴が削除されて5,000ptからやり直せます（取り消し不可）。',
  },
  {
    q: '課金要素はありますか？',
    a: 'ありません。ポイントはすべてゲーム内通貨で、現実のお金は一切動きません。現在β版のため、すべての機能を無料でお使いいただけます。',
  },
]

function HelpAccordion() {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <div className="flex flex-col gap-3">
      <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
        {HELP_ITEMS.map((item, i) => (
          <div key={i}>
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-surface2/50 transition-colors"
            >
              <span className="text-sm font-medium">{item.q}</span>
              <span className="text-dim text-xs ml-3 flex-shrink-0">{open === i ? '▲' : '▼'}</span>
            </button>
            {open === i && (
              <div className="px-4 pb-4 text-xs text-dim leading-relaxed">{item.a}</div>
            )}
          </div>
        ))}
      </div>
      <p className="text-xs text-dim px-1">
        その他のご質問は{' '}
        <a href={`mailto:${CONTACT_EMAIL}`} className="underline hover:text-text transition-colors">
          {CONTACT_EMAIL}
        </a>{' '}
        までお気軽にどうぞ。
      </p>
    </div>
  )
}

function DangerSection({
  title,
  description,
  buttonLabel,
  confirmLabel,
  confirmText,
  confirmPlaceholder,
  onConfirm,
  successContent,
  globalBusy,
  onBusyChange,
}: {
  title: string
  description: string
  buttonLabel: string
  confirmLabel: string
  confirmText: string
  confirmPlaceholder: string
  onConfirm: () => Promise<void>
  successContent?: React.ReactNode
  globalBusy: boolean
  onBusyChange: (busy: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function handleConfirm() {
    setLoading(true)
    onBusyChange(true)
    setError('')
    try {
      await onConfirm()
      setDone(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '失敗しました')
      setLoading(false)
      onBusyChange(false)
    }
  }

  if (done && successContent) {
    return (
      <div className="border border-border rounded-xl p-5">
        {successContent}
      </div>
    )
  }

  return (
    <div className="border border-accent/30 rounded-xl p-5">
      <p className="font-semibold text-sm mb-1">{title}</p>
      <p className="text-xs text-dim mb-4 leading-relaxed">{description}</p>

      {!open ? (
        <button
          onClick={() => setOpen(true)}
          disabled={globalBusy}
          className="text-xs text-accent border border-accent/40 rounded-lg px-3 py-1.5 hover:bg-accent/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {buttonLabel}
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-dim">{confirmLabel}</p>
          <input
            type="text"
            placeholder={confirmPlaceholder}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full bg-white border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent transition-colors"
          />
          {error && <p className="text-accent text-xs">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleConfirm}
              disabled={input !== confirmText || loading}
              className="bg-accent text-white rounded-lg px-4 py-1.5 text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {loading ? '処理中...' : buttonLabel}
            </button>
            <button
              onClick={() => { setOpen(false); setInput('') }}
              disabled={loading}
              className="text-xs text-dim hover:text-text transition-colors px-3 py-1.5 disabled:opacity-40"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function SettingsPage() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function handleReset() {
    const res = await fetch('/api/account/reset', { method: 'POST' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    router.refresh()
  }

  async function handleDelete() {
    const res = await fetch('/api/account/delete', { method: 'POST' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    router.push('/welcome')
    router.refresh()
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-bold mb-8">設定</h1>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-dim uppercase tracking-wide mb-4">ヘルプ</h2>
        <HelpAccordion />
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-dim uppercase tracking-wide mb-4">アカウント</h2>
        <form action="/auth/signout" method="post">
          <button className="text-sm text-dim hover:text-text transition-colors">
            ログアウト
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-dim uppercase tracking-wide mb-4">危険な操作</h2>
        <div className="flex flex-col gap-4">
          <DangerSection
            title="データをリセットする"
            description="保有中のカードがすべて消え、取引履歴も削除されます。ポイントは5,000ptに戻ります。この操作は取り消せません。"
            buttonLabel="リセットする"
            confirmLabel="確認のため「リセット」と入力してください"
            confirmText="リセット"
            confirmPlaceholder="リセット"
            onConfirm={handleReset}
            globalBusy={busy}
            onBusyChange={setBusy}
            successContent={
              <div className="text-center py-2">
                <div className="w-10 h-10 rounded-full bg-mga/10 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-5 h-5 text-mga" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="font-semibold text-sm mb-1">リセット完了</p>
                <p className="text-xs text-dim mb-4">ポイントが5,000ptに戻りました。</p>
                <Link
                  href="/"
                  className="inline-block bg-text text-bg rounded-lg px-5 py-2 text-xs font-medium hover:opacity-90 transition-opacity"
                >
                  トップへ戻る
                </Link>
              </div>
            }
          />
          <DangerSection
            title="アカウントを削除する"
            description="アカウントと全データが完全に削除されます。同じメールアドレスで再登録できますが、現在の取引履歴は復元できません。"
            buttonLabel="アカウントを削除する"
            confirmLabel="確認のため「アカウントを削除」と入力してください"
            confirmText="アカウントを削除"
            confirmPlaceholder="アカウントを削除"
            onConfirm={handleDelete}
            globalBusy={busy}
            onBusyChange={setBusy}
          />
        </div>
      </section>
    </div>
  )
}
