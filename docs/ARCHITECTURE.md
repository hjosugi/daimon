# Architecture

Daimon の現行実装は、Go API を中心にしたSNS/検索アプリです。Python は本体APIではなく、embedding と POV抽出だけを担当する ML microservice として分離されています。

この文書は、いま実際に動いている構成を正本として説明します。古い `backend/` のFastAPI実装は参照実装・seed・migration周辺として残っていますが、現在の推奨実行経路ではありません。

## 全体像

```text
React / Vite frontend
        |
        | REST
        v
Go API
        | SQL                         | HTTP
        v                             v
PostgreSQL                    Python ML service
System of Record              embedding / POV extraction
        |
        | IDs, relations, metadata
        v
Qdrant
System of Search

Redis
optional read-model cache
```

ローカルの `compose.yml` では次のポートで起動します。

| Component | Port | Role |
| --- | --- | --- |
| frontend | `5173` | React UI |
| api | `8000` | Go HTTP API |
| ml | `8001` | Python ML service |
| PostgreSQL | `5432` | 正本DB |
| Qdrant | `6333` | vector index |
| Redis | `6379` | optional cache |

## ディレクトリの責務

| Path | 責務 |
| --- | --- |
| `frontend/` | React + Vite + TypeScript。タイムライン、検索、投稿、POVページ、プロフィール。 |
| `api/` | Go API。認証、投稿、検索、ランキング、フォロー、保存、POVコメント。 |
| `ml-service/` | Python ML service。`/embed` と `/povs` のみ。 |
| `backend/` | 旧FastAPI実装、Alembic、seed、検証用コード。現行APIの本体ではない。 |
| `docs/` | 共有ドキュメント。 |

## 設計原則

### PostgreSQL は正本

消えてはいけないデータは PostgreSQL に置きます。

- users
- sessions
- posts
- povs
- likes
- comments
- pov_likes
- pov_comments
- follows
- bookmarks

Qdrant や Redis は再生成できる派生データです。Qdrant への書き込みが失敗しても、投稿そのものは PostgreSQL に残ります。

### Qdrant は検索インデックス

Qdrant の `posts` collection は 384次元 cosine vector を保存します。payload は検索補助用です。

```text
collection: posts
vector size: 384
distance: Cosine
payload:
  post_id
  user_id
  tags
  created_at
```

Qdrant は候補生成に使います。最終表示に必要な本文、ユーザー名、POV、like/comment/save数は PostgreSQL から bulk load します。

### ML service は薄く保つ

`ml-service/app.py` は次の3エンドポイントだけを持ちます。

| Endpoint | Input | Output |
| --- | --- | --- |
| `GET /health` | none | health |
| `POST /embed` | `{"text": "..."}` | `{"vector": [...]}` |
| `POST /povs` | `{"text": "..."}` | `{"povs": [...]}` |

embedding model は `paraphrase-multilingual-MiniLM-L12-v2` です。日本語を扱える 384次元モデルなので、Qdrant の vector size は変えずに済みます。

長文は先頭だけを見るのではなく、約1200文字単位に分割して embedding し、平均ベクトルにします。これで長い投稿の複数論点が1つの投稿vectorにある程度反映されます。

### Redis は任意のread-model cache

Redis は未設定でも動作します。設定されている場合は、次のような派生データを置きます。

- `feed:{userId}`: ユーザー別に事前計算したホームフィードID列
- `suggest:popular`: よく使われるPOV
- `suggest:related:{pov}`: 意味的に近いPOV候補

Redisが落ちても正本は失われません。APIはライブ計算に戻すか、空に近いレスポンスへ安全に劣化します。

## 現在のデータモデル

### users

アカウント、表示名、メール、password hash、avatar、bioを保持します。簡単なプロフィール登録はここで完結します。

### sessions

ログインセッションです。現在はcookie/sessionベースの素朴な認証です。

### posts

投稿本文と投稿者を保持します。投稿本文は意味ベクトル化され、Qdrantにも同じIDで登録されます。

### povs

投稿に付く POV です。現在は `post_id + pov` の組で重複を防いでいます。

現状の限界は、POVがまだタグに近いことです。将来的には `post_pov_assertions` に移し、次の情報を持たせます。

```text
post_id
pov_id or pov_text
grade: A/B/C or lean
comment
spoiler
confidence
created_by
created_at
```

### pov_comments

投稿ではなくPOVそのものに対するコメントです。

普通のコメントは「この投稿について話す」ためのものです。POVコメントは「この観点で見るとどうかを話す」ためのものです。この違いがDaimonの中核です。

### pov_likes

「このPOVに立つ」「この観点を追う」に近い軽い反応です。現状は like として実装されていますが、将来的にはPOV followやstanceに寄せていきます。

### follows

人へのfollowです。Daimonでは人followを完全には消しません。ただし、ネットワークの背骨は人ではなくPOVに寄せます。人はコンテンツと信頼の手がかり、POVは探索の地図です。

### bookmarks

投稿の保存・クリップです。保存はlikeより強い嗜好シグナルとして扱い、タイムラインの user sense centroid に強めに混ぜます。

## SQLの管理

SQLはGoコード内に直書きせず、`api/internal/db/queries/server.sql` に名前付きで外出ししています。

```sql
-- name: feed.load_posts
SELECT id, user_id, COALESCE(username,''), text, created_at
FROM posts
WHERE id = ANY($1)
```

Go側は `db.SQL("feed.load_posts")` のように参照します。実装は標準の `embed` と軽いパーサです。

今の規模ではこの方式で十分です。クエリ数が増え、型安全性やコード生成のメリットが上回った段階で `sqlc` の導入を検討します。

