-- ============================================================
-- アーティスト指数アプリ 初期スキーマ
-- ============================================================

-- ----------------------------------------------------------
-- artists
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS artists (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name               TEXT        NOT NULL,
  youtube_channel_id TEXT        NOT NULL UNIQUE,
  current_index      NUMERIC     NOT NULL,
  initial_index      NUMERIC     NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------
-- view_snapshots  （生データ。絶対に削除しない）
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS view_snapshots (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id      UUID        NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  total_views    BIGINT      NOT NULL,
  daily_increase BIGINT      NOT NULL DEFAULT 0,  -- 負になった場合は 0
  index_value    NUMERIC,                          -- 指数計算後に更新
  snapshot_date  DATE        NOT NULL,
  UNIQUE (artist_id, snapshot_date)
);

CREATE INDEX idx_snapshots_artist_date
  ON view_snapshots(artist_id, snapshot_date DESC);

-- ----------------------------------------------------------
-- users  （Supabase Auth の auth.users を拡張）
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    TEXT        UNIQUE,
  free_points INTEGER     NOT NULL DEFAULT 1000 CHECK (free_points  >= 0),
  paid_points INTEGER     NOT NULL DEFAULT 0    CHECK (paid_points >= 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- サインアップ時に自動で users 行を作成するトリガー
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------------
-- investments
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS investments (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  artist_id       UUID        NOT NULL REFERENCES artists(id),
  points_invested INTEGER     NOT NULL CHECK (points_invested > 0),
  index_at_entry  NUMERIC     NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'withdrawn')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  withdrawn_at    TIMESTAMPTZ
);

CREATE INDEX idx_investments_user   ON investments(user_id,   status);
CREATE INDEX idx_investments_artist ON investments(artist_id, status);

-- ----------------------------------------------------------
-- RLS（Row Level Security）
-- ----------------------------------------------------------
ALTER TABLE artists        ENABLE ROW LEVEL SECURITY;
ALTER TABLE view_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE investments    ENABLE ROW LEVEL SECURITY;

-- artists・view_snapshots: 誰でも読める、書き込みは service_role のみ
CREATE POLICY "artists_read_all"
  ON artists        FOR SELECT USING (true);
CREATE POLICY "snapshots_read_all"
  ON view_snapshots FOR SELECT USING (true);

-- users: 自分のレコードのみ参照・更新
CREATE POLICY "users_select_own"
  ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_update_own"
  ON users FOR UPDATE USING (auth.uid() = id);

-- investments: 自分のレコードのみ操作
CREATE POLICY "investments_own"
  ON investments USING (auth.uid() = user_id);
