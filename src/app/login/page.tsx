'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
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

  if (sent) {
    return (
      <div className="max-w-sm mx-auto text-center mt-16">
        <p className="text-lg font-semibold mb-2">メールを確認してください</p>
        <p className="text-dim text-sm">{email} にログインリンクを送りました。</p>
      </div>
    )
  }

  return (
    <div className="max-w-sm mx-auto mt-16">
      <h1 className="text-xl font-bold mb-6 text-center">ログイン</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="email"
          required
          placeholder="メールアドレス"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-text placeholder-dim focus:outline-none focus:border-dim"
        />
        {error && <p className="text-accent text-xs">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="bg-surface2 border border-border rounded-lg py-2.5 text-sm font-medium hover:border-dim transition-colors disabled:opacity-50"
        >
          {loading ? '送信中...' : 'ログインリンクを送る'}
        </button>
      </form>
    </div>
  )
}
