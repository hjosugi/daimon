# Roadmap

Daimon の優先順位は、「深い理論をそのまま見せる」ことではなく、「軽い操作で深い接続が起きる」ことです。

このロードマップでは、いま必要なもの、次に必要なもの、まだ作らない方がよいものを分けます。

## 現在の到達点

できていること:

- 投稿作成
- POV付与
- POV自動suggest
- POV検索
- POVページ
- POVコメント
- follow / unfollow
- follower削除
- 簡単なプロフィール
- 投稿保存
- Go APIによる現行API
- PostgreSQL正本DB
- Qdrant vector search
- ML serviceによる日本語embedding
- Sense-Distanceランキング
- Redisによる任意のread-model cache
- SQL外出し

まだ弱いこと:

- POVがまだタグに近い。
- 投稿に対する「このPOVで見るとどうか」が保存されていない。
- POV自体に説明、同義語、親子関係がない。
- POVページがまだ「部屋」として弱い。
- タイムラインにPOV活動が十分混ざっていない。
- グラフ探索がない。
- 同軸異見が明示的な体験になっていない。

## Phase 1: POVページをDaimonの中心にする

目的:

POVページをタグ検索結果ではなく、観点ごとの部屋にする。

やること:

- POVの説明欄を出す。
- 関連投稿を強く出す。
- 最近のPOVコメントを出す。
- 人気/質の高いPOVコメントを出す。
- そのPOVでよく発言するユーザーを出す。
- 同軸異見カードを1枚出す。

まだやらない:

- 大量の統計。
- A/B/C分布の常時表示。
- グローバルランキング。

## Phase 2: post_pov_assertions

目的:

`povs: string[]` から、「投稿をこの観点で見た主張」へ移る。

最小スキーマ案:

```text
post_pov_assertions
  id
  post_id
  pov_text or pov_id
  lean
  comment
  spoiler
  confidence
  created_by
  created_at
```

最初の `lean` は複雑にしません。

```text
なるほど
気になる
ちがうかも
```

内部的には `support / question / oppose` のように持ってよいですが、UIに複数体系を出さないようにします。

## Phase 3: 同軸異見カード

目的:

Daimonらしさを1枚のカードで伝える。

候補条件:

- 同じPOVに反応している。
- leanが違う。
- 短い理由がある。
- 最近の活動がある。
- ブロック/ミュート/通報リスクがない。
- 相手の投稿またはPOVコメントが読める。

カードのトーン:

```text
同じ観点で、少し違う感じ方
```

避ける文言:

- `反対派`
- `論破`
- `あなたと対立`
- `炎上中`

目的は議論の勝利ではなく、理由を聞く入口を作ることです。

## Phase 4: POV definitions

目的:

open vocabulary を保ったまま、よく使われるPOVを理解可能にする。

スキーマ案:

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
  created_by
  updated_at
```

必要な機能:

- 既存POVのsuggest
- 同義語統合
- merged POV からcanonical POVへの転送
- 似たPOV/隣接POVの表示
- POV説明の編集履歴

## Phase 5: グラフ探索ビュー

目的:

POVを地図として探索できるようにする。

最初の範囲:

- POVページ内の `探索` タブ。
- 現在POV中心のlocal graph。
- 1-2 hopまで。
- 初期30ノード、最大80ノード程度。
- `POV / Post / User` の3ノードから始める。

後で増やす:

- Assertion node
- Comment node
- similar/adjacent/opposite edges
- same-axis disagreement edge
- 保存から広がる個人用graph

まだやらない:

- 全体ネットワーク図。
- 3Dグラフ。
- 中心性ランキング。
- 複雑な統計dashboard。

## Phase 6: POV activity timeline

目的:

タイムラインを新着投稿だけにしない。

混ぜる活動:

- 最近このPOVで議論が起きている。
- あなたと近い人がこのPOVに反応した。
- あなたと遠い人が同じPOVで別意見を出した。
- 保存した投稿から近いPOVが動いている。
- followしている人ではなく、followしている観点が動いている。

表示は数字よりも文脈を優先します。

```text
「余韻」という観点で、最近ちがう感じ方が増えています。
```

## Phase 7: Ranking refinement

今のrank:

```text
semantic similarity
+ shared POV
+ bridge score
+ popularity / recency
+ save signal
```

次のrank:

```text
semantic_similarity
+ shared_pov_weight
+ pov_activity_recency
+ pov_comment_quality
+ user_affinity_by_pov
+ disagreement_but_same_axis_bonus
+ save_quality_signal
+ safety_penalty
```

重要なのは、近いものだけを上げないことです。Daimonは、遠いが共通の観点を持つ投稿を出すためのアプリです。

## Phase 8: Moderation and trust

POV空間は深い議論を扱うため、普通のコメント欄より安全設計が重要です。

必要:

- 通報
- ブロック/ミュート
- spoiler制御
- POVコメントの削除
- 荒れやすいPOVのrate limit
- 同軸異見カードから危険な相手を除外
- public rankingではなくquality signalの内部利用

## 作らない方がよいもの

現時点では次を避けます。

- 細かい統計ページ。
- ユーザーの総合スコア。
- POVの勝ち負け表示。
- フォロワー数を煽るUI。
- 反論通知。
- 連続ログイン報酬。
- 巨大グラフを初回画面に出すこと。
- MLが勝手に人の感性を断定すること。

## MVP完成形

MVPとして強い状態は次です。

1. 投稿する。
2. POVを付ける。
3. そのPOVで `なるほど / 気になる / ちがうかも` を置ける。
4. 一言理由を任意で書ける。
5. POVページで関連投稿とPOVコメントを読める。
6. 同じPOVで違う感じ方をしている人に1枚のカードで出会える。
7. 保存が自分のsenseに反映される。
8. グラフ探索で観点から観点へ軽く進める。

これができれば、Daimonは単なる投稿SNSではなくなります。
