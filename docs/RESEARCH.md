# DAIMON — 研究・理論ドシエ（武器庫 / 完全版）

最終更新: 2026-06
役割: これは daimon の設計を支える **深い研究基盤（背景・面接用の武器庫）** です。
プロダクト判断の正本は別にあります:
- 何を作るか（理論→機能）: [`THEORY_TO_FEATURES.md`](THEORY_TO_FEATURES.md)
- プロダクト/UX: [`PRODUCT_AND_UX.md`](PRODUCT_AND_UX.md)
- 優先順位: [`ROADMAP.md`](ROADMAP.md)
- 圧縮メモ: [`CONCEPT_AND_RESEARCH.txt`](CONCEPT_AND_RESEARCH.txt)

原則: **基盤は深く、表面は1ジェスチャー（Tesler's Law）。** この文書は「基盤」側の全部。
凡例: ✓ = 本セッションでWeb検索により書誌確認済み / * = 記憶ベース（年・巻号は要最終確認）。

---

## 0. 一行で

daimon は「投稿（主観）をそのまま流す」のではなく、主観を **観点(POV / the axis you
are speaking from)** に分解して蓄積することで、意見が違う人同士でも「同じ観点を見て
いる」という一点で安全に・深く接続できるようにする対話空間。SNS でも純粋な掲示板でも
なく、「POV を通じて他者の感性構造に触れる場所」。

核を一文に畳むと:
> 同じものを見て、違う感じ方をしている人と、軽く出会う。

---

## 1. 解決しようとしている課題

**1.1 エンゲージメント最適化フィードの副作用**
主要SNSは「滞在・反応の最大化」を目的関数にし、(a) 感情的・分断的コンテンツを上位化、
(b) フィルターバブル/エコーチェンバーを生み、(c) 異なる立場との接触を“衝突”でしか
起こさない。← Pariser『Filter Bubble』, Bakshy et al. 2015(Science), Sunstein
『#Republic』, Brady et al. 2017(moral-emotional の拡散), Iyengar et al. 2019。

**1.2 「好き/嫌い・点数」という粗すぎる単位**
感性は多軸（「シナリオは良いがテンポは悪い」）。単一スカラーに潰すと、部分一致・部分
不一致という最も豊かな接続点が失われる。← ErogameScape の POV 構造、Aspect-Based
Sentiment Analysis。

**1.3 フォローグラフの同質性(homophily)** 価値ある情報は弱い紐帯から来るのに、フォロー
SNSはそこに導線がない。← Granovetter, Burt。

**1.4 「カジュアル↔深い」のジレンマ** 熟議ツールは敷居が高く続かない、カジュアルSNSは
深さが出ない。daimon は「1タップの所作」を入口に、背後で感性構造を蓄積する二層で埋める。

**1.5 本質的な問い** 「対立を“比率/炎上”にせず“接続”に変える設計は可能か?」
鍵の新プリミティブ = **同軸異見**（意見は違うが観点は同じ）。普通のSNSでは衝突、POV
空間では最も学びのある対話になる。

---

## 2. 中核アイデア: 観点(POV)を一級市民にする

最小データ単位を「投稿+タグ」でなく:

```
post
 └─ POV assertion(観点主張)
      ├─ POV      : 「シナリオがいい」「テンポ悪い」
      ├─ stance/lean : 共感/問い/違和感（pop: なるほど/気になる/ちがうかも）
      ├─ comment  : なぜそう見るのか
      ├─ user
      └─ (将来) spoiler / confidence
```

「投稿へのコメント」と「POVコメント」は別物：前者は“この投稿について話す”、後者は
“この観点で見るとどうかを話す”。これが対話を「人 vs 人」から「観点という共有の土俵」へ移す。
POVは同時に: 評価軸 / 検索タグ / レコメンド特徴量 / 議論スレッド / 自己紹介 /
他者との距離の測定子、を兼ねる。

---

## 3. Sense-Distance ランキング（署名機能）

```
base = α·near + (1−α)·bridge + 0.15·common_ground [+ 0.20·popularity + 0.10·recency]
最終 = MMR(base, λ)   # 冗長性除去（多様性確保）
```
near=ユーザのsenseに近い(共感) / bridge=遠いが特定POVを共有(弱い紐帯・同軸異見) /
common_ground=共有POV被覆 / popularity=like+3·save / recency=新鮮さ /
MMR=Carbonell & Goldstein 1998。

