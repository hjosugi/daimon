#!/usr/bin/env python3
"""
Script to completely reset and recreate database and Qdrant
Deletes all tables and collections, then recreates from scratch
"""
import sys
from sqlalchemy import create_engine, text
from app.database import DATABASE_URL
from app.services.qdrant_service import (
    QDRANT_HOST,
    QDRANT_PORT,
    COLLECTION_NAME,
    VECTOR_SIZE,
)
from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance
from alembic.config import Config
from alembic import command


def main():
    print("=" * 60)
    print("Resetting and recreating database and Qdrant")
    print("=" * 60)
    print()
    print("⚠️  WARNING: All data will be deleted!")
    print()

    confirm = input("Continue? (yes/no): ")
    if confirm.lower() != "yes":
        print("Cancelled")
        sys.exit(0)

    print()

    print("1. PostgreSQL: Connecting to database...")
    engine = create_engine(DATABASE_URL)

    try:
        with engine.begin() as conn:
            print("2. PostgreSQL: Deleting existing tables...")

            conn.execute(text("DROP TABLE IF EXISTS alembic_version CASCADE"))
            conn.execute(text("DROP TABLE IF EXISTS pov_likes CASCADE"))
            conn.execute(text("DROP TABLE IF EXISTS comments CASCADE"))
            conn.execute(text("DROP TABLE IF EXISTS likes CASCADE"))
            conn.execute(text("DROP TABLE IF EXISTS povs CASCADE"))
            conn.execute(text("DROP TABLE IF EXISTS posts CASCADE"))
            conn.execute(text("DROP TABLE IF EXISTS sessions CASCADE"))
            conn.execute(text("DROP TABLE IF EXISTS users CASCADE"))

            print("   ✓ PostgreSQL tables deleted")

        print()
        print("3. PostgreSQL: Recreating tables with migration...")
        alembic_cfg = Config("alembic.ini")
        command.upgrade(alembic_cfg, "head")
        print("   ✓ PostgreSQL tables recreated")

        print()
        print("4. Qdrant: Connecting...")
        qdrant_client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)

        print("5. Qdrant: Deleting existing collection...")
        try:
            qdrant_client.delete_collection(collection_name=COLLECTION_NAME)
            print(f"   ✓ Collection '{COLLECTION_NAME}' deleted")
        except Exception as e:
            if (
                "doesn't exist" not in str(e).lower()
                and "not found" not in str(e).lower()
            ):
                raise
            print(f"   ℹ Collection '{COLLECTION_NAME}' did not exist")

        print()
        print("6. Qdrant: Recreating collection...")
        qdrant_client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
        )
        print(f"   ✓ Collection '{COLLECTION_NAME}' recreated")

        print()
        print("=" * 60)
        print("DONE")
        print("=" * 60)
        print()

    except Exception as e:
        print()
        print("✗ Error occurred:")
        print(f"   {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
