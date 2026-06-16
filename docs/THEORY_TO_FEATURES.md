# Theory To Features

この文書は、Daimon の機能を理論から逆算してまとめるためのものです。

論文や理論は、プロダクト画面にそのまま出しません。理論は地下に置き、ユーザーが触る表面は軽くします。

```text
理論
  ↓
人間についての仮説
  ↓
Daimonの機能
  ↓
UIに出す形
  ↓
UIに出さないもの
```

## 1. Tesler's Law

### 理論

システムには消せない複雑さがある。設計で決めるべきなのは、その複雑さをユーザーに背負わせるか、システム側に沈めるかです。

### Daimonでの解釈

Daimon は、POV、vector、ranking、bridging、graph、moderation という複雑な基盤を持ちます。しかし、その複雑さをユーザーに見せすぎると使えません。

### 機能

- 3択のPOV反応
- 同軸異見カード
- match reason
- hidden ranking
- hidden graph read model
- hidden safety filtering

### UIに出す

```text
この観点で見ると？

なるほど
気になる
ちがうかも
```

### UIに出さない

- 複雑なscore式
- vector distance
- matrix factorization
- A/B/Cとstanceの二重体系
- グローバル統計dashboard

## 2. Perspective-getting

### 理論

他人の視点は、想像するより本人に聞く方が正確です。Daimonでは、相手の心を推測させず、相手の短い理由を読ませます。

### Daimonでの解釈

SNSの衝突は、相手を推測で雑に理解した気になることで強まります。Daimonは「この観点では、なぜそう感じたのか」を聞くUIにします。

### 機能

- POVコメント
- POV反応の一言理由
- 同軸異見カード
- `理由を読む`
- `この観点を開く`

### UIに出す

```text
同じ観点で、少し違う感じ方

理由: 中盤の間が、むしろ余韻として効いていた。
```

### UIに出さない

- `反対派`
- `論破`
- `あなたと対立`
- 人格へのラベル

## 3. Opinion Space

### 理論

意見は一次元の賛成/反対ではなく、多次元空間として扱える。Pol.is のようなシステムは、多数の反応から意見空間を作り、近い/遠い/分かれる点を見えるようにします。

### Daimonでの解釈

Daimonの `sense` は、投稿本文のembeddingだけではありません。ユーザーがどのPOVを選び、そのPOVでどう反応したかも意見空間の座標になります。

### 機能

- POV反応
- user sense centroid
- POVごとのactivity
- same-axis disagreement
- sense-distance ranking

### UIに出す

- `あなたの感性に近い`
- `遠い視点・共通の価値観`
- `同じ観点で違う感じ方`

### UIに出さない

- PCA plotそのもの
- クラスタ名での陣営化
- 分断チャート

## 4. Bridging-Based Ranking

### 理論

多数決で上げるのではなく、普段は違う立場の人たちにも届くものを上げる。Community Notes / Birdwatch 系の bridging ranking は、この考え方に近いです。

### Daimonでの解釈

Daimonは「近いもの」だけを出しません。遠いが共通POVを持つ投稿や、同じPOVで違う感じ方をしている人を出します。

### 機能

- `disagreement_but_same_axis_bonus`
- `bridge zone`
- 同軸異見カード
- POV activity timeline
- safety-aware candidate selection

### UIに出す

```text
遠い視点・共通の価値観
```

```text
同じ観点で、少し違う感じ方
```

### UIに出さない

- 最大対立の相手
- 炎上中の対立
- 反論数
- 勝敗

## 5. Habermas Machine / Common Ground

### 理論

対立をただ見せるのではなく、違う意見の間にある重なりを見つけて提示する。目的は説得ではなく、共通基盤の発見です。

### Daimonでの解釈

同軸異見カードは、違う意見を出して終わりでは弱いです。最後に「二人が同じだったところ」を返すと、衝突ではなく理解で閉じられます。

### 機能

- closure beat
- `違ったところ`
- `同じだったところ`
- POVページへの深掘り導線

### UIに出す

```text
違ったところ
あなた: 中盤の間が重い
相手: 中盤の間が余韻として効く

同じだったところ
二人とも、テンポが体験の核だと見ている
```

