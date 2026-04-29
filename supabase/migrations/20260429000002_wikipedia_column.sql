-- artists テーブルに Wikipedia 記事タイトルを追加
ALTER TABLE artists ADD COLUMN IF NOT EXISTS wikipedia_ja TEXT;

-- view_snapshots テーブルに Wikipedia 閲覧数を追加
ALTER TABLE view_snapshots ADD COLUMN IF NOT EXISTS wikipedia_pageviews BIGINT;

NOTIFY pgrst, 'reload schema';
