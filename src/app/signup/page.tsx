'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    })
    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        {/* ロゴ */}
        <div className="text-center mb-8">
          <p className="text-2xl font-bold tracking-tight">Artist Index</p>
          <p className="text-sm text-dim mt-1">アーティストの指数を売買する</p>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-8">
          {sent ? (
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-mga/10 flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-mga" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="font-semibold mb-1">メールを送信しました</p>
              <p className="text-dim text-sm">{email} のリンクから登録を完了してください。</p>
            </div>
          ) : (
            <>
              <h1 className="text-lg font-bold mb-1">新規登録</h1>
              <p className="text-xs text-dim mb-6">メールアドレスだけで始められます</p>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="text-xs text-dim block mb-1.5">メールアドレス</label>
                  <input
                    type="email"
                    required
                    autoFocus
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-dim transition-colors"
                  />
                </div>
                {error && <p className="text-accent text-xs">{error}</p>}
                <button
                  type="submit"
                  disabled={loading || !email}
                  className="bg-text text-bg rounded-lg py-2.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  {loading ? '送信中...' : '登録リンクを送る'}
                </button>
              </form>
              <p className="text-center text-xs text-dim mt-6">
                すでにアカウントをお持ちの方は
                <Link href="/login" className="text-text underline ml-1 hover:opacity-70 transition-opacity">
                  ログイン
                </Link>
              </p>
            </>
          )}
        </div>

        <p className="text-center text-xs text-dim mt-6 px-4">
          登録することで利用規約およびプライバシーポリシーに同意したものとみなします。
        </p>
      </div>
    </div>
  )
}
