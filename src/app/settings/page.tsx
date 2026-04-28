'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

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
