-- Spotify artist ID on artists table
ALTER TABLE artists
  ADD COLUMN IF NOT EXISTS spotify_artist_id TEXT;

-- Spotify daily snapshot columns on view_snapshots
ALTER TABLE view_snapshots
  ADD COLUMN IF NOT EXISTS spotify_popularity  INT,
  ADD COLUMN IF NOT EXISTS spotify_followers   BIGINT;

NOTIFY pgrst, 'reload schema';
