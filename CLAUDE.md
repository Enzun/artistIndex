# Artist Index - プロジェクト指示

## デプロイ
- **デプロイ = `git push`**（Vercel が自動でビルド・デプロイする）
- デプロイを求められたら `git push` を実行する
- **コード変更後は必ず `git push` まで行う**（commit だけでは本番に反映されない）
- **push 前に必ず `npx tsc --noEmit` で型チェックを行い、エラーがないことを確認する**

## ローカル専用ファイル
以下はローカルでのみ使用し、gitにコミットしない：
- `src/app/admin/simulation/` - 指数シミュレーションツール（`.gitignore`済み）
- `data/` - アーティストJSONなどのローカルデータ（`.gitignore`済み）
- `scripts/` - ローカル実行スクリプト群

シミュレーションやテストツールは `tools/` に作成する（`.gitignore`済み）。Next.jsアプリの外に置く。

## テスト・シミュレーション
- シミュレーションはローカル環境で実行
- テストデータもローカル専用
- 本番DBに影響するスクリプトは実行前に確認を求める

## 技術スタック
- Next.js 15 App Router
- Supabase（SSR auth + service role）
- Vercel Hobby（cron 2本まで、60s timeout）
- UTC 15:01 = JST 00:01 でfetch、UTC 15:03 = JST 00:03 でcalc

## データソース
- YouTube Data API v3（`channels.list` statistics、50件バッチ）
- Spotify Web API（`/v1/artists`、50件バッチ、Client Credentials）
- スナップショットは `view_snapshots` テーブルに1アーティスト1日1行
