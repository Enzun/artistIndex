export type Artist = {
  id: string
  name: string
  youtube_channel_id: string
  current_index: number
  initial_index: number
  created_at: string
  thumbnail_url: string | null
  description: string | null
}

export type ViewSnapshot = {
  id: string
  artist_id: string
  total_views: number
  daily_increase: number
  index_value: number | null
  snapshot_date: string
  wikipedia_pageviews?: number | null
}

export type Investment = {
  id: string
  user_id: string
  artist_id: string
  points_invested: number
  index_at_entry: number
  status: 'active' | 'withdrawn'
  created_at: string
  withdrawn_at: string | null
  artist?: Artist
}

export type UserProfile = {
  id: string
  username: string | null
  free_points: number
  paid_points: number
}
