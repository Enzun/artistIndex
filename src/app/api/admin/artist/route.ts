import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

async function resolveChannel(channelInput: string) {
  const url = new URL('https://www.googleapis.com/youtube/v3/channels')
  url.searchParams.set('part', 'statistics,snippet')
  if (channelInput.startsWith('UC')) {
    url.searchParams.set('id', channelInput)
  } else {
    url.searchParams.set('forHandle', channelInput.replace(/^@/, ''))
  }
  url.searchParams.set('key', process.env.YOUTUBE_API_KEY!)

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`YouTube API error: ${res.status}`)
  const data = await res.json() as {
    items?: Array<{
      id: string
      snippet: { title: string }
      statistics: { viewCount: string }
    }>
  }
  if (!data.items?.length) throw new Error(`チャンネルが見つかりません: ${channelInput}`)
  const item = data.items[0]
  return {
    channelId:    item.id,
    channelTitle: item.snippet.title,
    totalViews:   parseInt(item.statistics.viewCount, 10),
  }
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const session = cookieStore.get('admin_session')?.value
  if (!session || session !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { name, channelInput } = await request.json() as { name?: string; channelInput?: string }
  if (!name?.trim() || !channelInput?.trim()) {
    return NextResponse.json({ error: 'アーティスト名とチャンネルIDは必須です' }, { status: 400 })
  }

  let channelInfo: Awaited<ReturnType<typeof resolveChannel>>
  try {
    channelInfo = await resolveChannel(channelInput.trim())
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 })
  }

  const sb = createAdminClient()

  // 重複チェック
  const { data: existing } = await sb
    .from('artists')
    .select('id, name')
    .eq('youtube_channel_id', channelInfo.channelId)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: `このチャンネルはすでに登録済みです（${existing.name}）` },
      { status: 409 },
    )
  }

  const jstNow = Date.now() + 9 * 60 * 60 * 1000
  const today = new Date(jstNow).toISOString().split('T')[0]

  const { data: artist, error: insertErr } = await sb
    .from('artists')
    .insert({
      name:               name.trim(),
      youtube_channel_id: channelInfo.channelId,
      current_index:      0,
      initial_index:      0,
      status:             'collecting',
      published_at:       null,
    })
    .select('id')
    .single()

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  const { error: snapErr } = await sb
    .from('view_snapshots')
    .insert({
      artist_id:      artist.id,
      total_views:    channelInfo.totalViews,
      daily_increase: 0,
      index_value:    null,
      snapshot_date:  today,
    })

  if (snapErr) {
    return NextResponse.json({ error: snapErr.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    artist: { id: artist.id, name: name.trim(), channelTitle: channelInfo.channelTitle },
  })
}
