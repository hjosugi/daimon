<!-- i18n: language-switcher -->
[English](README.en.md) | [日本語](README.md)

# Daimon Docs

このディレクトリは、Daimon を「何を作っているか」「なぜその形なのか」「どう動いているか」に分けて読むための正本です。

トップの `README.md` は起動方法と全体像、`docs/` は設計思想・UX・実装構造・今後の判断を扱います。

## まず読む順

| 文書 | 役割 |
| --- | --- |
| [DAIMON_PROJECT_DESCRIPTION.txt](DAIMON_PROJECT_DESCRIPTION.txt) | プロジェクト全体の長文ブリーフ。面接・説明・思想整理向け。 |
| [PRODUCT_AND_UX.md](PRODUCT_AND_UX.md) | POV中心のプロダクト設計、sense-distance探索、内発的報酬UIの正本。 |
| [THEORY_TO_FEATURES.md](THEORY_TO_FEATURES.md) | 理論から機能へ落とした対応表。何を作るべきかの判断軸。 |
| [ARCHITECTURE.md](ARCHITECTURE.md) | 現行実装の構造。Go API、ML service、PostgreSQL、Qdrant、Redisの責務。 |
| [ROADMAP.md](ROADMAP.md) | いま作るもの、次に作るもの、まだ作らないもの。 |
| [CONTENT_MODERATION.md](CONTENT_MODERATION.md) | POVコメント、ネタバレ、通報、荒れやすい議論の安全設計。 |
| [CONCEPT_AND_RESEARCH.txt](CONCEPT_AND_RESEARCH.txt) | 研究・参考サービス・理論の圧縮メモ。プロダクト仕様ではなく背景資料。 |
| [RESEARCH.md](RESEARCH.md) | 研究・理論の**完全版ドシエ（武器庫）**。論文の注釈付き羅列、設計↔科学の対応、脳科学/心理学、最新研究(2024–)、成功サービス。面接の深掘り用。 |

互換用の薄い索引:

- [FEATURES.txt](FEATURES.txt): 機能一覧は [ROADMAP.md](ROADMAP.md) に集約。
- [SPEC.txt](SPEC.txt): 理論ベースの仕様は [THEORY_TO_FEATURES.md](THEORY_TO_FEATURES.md) に集約。

## Daimonを一文で

Daimon は、投稿ではなく「観点(POV)」を会話の単位にして、同じものを見て違う感じ方をしている人と軽く出会うためのSNSです。

## 現時点のMVP

現在の実装は、次の体験を成立させる段階です。

1. ユーザーが投稿し、POVを付ける。
2. 投稿本文をembeddingし、Qdrantで意味検索できるようにする。
3. PostgreSQLに投稿・POV・コメント・フォロー・保存を正本として残す。
4. タイムラインで、意味が近い投稿だけでなく、共通POVを持つ遠い投稿も混ぜる。
5. POVページで、その観点に対するコメントや関連投稿を見る。

まだ完成していない中核は、`post_pov_assertions` とsense-distance探索です。今の `povs: string[]` は入口としては有効ですが、Daimonらしさを出すには「この投稿をこの観点で見るとどうか」という主張を保存する必要があります。

## 正本とローカルメモ

`docs/*.md` と `docs/*.txt` は共有用です。

`docs/*.local.md` は `.gitignore` 済みのローカル詳細メモです。環境固有の試行錯誤、未確定の設計、長い実装読み解きはここに置けます。共有ドキュメントへ反映する時は、判断だけを短く移してください。

## 設計の合言葉

- 表面は軽く、地下は深くする。
- 統計を見せすぎず、観点の空気を読めるようにする。
- 人を点数でランクしない。感性の構造として読めるようにする。
- ベクトル検索だけでなく、人が選んだPOVをランキングの強いシグナルにする。
- 「同じ観点で違う感じ方」を、衝突ではなく好奇心の入口として出す。
