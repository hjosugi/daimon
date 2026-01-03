# Alembic Migration Guide

Alembicを使用したデータベースマイグレーション管理です。

## 基本的な使い方

### マイグレーションの作成

モデルを変更した後、新しいマイグレーションを作成します：

```bash
# 自動検出でマイグレーションを作成
alembic revision --autogenerate -m "Description of changes"

# 手動でマイグレーションを作成
alembic revision -m "Description of changes"
```

### マイグレーションの適用

```bash
# 最新のマイグレーションまで適用
alembic upgrade head

# 特定のリビジョンまで適用
alembic upgrade <revision>

# 1つ前のマイグレーションに戻す
alembic downgrade -1

# すべてのマイグレーションを元に戻す
alembic downgrade base
```

### 現在の状態を確認

```bash
# 現在のマイグレーション状態を確認
alembic current

# マイグレーション履歴を確認
alembic history

# 特定のリビジョンの詳細を確認
alembic show <revision>
```

### 既存のデータベースをスタンプ

既存のデータベースがある場合、現在の状態をスタンプします：

```bash
# 最新のマイグレーションをスタンプ（適用はしない）
alembic stamp head

# 特定のリビジョンをスタンプ
alembic stamp <revision>
```

## マイグレーションファイルの構造

マイグレーションファイルは `alembic/versions/` ディレクトリに保存されます。

各マイグレーションファイルには：
- `upgrade()`: データベースを新しい状態に更新
- `downgrade()`: データベースを以前の状態に戻す

が定義されています。

## 注意事項

1. **マイグレーションの順序**: マイグレーションは順番に適用されます。順序を変更しないでください。
2. **データのバックアップ**: 本番環境では、マイグレーション適用前に必ずデータベースのバックアップを取ってください。
3. **テスト**: マイグレーションは開発環境で十分にテストしてから本番環境に適用してください。

## トラブルシューティング

### マイグレーションが適用できない場合

```bash
# 現在の状態を確認
alembic current

# 履歴を確認
alembic history

# 手動でスタンプ
alembic stamp <revision>
```

### マイグレーションを修正する場合

マイグレーションファイルを直接編集できますが、既に適用済みのマイグレーションは変更しないでください。
新しいマイグレーションを作成して修正してください。