将来の理論的に正しい拡張:
```
score = semantic_similarity + shared_pov_weight + pov_activity_recency
      + pov_comment_quality + user_affinity_by_pov + disagreement_but_same_axis_bonus
```
最後の項（見ている観点が同じなら結論が逆でも上位化）= Bridging-based ranking の個人版。

---

## 4. アーキテクチャ（要点）

- フロント: React 19 + Vite + TS + Tailwind v4 + react-query
- API: Go(chi / pgx / 自前Qdrant RESTクライアント)。SQLは dbq レジストリに集約。
- ML: Python(FastAPI) — `/embed`(sentence-transformers) と `/povs`(spaCy) だけ。
- ベクトルDB: Qdrant(Cosine, 384次元)。RDB: PostgreSQL。キャッシュ: Redis。
- バッチ(Go): timeline事前計算 / suggest事前計算 / long-post deep-analyze。
- 共有ベクトル演算は `internal/vec`(Mean/BlendSaved/ChunkRunes) に集約。

**埋め込みモデルの判断**: `paraphrase-multilingual-MiniLM-L12-v2`(384次元・多言語)。
旧 `all-MiniLM-L6-v2` は英語専用で日本語が縮退ベクトルに潰れ、検索が一律~40%マッチに
なり機能しなかった。384次元維持でQdrant改修不要・768次元の半分メモリ。モデル変更時は
**full re-seed 必須**。← Reimers & Gurevych 2019/2020。

**長文×深い分析**: 投稿上限 40,000字。MiniLM系は~128トークンで切れるため、
max_seq_length=512 + チャンク平均プールで投稿“全体”を埋め込む。バッチ deep-analyze が
長文を複数POVへ自動分解。深い符号化 ← Craik & Lockhart 1972。

---

## 5. 設計 ↔ 科学の対応（本ドキュメントの核心）

### 5.1 脳科学（“通信”と“距離”が脳レベルで実在する）

- **通信の成立 = 脳の同期** ✓ Stephens, Silbert & Hasson (2010, PNAS 107:14425–
  14430). 話者と聴者の脳活動が時空間的に結合、“伝わらない”と消える。先行的(予測的)結合
  が大きいほど理解が深い。→ 「通信」は比喩でなく脳同期現象。POVは結合の足場。
- **感性の近さ = 神経応答の近さ、社会的距離で減衰** ✓ Parkinson, Kleinbaum &
  Wheatley (2018, Nat. Commun. 9:332). 自然動画視聴の神経応答類似度は親友で最大、
  社会的距離で低下。→ Sense-Distance の神経的実在。
- **自己開示は本質的に報酬** ✓ Tamir & Mitchell (2012, PNAS 109(21):8038–8043).
  自己開示で中脳辺縁ドーパミン系(側坐核・腹側被蓋野)が活動、人は自己開示に金銭を払う。
  → 「観点を書く/立ち位置を示す」こと自体が神経報酬。入口を軽くすれば内発的に回る。
- **メンタライジング網**: mPFC・TPJ・楔前部。* Saxe & Kanwisher (2003, TPJ),
  * Mitchell, Macrae & Banaji (2006, Neuron: 似た他者で腹側mPFC、似てない他者で背側
  mPFC)。→ 「似た人/遠い人」で脳処理系が分かれる。daimon は遠い人を共有POV経由で安全に
  提示し、メンタライジング負荷を下げる。
- **好奇心とドーパミン/海馬学習**: * Kang et al. (2009, Psych. Science),
  * Gruber, Gelman & Ranganath (2014, Neuron). → 同軸異見は“予測の裂け目”=情報ギャップ
  で好奇心→学習→記憶を起動。対立を学習報酬に変換。
- **予測処理/自由エネルギー**: * Friston (2010, NRN), * Clark (2013, BBS). 新規だが
  接地可能な情報(遠いが共有軸あり)が最良の学習源。bridge は予測誤差の最適帯を狙う。
- **誇張回避**: ミラーニューロンの“共感の座”解釈は過剰(* Hickok 2014『The Myth of
  Mirror Neurons』)、オキシトシン“信頼ホルモン”は再現性問題(* Nave et al. 2015)。
  daimon は neural coupling / 神経類似 / 自己開示報酬 の頑健な知見に依拠する。

### 5.2 心理学（“観点分解”と“距離越え”が人を動かす）

