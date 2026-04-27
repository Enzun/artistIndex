'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ActivateButton({ artistId }: { artistId: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleActivate() {
    if (!confirm('このアーティストを公開しますか？')) return
    setLoading(true)
    setError('')
    const res = await fetch(`/api/admin/activate/${artistId}`, { method: 'POST' })
    if (res.ok) {
      router.refresh()
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? '失敗しました')
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={handleActivate}
        disabled={loading}
        className="bg-mga/10 border border-mga/30 text-mga rounded-lg px-5 py-2 text-sm font-medium hover:bg-mga/20 transition-colors disabled:opacity-50"
      >
        {loading ? '処理中...' : '公開する (active)'}
      </button>
      {error && <p className="text-accent text-xs mt-2">{error}</p>}
    </div>
  )
}
