import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// 未ログインでもアクセス可能なパス
const PUBLIC_PATHS = ['/welcome', '/login', '/signup', '/preview', '/terms', '/privacy', '/auth', '/api']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // /admin 以下は admin_session cookie で保護（/admin/login は除外）
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    const adminSession = request.cookies.get('admin_session')?.value
    const adminPassword = process.env.ADMIN_PASSWORD
    if (!adminPassword || adminSession !== adminPassword) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet: { name: string; value: string; options: object }[]) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          toSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isPublic = PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))

  // 未ログイン: 非公開ページ → /welcome へ
  if (!user && !isPublic) {
    return NextResponse.redirect(new URL('/welcome', request.url))
  }

  // ログイン済み: login/signup → / へ
  if (user && (pathname === '/login' || pathname === '/signup')) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