- **接触仮説**: * Allport (1954), * Pettigrew & Tropp (2006, メタ分析)。条件付き接触
  は偏見を減らす。→ 共有POVを足場にした遠い立場との接触。
- **視点取得より“視点聴取”**: * Eyal, Steffel & Epley (2018, JPSP 114:547–571,
  "Perspective mistaking"). 想像(taking)は精度を下げ確信だけ上げる。25実験。
  「他人の心は口を通して出てくる」。→ POVは「相手の理由を聞く」装置にすべき（推測させない）。
- **自己拡張 & 親密性の実験的生成**: ✓ Aron et al. (1997, PSPB 23(4):363–377, 36の
  質問). 段階的・相互の自己開示が45分で親密性を生む。+ * Reis & Shaver(親密性=開示+
  応答的反応)。→ 「カジュアルに深く」= 漸増する自己開示の設計（POV→stance→なぜ→対話）。
- **処理水準**: * Craik & Lockhart (1972). 深い意味処理ほど残る → 長文・観点論証。
- **認知的不協和・確証バイアス**: * Festinger (1957), * Nickerson (1998). 人は同調情報を
  選ぶ → 同軸異見の足場を明示設計しないと自動的にエコーチェンバーへ。
- **情報ギャップ/好奇心**: * Loewenstein (1994, Psych. Bulletin). 既知と未知の最適隙間。
  → bridge の距離調整(遠すぎず近すぎず)の工学化。
- **解釈レベル理論/心理的距離**: * Trope & Liberman (2010, Psych. Review)。
- **道徳のリフレーミング**: * Feinberg & Willer (2015, PSPB), * Haidt (2012)。同じ事象を
  別観点(別の道徳軸)で語り直す土俵。
- **共有された現実**: * Hardin & Higgins (1996), * Echterhoff et al. (2009)。共有POV=
  小さな共有現実。
- **知的謙虚さ**: * Leary et al. (2017, PSPB)。stance「問い」「違和感」を一級にしてUIに埋める。
- **認知欲求/最適弁別性**: * Cacioppo & Petty (1982), * Brewer (1991, optimal
  distinctiveness)。「同じ観点(同化)で違う立場(差別化)」=最適弁別性そのもの。

### 5.3 社会科学/ネットワーク（“遠さ”の価値）

- * Granovetter (1973, AJS 78:1360–1380) 弱い紐帯 / * Burt (1992, 構造的空隙;
  2004 "Structural holes and good ideas") / * Putnam (2000, bonding vs bridging)。
- 分極/エコーチェンバー: * Iyengar et al. (2019), * Sunstein (2017), * Bail (2021,
  反対意見の単純曝露はむしろ硬化させうる→曝露の“やり方”が重要)。
- 意見ダイナミクス: * Hegselmann & Krause (2002, bounded confidence),
  * Deffuant et al. (2000), * Axelrod (1997)。bridge は各人の信頼区間の縁を狙う操作。

### 5.4 熟議/シビックテック/HCI（集団レベルの先行実装）

- **Pol.is（最重要の先行例）** ✓ Small, Bjorkegren, Erkkilä, Shaw & Megill (2021,
  RECERCA 26(2)). 賛否投票をPCAで次元圧縮し意見空間に人を配置、グループ横断で合意される
  発言を浮上。台湾 vTaiwan で政策合意(Uber規制等)に使用。あるケースで第1主成分が会話の
  分散の22%を説明。→ Sense-Distance + bridge の集団版。
- **Bridging-based ranking / Community Notes** ✓ Wojcik, Hilgard, Judd, Mocanu,
  Ragain, Hunzaker, Coleman & Baxter (2022, arXiv:2210.15723, 旧Birdwatch).
  行列分解で意見空間を教師なし表現し、対立する立場の双方から支持されたものだけ表示。
  多数決でない。bridgingが選んだnoteは misinfo の like/repost を対照群比 25–34% 低下。
  + * Ovadya (2022) "Bridging-based ranking"。→ disagreement_but_same_axis_bonus の根拠。
- 構造化熟議UI: * Kriplean et al. (2012, CSCW "ConsiderIt"; "Reflect"), Kialo。
- 通信の共通基盤: * Clark & Brennan (1991) "Grounding in communication"。POV=共通基盤の
  明示的単位。

### 5.5 計算機科学/NLP/IR/RecSys（実装の背骨）