### UIに出さない

- `どちらが正しいか`
- `多数派はこちら`
- `少数派はこちら`

## 6. Information Foraging

### 理論

人は情報を探す時、食べ物を探すように、手がかり、期待価値、移動コストを見ながら進みます。良い探索UIには、次に進む理由としての情報の匂いがあります。

### Daimonでの解釈

グラフ探索は、巨大なノード図を見せることではありません。ユーザーが観点から観点へ進む理由を感じられることが重要です。

### 機能

- 探索タブ
- sense-distance map
- local graph read model
- related POV
- adjacent POV
- bridge zone
- scent label

### UIに出す

```text
このPOVに近い
最近コメントが増えている
あなたの保存から近い
同じ観点で違う感じ方
```

### UIに出さない

- 全体ネットワーク図
- force-directed graphを主役にすること
- 中心性ランキング
- 意味のわからない大量の線

## 7. Information As Reward

### 理論

人は、将来の報酬に関する情報や、不確実性が減る情報をそれ自体として欲しがります。Daimonでは、情報探索そのものが報酬になります。

### Daimonでの解釈

「次の投稿が来るかもしれない」という無限スクロールではなく、「この観点の周辺が少し分かった」という完了感を報酬にします。

### 機能

- 探索ビュー
- 同軸異見カード
- closure beat
- `もう少し広げる`
- `この観点を保存`

### UIに出す

- 新しい観点を見つけた感覚
- 違う理由を読めた感覚
- 重なりが分かった感覚

### UIに出さない

- 無限スクロールでの引き伸ばし
- 通知連打
- FOMO
- streak

## 8. Self-Disclosure Reward

### 理論

自分の考えや感じ方を他人に伝えること自体が報酬になります。

### Daimonでの解釈

長文を書く前に、短い立ち位置を置けることが大事です。投稿しなくても、POVに反応し、一言だけ残せるようにします。

### 機能

- 3択POV反応
- 任意の一言理由
- profile bio
- 自分の最近のPOV
- 保存から作られるsense

### UIに出す

```text
一言だけ添える
```

```text
あなたは最近、この観点をよく開いています
```

### UIに出さない

- 長文投稿の強制
- 反応の公開強制
- 自己開示を競わせるscore

## 9. Optimal Distinctiveness

### 理論

人は、誰かと同じでありたい欲求と、自分は少し違う存在でありたい欲求の両方を持ちます。

### Daimonでの解釈

「同じPOVを見ている」が所属感を作り、「感じ方は少し違う」が個別性を守ります。これが同軸異見の居心地の良さです。

### 機能

- POV rooms
- POV follow
- 同軸異見カード
- `この人たちは同じ観点を見ている`
- `同じ観点で少し違う`

### UIに出す

```text
同じ観点を見ている人
```

```text
少し違う感じ方
```

### UIに出さない

- 陣営名
- 敵味方
- 派閥の勝敗

## 10. Folksonomy / Open Vocabulary

### 理論

タグや分類は、上から完全に決めるより、ユーザーが使う語彙から育つことがあります。ただし、放置すると重複、曖昧語、荒らし語が増えます。

### Daimonでの解釈

POVはopen vocabularyにします。ただし、よく使われるPOVには説明、同義語、親子関係、merged_intoを持たせます。

### 機能

- POV suggest
- pov_definitions
- synonyms
- parent_pov
- merged_into
- related POV cache

### UIに出す

- 既存POVのsuggest
- `似たPOVがあります`
- `このPOVは統合されました`

### UIに出さない

- 完全固定カテゴリ
- MLが勝手にPOVを確定すること

## 11. Aspect-Based Sentiment

### 理論

評価は作品全体への好き嫌いだけではなく、観点ごとに分解できます。

### Daimonでの解釈

投稿全体へのlikeだけでは粗いです。「この投稿をこのPOVで見るとどうか」を保存する必要があります。

### 機能

- post_pov_assertions
- lean
- comment
- spoiler
- confidence
- created_by

### UIに出す

```text
この観点で見ると？
```

```text
ネタバレを含む
```

