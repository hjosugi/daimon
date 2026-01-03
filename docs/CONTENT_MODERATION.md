# コンテンツモデレーション実装ガイド

## 主要サービスの実装方法

### 1. **Twitter/X**
- **機械学習モデル**: 自社開発のトキシシティ検出モデル
- **リアルタイム検出**: 投稿前に自動スキャン
- **段階的対応**: 警告表示 → 非表示 → 削除
- **人間によるレビュー**: 自動検出後の確認

### 2. **Bluesky**
- **AT Protocol**: 分散型アーキテクチャ
- **モデレーションサービス**: オープンソースのモデレーションAPI
- **コミュニティ主導**: 各インスタンスが独自のルールを設定可能

### 3. **Misskey**
- **キーワードフィルター**: 禁止ワードリスト
- **AI検出**: オプションでAIモデレーションAPI統合
- **ユーザー報告**: 報告ベースのモデレーション

### 4. **一般的な手法**

#### APIサービス
- **Perspective API** (Google Jigsaw): トキシシティ検出、無料枠あり
- **AWS Comprehend**: 感情分析、不適切コンテンツ検出
- **Azure Content Moderator**: テキスト・画像モデレーション
- **OpenAI Moderation API**: GPTベースのコンテンツ検出

#### 自社実装
- **BERT/RoBERTa**: トキシシティ分類モデル
- **DistilBERT**: 軽量版、高速推論
- **多言語対応**: XLM-RoBERTaなど

## Daimonでの実装

### 現在の実装（MVP）
- キーワードベースのフィルタリング
- スパムパターン検出（URL、メンション数）
- 投稿長さチェック

### 推奨される改善

#### 1. Perspective API統合（簡単）
```python
# 環境変数に PERSPECTIVE_API_KEY を設定
# content_moderation_service.py の check_with_perspective_api を有効化
```

#### 2. 機械学習モデル統合（中級）
```python
# transformers ライブラリを使用
from transformers import pipeline

toxicity_classifier = pipeline(
    "text-classification",
    model="unitary/toxic-bert",
    device=0  # GPU使用時
)
```

#### 3. 段階的対応システム（上級）
- **レベル1**: 警告表示（投稿は公開）
- **レベル2**: 非表示（本人のみ閲覧可能）
- **レベル3**: 削除（自動削除）

#### 4. ユーザー報告機能
- 報告ボタンの追加
- 報告内容の集計
- 閾値超過時の自動対応

## 実装の優先順位

1. **Phase 1 (現在)**: キーワードフィルター + 基本パターン検出
2. **Phase 2**: Perspective API統合
3. **Phase 3**: ユーザー報告機能
4. **Phase 4**: 機械学習モデル統合
5. **Phase 5**: 段階的対応システム

## コスト考慮

- **Perspective API**: 無料枠あり（1分あたり1リクエスト）
- **AWS Comprehend**: 従量課金（$0.0001/100文字）
- **自社モデル**: 初期コスト高、運用コスト低
