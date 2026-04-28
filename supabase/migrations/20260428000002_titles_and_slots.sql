-- 称号テーブル
CREATE TABLE titles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points_spent INT  NOT NULL CHECK (points_spent >= 1),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE titles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "titles: own read"   ON titles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "titles: own insert" ON titles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "titles: own delete" ON titles FOR DELETE USING (auth.uid() = user_id);

-- 枠テーブル
CREATE TABLE user_slots (
  user_id      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  point_slots  INT NOT NULL DEFAULT 0,
  paid_slots   INT NOT NULL DEFAULT 0
);

ALTER TABLE user_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_slots: own read"   ON user_slots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_slots: own insert" ON user_slots FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_slots: own update" ON user_slots FOR UPDATE USING (auth.uid() = user_id);

-- 既存ユーザーに初期行を作成
INSERT INTO user_slots (user_id, point_slots, paid_slots)
SELECT id, 0, 0 FROM auth.users
ON CONFLICT DO NOTHING;
