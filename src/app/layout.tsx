import type { Metadata } from 'next'
import './globals.css'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Artist Index',
  description: 'アーティストの指数を売買する、音楽ファンのための新しいプラットフォーム',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <html lang="ja">
      <body className="min-h-screen">
        <nav className="border-b border-border px-6 py-3 flex items-center justify-between bg-surface">
          <Link href="/" className="font-bold text-base tracking-tight">
            Artist Index
          </Link>
          <div className="flex gap-5 text-sm">
            {user ? (
              <>
                <Link href="/portfolio" className="text-dim hover:text-text transition-colors">
                  ポートフォリオ
                </Link>
                <form action="/auth/signout" method="post">
                  <button className="text-dim hover:text-text transition-colors">
                    ログアウト
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link href="/login" className="text-dim hover:text-text transition-colors">
                  ログイン
                </Link>
                <Link href="/signup" className="text-text font-medium hover:opacity-70 transition-opacity">
                  新規登録
                </Link>
              </>
            )}
          </div>
        </nav>

        <main className="max-w-3xl mx-auto px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  )
}
