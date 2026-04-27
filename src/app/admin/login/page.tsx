'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminLoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (res.ok) {
      router.push('/admin')
    } else {
      const data = await res.json()
      setError(data.error ?? 'エラーが発生しました')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <div className="bg-surface border border-border rounded-xl p-8 w-full max-w-sm">
        <h1 className="text-lg font-bold mb-6 text-center">Admin</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="password"
            placeholder="パスワード"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            className="border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-dim bg-white"
          />
          <button
            type="submit"
            disabled={loading || !password}
            className="bg-text text-bg rounded-lg py-2 text-sm font-medium disabled:opacity-40 transition-opacity"
          >
            {loading ? '確認中...' : 'ログイン'}
          </button>
          {error && <p className="text-accent text-xs text-center">{error}</p>}
        </form>
      </div>
    </div>
  )
}
