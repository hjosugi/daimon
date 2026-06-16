# Content Moderation

Daimon のモデレーションは、一般的なSNSコメント欄より少し難しいです。理由は、Daimonが投稿だけでなく「観点(POV)」を会話の単位にするからです。

普通のコメント欄では、荒れる対象は投稿です。Daimonでは、荒れる対象がPOVそのもの、POVに立つ人、同じPOVで違う感じ方をしている人に広がります。

この文書は、Daimon向けの安全設計を整理します。

## 守るもの

守る対象は4つあります。

1. 投稿者
2. POVに反応した人
3. POVコメントを書いた人
4. POV空間そのもの

特に重要なのは、Daimonの核である「同軸異見」が、攻撃や晒しに変わらないことです。

## 基本方針

### 1. 衝突ではなく理由を出す

同軸異見カードは、対立相手を晒すUIではありません。

悪い表示:

```text
あなたに反対している人
```

良い表示:

```text
同じ観点で、少し違う感じ方
```

ユーザー名より先に、理由を短く出す方が安全です。人格ではなく観点に注意を向けます。

### 2. 数字で煽らない

Daimonでは次の数字を強く見せない方がよいです。

- 反対数
- 勝敗
- 炎上度
- ユーザーの影響力スコア
- グラフ中心性

数字は内部rankや安全判断に使ってよいですが、UIに出すと競争や攻撃を誘発します。

### 3. ネタバレ制御を一級にする

POVコメントは作品・投稿の深い話に入りやすいため、spoiler制御が必要です。

必要な状態:

- 投稿単位のspoiler
- POV assertion単位のspoiler
- POVコメント単位のspoiler
- 一覧ではspoiler本文を隠す
- ユーザー設定でspoiler表示方針を選べる

### 4. open vocabularyを守りつつ整える

POVはopen vocabularyです。自由に作れるから面白い一方で、荒らし、差別語、個人攻撃、重複、曖昧語が混ざります。

対策:

- 新規POV作成時のvalidation
- 既存POVのsuggest
- 同義語統合
- merged_into
- 管理者/信頼ユーザーによる説明編集
- 通報されたPOVの一時非表示

## 現在の実装でできること

現在のGo APIには、次の安全上の土台があります。

- session認証
- 自分の投稿削除
- 自分のPOVコメント削除
- follow / unfollow
- follower削除
- profile bio
- bookmark
- 入力validation
- SQL外出し + parameterized query

まだ不足しているもの:

- 通報
- block / mute
- 管理者画面
- spoiler flag
- POV定義の統合/凍結
- rate limit
- 同軸異見カードの安全フィルター

## 次に入れるべき安全機能

### Phase 1: report

最初に必要なのは通報です。

対象:

- post
- comment
- pov_comment
- pov
- user

最低限のスキーマ:

```text
reports
  id
  target_type
  target_id
  reporter_id
  reason
  detail
  created_at
  status
```

`target_type` は文字列でもよいですが、API側で許可値を固定します。

### Phase 2: block / mute

同軸異見は「聞く価値がある違い」を出す機能です。見たくない相手を消せないと成立しません。

必要:

- block user
- mute user
- mute POV
- muted/blocked userをranking候補から除外
- 同軸異見カード候補から除外

### Phase 3: spoiler

`post_pov_assertions` と同時に入れるのが自然です。

```text
spoiler boolean
spoiler_scope optional
```

一覧では本文を伏せ、明示操作で開くようにします。

### Phase 4: rate limit

POVコメントや同軸異見への反応は、短時間に連投されると荒れます。

必要:

- login / signup rate limit
- post create rate limit
- comment create rate limit
- pov_comment create rate limit
- report spam detection

Redisがあればtoken bucketを置けます。なければDBベースの簡易制限から始めます。

### Phase 5: quality and safety rank

同軸異見カードに出す候補は、単に「違う意見」なら何でもよいわけではありません。

候補に入れる条件:

- 短い理由がある。
- recentである。
- 通報が少ない。
- ブロック関係がない。
- 侮辱や攻撃表現がない。
- 同じPOVに立っている。

候補から落とす条件:

- 攻撃的表現。
- 個人攻撃。
- 執拗な連投。
- spoiler違反。
- 通報が一定以上。
- ブロック/ミュート関係。

## ML/APIを使う場合の位置づけ

外部APIやMLモデルは補助です。最初から自動判定で投稿を消すより、段階的に使う方が安全です。

使い方:

- 明らかなspam/攻撃をsoft flagする。
- review queueの優先順位を上げる。
- 同軸異見カードの候補から外す。
- ユーザーに投稿前の警告を出す。

避けること:

- 文脈なしにPOVを禁止する。
- 異論そのものを攻撃とみなす。
- 説明なしに投稿を消す。
- MLの判定をUI上で断定的に見せる。

## UI文言

安全な文言:

- `この観点では、少し違う感じ方もあります`
- `理由を読む`
- `このPOVをミュート`
- `この内容を報告`
- `ネタバレを表示`

避ける文言:

- `反対派`
- `敵対`
- `論破`
- `炎上`
- `勝っている意見`
- `負けている意見`

## 運用メモ

初期MVPでは、複雑な自動モデレーションよりも次を優先します。

1. 通報できる。
2. 自分で消せる。
3. 見たくない相手やPOVを隠せる。
4. spoilerを隠せる。
5. 同軸異見カードに危険候補を出さない。

Daimonの価値は、違う感じ方を安全に聞けることです。安全機能は後付けの管理機能ではなく、プロダクトの中核です。
