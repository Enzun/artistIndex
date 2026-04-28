-- 初期配布ポイントを 1,000 → 5,000 に変更
ALTER TABLE users
  ALTER COLUMN free_points SET DEFAULT 5000;

-- 既存ユーザーへの追加付与（+4,000pt）
-- ※ 新規登録済みユーザー全員に適用
UPDATE users
  SET free_points = free_points + 4000;