- 文埋め込み: * Reimers & Gurevych (2019 SBERT; 2020 多言語蒸留=採用モデルの祖),
  * Devlin et al. (2019 BERT), * Mikolov et al. (2013 word2vec)。
- 観点分解=ABSA/Stance: * Pontiki et al. (2014, SemEval-2014 Task 4),
  * Hu & Liu (2004), * Mohammad et al. (2016, stance)。
- 多様性/セレンディピティ: * Carbonell & Goldstein (1998, MMR / 使用中),
  * Ge, Delgado-Battenfeld & Jannach (2010, RecSys "beyond accuracy"),
  * Zhang et al. (2012, WSDM "Auralist"), * Nguyen et al. (2014, WWW)。
- ベクトル検索: * Johnson, Douze & Jégou (2017, FAISS), * Malkov & Yashunin
  (2018, HNSW)。Qdrant はこの系譜。

### 5.6 探索本能と報酬（グラフ探索 & 内発的報酬UIの基盤）

**本能的報酬には2種類あり、片方は daimon の敵。**

- **ドーパミン = 快楽でなく“したくなる(wanting/incentive salience)”** ✓ Berridge &
  Robinson(incentive salience理論; Berridge 2007, Psychopharmacology 191:391–431).
  「wanting(動機)」と「liking(快)」は別系統。ドーパミンは追跡・予期の動機を作る。
- **SEEKING系** ✓ Panksepp(Affective Neuroscience). VTA起点の探索・好奇心・期待の回路。
  「報酬そのもの」でなく「報酬の予感」を駆動。
- **情報採餌(Information Foraging)** ✓ Pirolli & Card (1999, Psych. Review 106:643–
  675). 人は動物の最適採餌と同じく「情報の匂い(scent)」を辿りパッチ間を動く。グラフ
  探索ビューはこの採餌面 — scent があれば SEEKING が正しく発火する。
- **情報自体がドーパミン報酬** * Bromberg-Martin & Hikosaka (2009, Neuron). 一次報酬を
  信号する同じドーパミンニューロンが「先の情報」も信号する。
- **能動的サンプリングと好奇心** ✓ Gottlieb & Oudeyer (2018, Nat. Rev. Neurosci.
  19(12):758–770). 情報“sampling”(既知タスクの不確実性低減)と“search”(開放的発見)の区別、
  学習進捗(learning progress)に基づく内発的動機。
- **自己開示報酬** ✓ Tamir & Mitchell (2012, 再掲)。一言を出すこと自体が報酬→入口が軽い。

**線引き（設計則）**:
- 使う = 「見つける/繋がる/分かる」で**満たされて終わる**報酬(SEEKING/closure/自己開示/
  学習進捗)。
- 拒否 = 「**満たされないよう設計された**」報酬 = variable-ratio スロットマシン(無限
  スクロール/連続記録/いいね数の地位化/赤バッジ通知/FOMO)。これは §1.1 の批判対象そのもの。
- ∴ グラフ探索は force-directed の毛玉にせず、**sense-distance を漕ぐ scent 付き
  foraging**(第2モード)にする。報酬は closure(「二人が同じだったのはここ」)で閉じる。

---

## 6. 設計原理: Tesler's Law（複雑さ保存則）

* Larry Tesler, Law of Conservation of Complexity. どんなシステムにも消せない複雑さが
あり、唯一の問いは「誰が背負うか — ユーザーか、開発者か、プラットフォームか」。
→ 「ポップで簡単なものほど基盤が深い」は気の利いた観察でなくこの法則の言い換え。
検索窓1個の裏のPageRank、Community Notesの「役に立った?」1タップの裏のMF。
daimon は vector/bridging/sense-distance/観点分解を全部 system 側に沈め、ユーザーには
1ジェスチャーだけ渡す。これが ErogameScape(統計を表に出す)との分岐点。

近接研究: * Sorensen et al. (2024, "A roadmap to pluralistic alignment",
arXiv:2402.05070), * Ovadya 系 "Generative CI through Collective Response Systems"
(arXiv:2302.00672)。

---

## 7. 最新研究（2023–2026）: AI媒介熟議 / 生成的社会選択 / Bridging検証

