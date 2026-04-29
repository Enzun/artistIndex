/**
 * GET /api/admin/search-artist?name=xxx
 * アーティスト名から Spotify ID と Wikipedia 記事名を検索する。
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export const maxDuration = 30

async function searchSpotify(name: string): Promise<{ id: string; name: string; followers: number } | null> {
  try {
    const creds = Buffer.from(
      `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
    ).toString('base64')
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${creds}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
      signal: AbortSignal.timeout(8000),
    })
    if (!tokenRes.ok) return null
    const { access_token } = await tokenRes.json() as { access_token: string }

    const url = new URL('https://api.spotify.com/v1/search')
    url.searchParams.set('q', name)
    url.searchParams.set('type', 'artist')
    url.searchParams.set('limit', '1')
    url.searchParams.set('market', 'JP')
    const searchRes = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${access_token}` },
      signal: AbortSignal.timeout(8000),
    })
    if (!searchRes.ok) return null
    const data = await searchRes.json() as {
      artists: { items: Array<{ id: string; name: string; followers: { total: number } }> }
    }
    const item = data.artists.items[0]
    if (!item) return null
    return { id: item.id, name: item.name, followers: item.followers.total }
  } catch {
    return null
  }
}

async function searchWikipedia(name: string): Promise<{ title: string } | null> {
  try {
    const url = new URL('https://ja.wikipedia.org/w/api.php')
    url.searchParams.set('action', 'query')
    url.searchParams.set('list', 'search')
    url.searchParams.set('srsearch', name)
    url.searchParams.set('srnamespace', '0')
    url.searchParams.set('srlimit', '1')
    url.searchParams.set('format', 'json')
    url.searchParams.set('origin', '*')
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'artistIndex-admin/1.0' },
    })
    if (!res.ok) return null
    const data = await res.json() as {
      query: { search: Array<{ title: string }> }
    }
    const item = data.query.search[0]
    if (!item) return null
    return { title: item.title }
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  const session = cookieStore.get('admin_session')?.value
  if (!session || session !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const name = request.nextUrl.searchParams.get('name')?.trim()
  if (!name) {
    return NextResponse.json({ error: '名前が必要です' }, { status: 400 })
  }

  const [spotify, wikipedia] = await Promise.all([
    searchSpotify(name),
    searchWikipedia(name),
  ])

  return NextResponse.json({ spotify, wikipedia })
}
