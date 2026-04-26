# アーティスト指数アプリ 仕様書（プロトタイプ版）

> 最終更新：2026-04-26
> ステータス：Phase 1 実装中

---

## 1. サービス概要

YouTubeのチャンネル総再生数をもとに算出した「アーティスト指数」に対して、ユーザーがポイントを投入・回収できるWebアプリ。ユーザー間の売買は行わず、指数の変動のみでポイントが増減する。

---

## 2. 指数変動ロジック

### データソースと取得

- **データソース**：YouTube Data API v3（`channels.list?part=statistics` の `viewCount`）
- **注意**：`viewCount` には YouTube Shorts の再生数も含まれる（既知の挙動。動的ベースラインにより一定程度緩和される）
- **取得タイミング**：毎日 0:05 JST（GitHub Actions で定時実行）
- **日次増加数**：`today.total_views − yesterday.total_views`（負になった場合は 0 として扱う）

### 指数の計算式（確定）

```
index[t+1] = index[t] × (d / B)^(3 / 365)

  d : 当日の再生増加数（24hローリング窓相当、日次更新）
  B : 動的ベースライン = 過去180日間の日次増加数の平均
  3 : 感度係数 k
```

- `d > B` → 指数 UP（自分の平均より多く再生された）
- `d < B` → 指数 DOWN（自分の平均より少ない）
- `d = B` → 変化なし
- 指数の下限なし（活動停止すれば自然に 0 に近づく）

### 動的ベースラインの詳細

- 参照期間：過去 180 日（= 6ヶ月）の日次増加数の単純平均
- 当日分は含めない（当日の計算に当日のデータは使わない）
- データが 180 日未満の場合：手持ちのデータのみで平均を算出

### アーティストの追加条件

- **YouTube チャンネルの開設から 6ヶ月以上**経過していること
- 活動中であること（目安：直近 6ヶ月で一定の再生数があること）
- 追加時に過去データが不足している場合は追加しない

---

## 3. 初期指数

### 計算式

```
initial_index = round(sqrt(total_views_M) × 10, 2)
  total_views_M : 追加日時点の総再生数（単位：百万回）
```

**例（2025年時点の推定値）：**

| アーティスト | 総再生数 | 初期指数 |
|---|---|---|
| Mrs. GREEN APPLE | 約3,200M | √3200 × 10 ≈ **565** |
| サンボマスター | 約305M | √305 × 10 ≈ **175** |

### 基準日

追加日（artists テーブルへの INSERT 日）。初期2アーティストはサービス開始日で統一。

### 過去データについて

- YouTube API は過去の再生数履歴を提供しない
- 追加日以前の指数グラフは表示しない（追加日からの積み上げ）
- 必要に応じて Social Blade 等から取得した過去データを CSV でインポート可能（バックフィルスクリプトで対応）

---

## 4. ポイントシステム

### ポイントの種類

| 種類 | 入手方法 | 使い道 |
|---|---|---|
| 無償ポイント | サインアップ時に 1,000pt 付与（詳細 TBD） | 指数への投入のみ |
| 有償ポイント | 課金で購入 | スキン・称号の購入のみ |

- **有償ポイントは指数投入に使えない**（法的安全性のため）
- **ポイントの現金への換金は不可**

### 指数への投入・回収

- 投入時の指数を記録し、回収時の指数との比率でポイントが増減する

```
回収ポイント = 投入ポイント × (回収時の指数 / 投入時の指数)
```

**例：**
```
指数 200 のときに 100pt 投入
→ 指数 240 で回収 → 120pt（+20%）
→ 指数 160 で回収 →  80pt（−20%）
```

---

## 5. 対象アーティスト（プロトタイプ）

| アーティスト | YouTube チャンネル ID | 初期指数（予定） |
|---|---|---|
| Mrs. GREEN APPLE | TBD | ≈ 565 |
| サンボマスター | TBD | ≈ 175 |

---

## 6. 技術スタック

| 役割 | 技術・サービス | 備考 |
|---|---|---|
| フロントエンド | Next.js / Vercel | `xxx.vercel.app` で公開 |
| バックエンド API | Vercel Functions | フロントと同一リポジトリ |
| データベース | Supabase（PostgreSQL） | 無料枠で運用 |
| 定時処理 | GitHub Actions（毎日 0:05 JST） | パブリックリポジトリなら無料 |
| 外部 API | YouTube Data API v3 | 1日 10,000 ユニット無料枠 |

---

## 7. データ設計

### テーブル一覧

**artists**
| カラム | 型 | 説明 |
|---|---|---|
| id | UUID | PK |
| name | text | アーティスト名 |
| youtube_channel_id | text | UNIQUE |
| current_index | numeric | 最新の指数 |
| initial_index | numeric | 追加日時点の初期指数 |
| created_at | timestamptz | 追加日（= 基準日） |

**view_snapshots**
| カラム | 型 | 説明 |
|---|---|---|
| id | UUID | PK |
| artist_id | UUID | FK → artists |
| total_views | bigint | 取得時の総再生数 |
| daily_increase | bigint | 前日比（負の場合は 0） |
| index_value | numeric | その日の指数（計算後に更新） |
| snapshot_date | date | UNIQUE(artist_id, snapshot_date) |

**users**
| カラム | 型 | 説明 |
|---|---|---|
| id | UUID | FK → auth.users |
| username | text | UNIQUE |
| free_points | integer | 無償ポイント残高（≥ 0） |
| paid_points | integer | 有償ポイント残高（≥ 0） |
| created_at | timestamptz | |

**investments**
| カラム | 型 | 説明 |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | FK → users |
| artist_id | UUID | FK → artists |
| points_invested | integer | 投入ポイント（> 0） |
| index_at_entry | numeric | 投入時の指数 |
| status | text | 'active' / 'withdrawn' |
| created_at | timestamptz | 投入日時 |
| withdrawn_at | timestamptz | 回収日時 |

---

## 8. 指数計算式の変更について

`view_snapshots` に生データ（`daily_increase`）を永続保存しているため、式の変更時は以下で対応可能：

1. 新しい式でバッチ再計算（全 `snapshot_date` を順に処理）
2. `artists.current_index` を一括更新
3. `investments.index_at_entry` を同比率で補正（ユーザーの損益比率を維持）

---

## 9. 開発フェーズ

### Phase 1（現在）: データパイプライン
- [x] 指数計算式の確定
- [x] DB スキーマ設計
- [ ] Supabase セットアップ
- [ ] YouTube API fetch スクリプト
- [ ] 指数計算スクリプト
- [ ] GitHub Actions 定時実行

### Phase 2: ゲームロジック
- Supabase Auth（メール + Magic Link）
- ポイント投入・回収 API
- ポートフォリオ確認

### Phase 3: フロントエンド MVP
- Next.js App Router
- アーティスト一覧・指数チャート
- 投入・回収 UI
- 友達テスト開始

### Phase 4: ソーシャル
- ポートフォリオ共有 URL
- 友達ランキング