### UIに出さない

- 投稿全体の総合点だけ
- 単純な星評価だけ

## 12. Explainable Recommendation

### 理論

レコメンドは、なぜ出たかが分かるほど信頼されやすいです。

### Daimonでの解釈

Daimonのrankは複雑でも、表示理由は短くします。

### 機能

- match_reason
- pov_matches
- sense_distance
- is_bridge
- saved signal

### UIに出す

```text
共通の観点: 余韻, テンポ
```

```text
遠い視点・共通の価値観
```

### UIに出さない

- 生のscore
- cosine similarity
- 過剰な説明

## 機能優先順位

理論から逆算すると、優先順位はこうなります。

### P0: 1ジェスチャー

対応理論:

- Tesler's Law
- Self-Disclosure Reward
- Aspect-Based Sentiment

機能:

- POVに3択で反応する。
- 一言理由は任意。
- UIに出す体系は1つだけ。

### P1: 同軸異見カード

対応理論:

- Perspective-getting
- Bridging-Based Ranking
- Optimal Distinctiveness

機能:

- 同じPOVで違うleanの相手を1人出す。
- 相手の短い理由を読む。
- 最大対立ではなく、聞く価値のある違いを出す。

### P1: Closure beat

対応理論:

- Habermas Machine / Common Ground
- Information As Reward

機能:

- 違ったところを1行で出す。
- 同じだったところを1行で出す。
- そこで閉じても満足できる。

### P2: POVページ強化

対応理論:

- Perspective-getting
- Folksonomy
- Aspect-Based Sentiment

機能:

- POV説明
- 最近のPOVコメント
- 関連投稿
- 強いユーザー
- 似た/隣接POV

### P2: post_pov_assertions

対応理論:

- Aspect-Based Sentiment
- Opinion Space

機能:

- 投稿とPOVの関係を主張として保存する。
- lean、comment、spoiler、confidenceを持つ。

### P3: 探索ビュー

対応理論:

- Information Foraging
- Information As Reward
- Opinion Space

機能:

- sense-distance map
- local graph read model
- scent label
- bridge zone
- `もう少し広げる`

### P3: POV activity timeline

対応理論:

- Bridging-Based Ranking
- Weak Ties / Structural Holes
- Explainable Recommendation

機能:

- 最近このPOVで議論が起きている。
- あなたと近い人が反応した。
- あなたと遠い人が同じPOVで別意見を出した。

## まとめ

Daimonの機能は、全部この一文に戻します。

```text
同じものを見て、違う感じ方をしている人と、軽く出会う。
```

理論はこの体験を支える地下構造です。UIは、理論を説明するためではなく、この体験を軽く成立させるためにあります。

## References

- Tessler et al. (2024), "AI can help humans find common ground in democratic deliberation", Science. https://www.science.org/doi/10.1126/science.adq2852
- Wojcik et al. (2022), "Birdwatch: Crowd Wisdom and Bridging Algorithms can Inform Understanding and Reduce the Spread of Misinformation", arXiv. https://arxiv.org/abs/2210.15723
- Eyal, Steffel, and Epley (2018), "Perspective mistaking", Journal of Personality and Social Psychology. https://www.nicholasepley.com/publications
- Small et al. (2021), "Polis: Scaling Deliberation by Mapping High Dimensional Opinion Spaces", Recerca. https://philpapers.org/rec/SMAPED
- Pirolli and Card (1999), "Information Foraging", Psychological Review. https://link.springer.com/rwe/10.1007/978-0-387-39940-9_205
- Bromberg-Martin and Hikosaka (2009), "Midbrain dopamine neurons signal preference for advance information about upcoming rewards", Neuron. https://pmc.ncbi.nlm.nih.gov/articles/PMC2723053/
- Tamir and Mitchell (2012), "Disclosing information about the self is intrinsically rewarding", PNAS. https://www.pnas.org/doi/10.1073/pnas.1202129109
- Brewer (1991), "The Social Self: On Being the Same and Different at the Same Time", Personality and Social Psychology Bulletin. https://journals.sagepub.com/doi/10.1177/0146167291175001