- ✓ **Tessler, Summerfield, et al. (2024, Science 386(6719), DeepMind「Habermas
  Machine」)**. UK 5,734名。LLMが各人の自由記述から**重なり(overlap)**を抽出して集団声明
  を生成、人間ファシリテータより明確・公平と評価され、討議後に分断が低下、少数意見も疎外
  しなかった。訓練目標は「説得(persuade)」でなく「媒介(mediate)」。
  → daimon の「同軸異見→共通基盤」の AI 媒介版。**最重要の最新例**。
  注: 「全視点を等重み」は公正でなく、利害(stake)比例の重みが要る(proportionality)という
  批判 → 将来論点。
- ✓ **Fish, Gölz, Procaccia, et al. (2023 arXiv:2309.01291; 2025 "The Next
  Generation")**. Generative Social Choice。提出文だけでなく“あらゆる発言”を候補とみなし、
  LLMで合意文を生成しつつ選好を予測。
- * **PoliCon (2025, arXiv:2505.19558)**. 欧州議会13年(2009–2022)2,225件で LLM の合意
  決議草案能力を評価。
- ✓ **Community Notes の限界 (2024–2025, PNAS ほか)**. 表示noteは~10%で減少傾向、評価者
  バイアスに敏感、分断的話題ほど正確noteが出にくい(2024米大統領選で正確noteの74%が非表示)。
  → bridging は有望だが規模と分断が難所。daimon は「小さな共有軸から積む」設計でこれを避ける。
- ✓ **Voelkel, Willer, et al. (2024, Science)**. Megastudy(米32,000名/25介入)。有効=
  反対派の共感的人物の提示/共有アイデンティティ/相手の誤認の訂正。ただし効果は約2週間で
  減衰 → 「一回の介入でなく日常の体験設計」が要る根拠。
  + * Voelkel et al. (2023, Nat. Hum. Behav.): 分極低減は必ずしも反民主的態度を改善しない。
- * Argyle et al. (2023). AIチャット補助が分断的話題の会話の質を高めうる。※venue要確認。

---

## 8. 成功したサービス例（設計の部分的実証）

**観点(POV)を一級にする = アスペクト分解レビュー文化**
ErogameScape(着想源・20年続くPOV-DB) / Letterboxd(カジュアルな短評で“レビューを社交”
に・急成長) / RateYourMusic・Discogs / The StoryGraph(mood・pace の観点タグ) /
Untappd・Vivino・BeerAdvocate(多軸評価) / MyAnimeList・AniList(タグ+affinity%) /
BoardGameGeek / Genius(行単位の注釈=断片へのPOV)。
→ 「全体評価」より「観点別」の方が書く側も読む側も豊か。

**Bridging/横断的合意 = daimon中核の大規模実証**
Community Notes(bridging本番運用) / Pol.is+vTaiwan(政策合意) / Wikipedia(NPOV+合意編集)。

**構造化で“深いのに使える”**
Stack Overflow(雑談フォーラム→永続知識) / Reddit(subreddit=軸) / Metaculus / Kialo。

**フォローグラフを超える発見 = 興味グラフ/セレンディピティ**
TikTok(「人より軸」の最大の証明) / Pinterest(興味グラフ) / Spotify Discover Weekly /
Are.na(チャンネル横断の静かで深いキュレーション)。

一言で: ErogameScapeの観点分解 ×(Community Notes/Pol.isの橋渡し)×(Letterboxdの
カジュアルな深さ)×(TikTokの興味グラフ)を、“感性距離で繋ぐ”一体験に統合する。

---

## 9. 哲学/対話理論（背景思想）

* Bakhtin (1981, The Dialogic Imagination, 多声性) / * Habermas (1984, Theory of
Communicative Action, 熟議的合理性) / * Buber (1923, I and Thou, 我と汝)。

---

## 10. 一段落でのまとめ（面接で言うなら）

daimon は「主観をそのまま流すSNS」への反命題である。主観を“観点(POV)”という共有可能な軸
に分解して蓄積し、感性距離(Sense-Distance)で人とコンテンツを並べ、「意見は違うが観点は
同じ」という関係を上位化(bridging)することで、対立を炎上ではなく**学習と接続**に変換する。
これは Pol.is と Bridging-based ranking、そして Habermas Machine が集団レベルで示した方向
を、神経科学(通信=脳同期 / 感性近接=神経類似 / 自己開示=報酬 / 探索=SEEKING)と対人心理学
(接触仮説 / 視点聴取 / 漸増的自己開示 / 最適弁別性)に接地し、個人の発見体験へ落とし込む
試みである。複雑さは全て地下に沈め、表面は1ジェスチャーに保つ(Tesler's Law)。
