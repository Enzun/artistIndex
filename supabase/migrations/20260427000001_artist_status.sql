-- artists に status と published_at を追加
ALTER TABLE artists
  ADD COLUMN IF NOT EXISTS status       TEXT        NOT NULL DEFAULT 'active'
                                                    CHECK (status IN ('collecting', 'active')),
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- 既存アーティストは active のまま（published_at は created_at で埋める）
UPDATE artists SET published_at = created_at WHERE status = 'active' AND published_at IS NULL;

-- collecting アーティストは current_index / initial_index が未確定なので 0 を許容
-- （スキーマは NOT NULL のまま、collecting 時は 0 をセット）