## 主なリクエストフロー

### 投稿作成

1. frontend が `POST /posts` を呼ぶ。
2. Go API が本文と POV をvalidateする。
3. Go API が ML service `POST /embed` に本文を渡す。
4. PostgreSQL に `posts` と `povs` を保存する。
5. embeddingが取れていれば、Qdrant `posts` collection に upsert する。
6. Qdrant が失敗しても投稿保存は成功扱いにできる。検索インデックスは後で再構築できるため。

### POV生成

1. frontend が本文を `POST /posts/generate-povs` に送る。
2. Go API が ML service `POST /povs` を呼ぶ。
3. ML service は spaCy の noun chunks と日本語名詞列、fallback regex で短い候補を返す。
4. frontend は候補として表示し、ユーザーが採用する。

POVは自動抽出だけで決めません。最終的に人間が選ぶことが、Daimonのランキングにとって重要です。

### タイムライン

1. frontend が `POST /posts/timeline` を呼ぶ。
2. Go API が query text か user centroid を検索vectorにする。
3. Qdrantから候補を100-200件取る。
4. PostgreSQLから本文、POV、like/comment/save数をbulk loadする。
5. ユーザー自身の投稿vectorと保存投稿vectorから sense centroid を作る。
6. `RankBySenseDistance` で並べ替える。
7. MMRで似すぎた候補を間引く。

現在のランキングは次の思想です。

```text
near   = similarity(user_centroid, post_vector)
far    = 1 - near
common = shares_pov(user, post)
bridge = far * common

score =
  alpha * near
  + (1 - alpha) * bridge
  + common_pov_bonus
  + optional popularity / recency
```

保存はlikeより強いシグナルとして扱います。`bookmark` は「あとで読みたい」だけでなく、「この投稿は自分の感性モデルに残す価値がある」というML改善の材料です。

### 検索

検索は2系統を混ぜます。

- text query: ML serviceでquery embeddingを作り、Qdrantで意味検索する。
- POV query: PostgreSQLの `povs` を直接引き、存在するPOVを拾う。

これにより、意味的に近い文章だけでなく、既に存在するPOVを直接suggestできます。

### POVページ

POVページは、単なるタグ一覧ではなく「その観点で議論する部屋」です。

現状:

- 関連投稿を検索する。
- POVコメントを一覧する。
- POVに対する軽い反応を保存する。

次に強化するもの:

- 最近のPOVコメント
- 人気のPOVコメント
- そのPOVに強いユーザー
- 似たPOV、隣接POV、反対/緊張関係にあるPOV
- 同じ観点で違う感じ方をしている人/投稿

## Batch jobs

`api/cmd/batch` は重い読み取りモデルを事前計算します。

### deepAnalyzeJob

長文投稿を分割し、各チャンクから追加POVを抽出します。深い投稿は複数の観点を含むため、投稿1件を複数のPOVノードへ分解するための処理です。

### suggestJob

人気POVと、意味的に近いPOVをRedisにcacheします。

```text
suggest:popular
suggest:related:{pov}
```

### timelineJob

ユーザーごとにホームフィード候補を事前計算し、Redisに `feed:{userId}` として保存します。

## 今後のアーキテクチャ拡張

### post_pov_assertions

現在の `povs` はタグです。次は、投稿とPOVの関係を主張として保存します。

```text
post_pov_assertions
  id
  post_id
  pov_id
  lean or grade
  comment
  spoiler
  confidence
  created_by
  created_at
```

これにより、「この投稿にはこのPOVがある」ではなく、「この投稿をこのPOVで見るとこう感じる」を保存できます。

### pov_definitions

POV自体にも説明を持たせます。

```text
pov_definitions
  id
  title
  category
  description
  examples
  synonyms
  parent_pov
  merged_into
```

open vocabulary は維持します。ただし、よく使われるPOVには説明と同義語を与え、検索・統合・安全性を改善します。

### graph read model

グラフ探索は、PostgreSQLの正本テーブルから直接巨大グラフを毎回作るのではなく、POV中心の小さなread modelとして作ります。

最初のノード:

- POV
- Post
- User

最初のエッジ:

- post has POV
- user asserted POV
- user commented on POV
- user saved post
- POV similar to POV
- same-axis disagreement

MVPでは全体グラフを出しません。1つのPOVを中心に1-2 hopだけを返すAPIにします。

## 性能方針

### frontend

- タイムラインはページ全体を再描画しない。
- PostCardは小さなcomponentに分割し、memo化しやすくする。
- POV suggestion はdebounceする。
- グラフ探索は初期表示を軽くし、ノード上限を決める。
- 100ノードを超える可視化はDOMだけで抱えず、canvas/WebGLか仮想化を検討する。

### API

- N+1 queryを避け、ID列からbulk loadする。
- Qdrantは候補生成、PostgreSQLは正本と最終表示の材料に分ける。
- Redisは高速化のために使い、正しさのためには使わない。
- ML service失敗時は空候補やfallbackに劣化し、投稿/閲覧の基本動線を止めない。

### ML/vector

- model変更時は、既存投稿を全件re-embedする。
- Qdrantのvector dimensionを変える変更はmigration扱いにする。
- 検索品質はsemantic similarityだけで判断しない。POV一致、保存、recency、同軸異見を合わせて見る。

## まだやらないこと

- 全ユーザーを点数化するランキング。
- グローバルな中心性スコアの露出。
- 巨大な3Dグラフ可視化。
- 統計ダッシュボード化したPOVページ。
- MLがPOVを完全に決定する設計。
