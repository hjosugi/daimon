#!/usr/bin/env python3
"""
データベースとQdrantを完全にリセットして再作成するスクリプト
全てのテーブルとコレクションを削除してから、1から作成します
"""
import sys
from sqlalchemy import create_engine, text
from app.database import DATABASE_URL
from app.services.qdrant_service import QDRANT_HOST, QDRANT_PORT, COLLECTION_NAME, VECTOR_SIZE
from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance
from alembic.config import Config
from alembic import command

def main():
    print("=" * 60)
    print("データベースとQdrantをリセットして再作成します")
    print("=" * 60)
    print()
    print("⚠️  警告: 全てのデータが削除されます！")
    print("   - PostgreSQL: 全てのテーブル")
    print("   - Qdrant: postsコレクション")
    print()
    
    confirm = input("続行しますか？ (yes/no): ")
    if confirm.lower() != "yes":
        print("キャンセルしました")
        sys.exit(0)
    
    print()
    
    # PostgreSQLのリセット
    print("1. PostgreSQL: データベースに接続中...")
    engine = create_engine(DATABASE_URL)
    
    try:
        with engine.begin() as conn:
            print("2. PostgreSQL: 既存のテーブルを削除中...")
            
            # 外部キー制約を無効化してから削除
            conn.execute(text("DROP TABLE IF EXISTS alembic_version CASCADE"))
            conn.execute(text("DROP TABLE IF EXISTS pov_likes CASCADE"))
            conn.execute(text("DROP TABLE IF EXISTS comments CASCADE"))
            conn.execute(text("DROP TABLE IF EXISTS likes CASCADE"))
            conn.execute(text("DROP TABLE IF EXISTS povs CASCADE"))
            conn.execute(text("DROP TABLE IF EXISTS posts CASCADE"))
            conn.execute(text("DROP TABLE IF EXISTS sessions CASCADE"))
            conn.execute(text("DROP TABLE IF EXISTS users CASCADE"))
            
            print("   ✓ PostgreSQLテーブルを削除しました")
        
        print()
        print("3. PostgreSQL: Migrationでテーブルを再作成中...")
        alembic_cfg = Config("alembic.ini")
        command.upgrade(alembic_cfg, "head")
        print("   ✓ PostgreSQLテーブルを再作成しました")
        
        # Qdrantのリセット
        print()
        print("4. Qdrant: 接続中...")
        qdrant_client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)
        
        print("5. Qdrant: 既存のコレクションを削除中...")
        try:
            qdrant_client.delete_collection(collection_name=COLLECTION_NAME)
            print(f"   ✓ コレクション '{COLLECTION_NAME}' を削除しました")
        except Exception as e:
            # コレクションが存在しない場合は無視
            if "doesn't exist" not in str(e).lower() and "not found" not in str(e).lower():
                raise
            print(f"   ℹ コレクション '{COLLECTION_NAME}' は存在しませんでした")
        
        print()
        print("6. Qdrant: コレクションを再作成中...")
        qdrant_client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
        )
        print(f"   ✓ コレクション '{COLLECTION_NAME}' を再作成しました")
        
        print()
        print("=" * 60)
        print("✓ データベースとQdrantのリセットが完了しました")
        print("=" * 60)
        print()
        print("FastAPIサーバーを再起動してください。")
        
    except Exception as e:
        print()
        print("✗ エラーが発生しました:")
        print(f"   {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
