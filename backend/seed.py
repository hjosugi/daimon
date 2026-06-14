#!/usr/bin/env python3
"""
Seed the local database + Qdrant with realistic test data.

Generates users (all @example.com, password "password123"), posts grouped into
semantic topic clusters (so the Sense-Distance ranker has real structure to
work with), POVs/tags, and optional likes/comments. Posts get batch-encoded
embeddings and are bulk-upserted into Qdrant.

Usage (from backend/, with infra up + migrated):
    ./.venv/bin/python seed.py                 # 12,000 posts, ~300 users
    ./.venv/bin/python seed.py --posts 20000 --users 500
    ./.venv/bin/python seed.py --fresh         # wipe test tables first
    ./.venv/bin/python seed.py --no-likes --no-comments

All seeded accounts share the password:  password123
"""
from __future__ import annotations

import argparse
import random
import uuid
from datetime import datetime, timedelta

from sqlalchemy import text

import numpy as np

from app.database import SessionLocal, engine, Post, POV, Like, Comment, User
from app.routers.auth import hash_password
from app.services.embedding_service import embedding_service
from app.services.qdrant_service import qdrant_service, COLLECTION_NAME, VECTOR_SIZE
from qdrant_client.models import PointStruct

random.seed(42)


def _normalize(v: "np.ndarray") -> "np.ndarray":
    n = np.linalg.norm(v)
    return (v / n).astype(np.float32) if n else v.astype(np.float32)

# --- Topic clusters: (tags pool, text templates). Mixed ja/en on purpose. ----
CLUSTERS = {
    "infra": {
        "tags": ["kubernetes", "k8s", "docker", "terraform", "aws", "gcp", "devops",
                 "observability", "sre", "platform engineering"],
        "templates": [
            "{t} を使った本番基盤の構成について考えていることをまとめた。",
            "Spent the day debugging a {t} rollout — autoscaling is finally stable.",
            "{t} のコスト最適化、ここ3ヶ月でかなり知見が溜まった。",
            "Migrated our pipeline to {t}; the developer experience is night and day.",
        ],
    },
    "data_ml": {
        "tags": ["machine learning", "vector search", "embeddings", "snowflake",
                 "data engineering", "nlp", "llm", "recommendation", "rag", "etl"],
        "templates": [
            "{t} を推薦システムに組み込んだら、発見性が明らかに上がった。",
            "A small experiment with {t} changed how I think about ranking.",
            "{t} のパイプラインを書き直して、レイテンシを半分にできた。",
            "Why {t} alone creates echo chambers — and what to do about it.",
        ],
    },
    "frontend": {
        "tags": ["react", "typescript", "vite", "tailwind", "ux", "design systems",
                 "accessibility", "frontend", "web performance", "animation"],
        "templates": [
            "{t} で小さなSNSのプロトタイプを作っている話。",
            "Refactored our {t} setup — build times dropped dramatically.",
            "{t} のアクセシビリティ、もっと真剣に考えるべきだと思う。",
            "A clean {t} component is mostly about deleting code, not adding it.",
        ],
    },
    "ethics_comm": {
        "tags": ["ethics", "communication", "philosophy", "society", "empathy",
                 "debate", "opinion", "community", "psychology", "values"],
        "templates": [
            "価値観の違いから生まれる対立を、どう設計で減らせるかを考えている。",
            "On purpose I read articles I strongly disagree with. {t} matters.",
            "{t} について、自分と遠い立場の人とちゃんと話してみた記録。",
            "Disagreement isn't the problem; the lack of shared {t} is.",
        ],
    },
    "lifestyle": {
        "tags": ["coffee", "travel", "running", "cooking", "books", "photography",
                 "minimalism", "music", "gardening", "tea"],
        "templates": [
            "週末に{t}にハマっていて、生活のリズムが少し変わった。",
            "Picked up {t} again after years — small joys compound.",
            "{t} を続けることで集中力が戻ってきた気がする。",
            "Everything I know about {t}, condensed into one short note.",
        ],
    },
    "startup": {
        "tags": ["startup", "product", "growth", "fundraising", "hiring",
                 "go to market", "metrics", "founder", "pricing", "strategy"],
        "templates": [
            "{t} について、失敗から学んだことを正直に書く。",
            "The hardest part of {t} is saying no to good-but-distracting ideas.",
            "{t} の指標を一つに絞ったら、チームの動きが速くなった。",
            "Notes on {t} from someone who got it wrong twice.",
        ],
    },
}
CLUSTER_NAMES = list(CLUSTERS.keys())

COMMENT_TEXTS = [
    "なるほど、その視点はなかった。", "完全に同意。", "ここ、もう少し詳しく聞きたい。",
    "I see it differently, but this is well put.", "Saved this — thanks for sharing.",
    "反対の立場だけど、考えさせられた。", "実体験に基づいていて説得力がある。",
    "This matches what we saw in production.",
]


def make_post_text(cluster_name: str) -> tuple[str, list[str]]:
    """Return (text, povs) for a post in the given cluster, with occasional
    cross-cluster POV to create 'bridges' for the discovery ranker."""
    c = CLUSTERS[cluster_name]
    topic = random.choice(c["tags"])
    text_str = random.choice(c["templates"]).format(t=topic)

    n_pov = random.randint(1, 4)
    povs = set(random.sample(c["tags"], min(n_pov, len(c["tags"]))))
    povs.add(topic)
    # ~15% of posts borrow a POV from a different cluster (the "bridge" seed).
    if random.random() < 0.15:
        other = random.choice([n for n in CLUSTER_NAMES if n != cluster_name])
        povs.add(random.choice(CLUSTERS[other]["tags"]))
    return text_str, list(povs)


def truncate_test_data(db) -> None:
    print("  ⚠️  --fresh: truncating posts/povs/likes/comments/sessions/users ...")
    db.execute(text(
        "TRUNCATE TABLE pov_likes, povs, comments, likes, sessions, posts, users "
        "RESTART IDENTITY CASCADE"
    ))
    db.commit()
    try:
        from qdrant_client.models import Distance, VectorParams
        from app.services.qdrant_service import VECTOR_SIZE
        qdrant_service.client.delete_collection(collection_name=COLLECTION_NAME)
        qdrant_service.client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
        )
        print("  ✓ Qdrant collection recreated")
    except Exception as e:
        print(f"  ! Qdrant reset skipped: {e}")


def main() -> None:
    ap = argparse.ArgumentParser(description="Seed test data into Postgres + Qdrant")
    ap.add_argument("--posts", type=int, default=12000)
    ap.add_argument("--users", type=int, default=300)
    ap.add_argument("--fresh", action="store_true", help="wipe test tables first")
    ap.add_argument("--no-likes", dest="likes", action="store_false")
    ap.add_argument("--no-comments", dest="comments", action="store_false")
    ap.add_argument("--batch", type=int, default=256, help="embedding batch size")
    ap.add_argument("--fake-vectors", action="store_true",
                    help="skip the embedding model; generate synthetic clustered "
                         "vectors. MUCH faster — use this for scale testing (millions).")
    args = ap.parse_args()

    db = SessionLocal()
    try:
        if args.fresh:
            truncate_test_data(db)

        # Offset numbering by existing users so repeated runs don't collide.
        base = db.query(User).count()
        print(f"Seeding {args.users} users + {args.posts} posts "
              f"(existing users: {base}) ...")

        # --- Users (reuse one bcrypt hash for all seed accounts: fast) --------
        shared_hash = hash_password("password123")
        now = datetime.utcnow()
        user_rows, user_ids = [], []
        for i in range(args.users):
            n = base + i + 1
            uid = str(uuid.uuid4())
            user_ids.append((uid, f"seeduser{n}"))
            user_rows.append(dict(
                id=uid, username=f"seeduser{n}", email=f"seeduser{n}@example.com",
                password_hash=shared_hash, avatar_url=None,
                created_at=now, updated_at=now,
            ))
        db.bulk_insert_mappings(User, user_rows)
        db.commit()
        print(f"  ✓ {len(user_rows)} users")

        # --- Posts + POVs (build in memory, then batch-embed + bulk insert) ---
        post_rows, pov_rows, qdrant_meta, texts, post_clusters = [], [], [], [], []
        for _ in range(args.posts):
            uid, uname = random.choice(user_ids)
            cluster = random.choice(CLUSTER_NAMES)
            body, povs = make_post_text(cluster)
            pid = str(uuid.uuid4())
            created = now - timedelta(
                days=random.randint(0, 60), minutes=random.randint(0, 1440))
            post_rows.append(dict(
                id=pid, user_id=uid, username=uname, text=body,
                created_at=created, updated_at=created))
            for p in povs:
                pov_rows.append(dict(
                    id=str(uuid.uuid4()), post_id=pid, pov=p,
                    is_auto=False, created_at=created))
            texts.append(body)
            post_clusters.append(cluster)
            qdrant_meta.append((pid, uid, povs, int(created.timestamp())))

        if args.fake_vectors:
            # Synthetic vectors with per-cluster centroids, so search still
            # returns topically coherent results without running the model.
            print(f"  • Generating {len(texts)} SYNTHETIC vectors (--fake-vectors) ...")
            rng = np.random.default_rng(42)
            centroids = {c: _normalize(rng.standard_normal(VECTOR_SIZE))
                         for c in CLUSTER_NAMES}
            idx = {c: i for i, c in enumerate(CLUSTER_NAMES)}
            cmat = np.stack([centroids[c] for c in CLUSTER_NAMES])
            cluster_ids = np.fromiter((idx[c] for c in post_clusters), dtype=np.int64)
            noise = rng.standard_normal((len(texts), VECTOR_SIZE)).astype(np.float32)
            vectors = cmat[cluster_ids] + 0.55 * noise
            vectors /= np.linalg.norm(vectors, axis=1, keepdims=True)
        else:
            print(f"  • Encoding {len(texts)} embeddings (batch={args.batch}) ...")
            embedding_service._ensure_initialized()
            vectors = embedding_service._model.encode(
                texts, batch_size=args.batch, show_progress_bar=True,
                convert_to_numpy=True)

        print("  • Bulk inserting posts + POVs into Postgres ...")
        for i in range(0, len(post_rows), 2000):
            db.bulk_insert_mappings(Post, post_rows[i:i + 2000])
            db.commit()
        for i in range(0, len(pov_rows), 5000):
            db.bulk_insert_mappings(POV, pov_rows[i:i + 5000])
            db.commit()
        print(f"  ✓ {len(post_rows)} posts, {len(pov_rows)} POVs")

        print("  • Upserting vectors into Qdrant ...")
        CHUNK = 1000
        for i in range(0, len(qdrant_meta), CHUNK):
            points = []
            for (pid, uid, povs, epoch), vec in zip(
                    qdrant_meta[i:i + CHUNK], vectors[i:i + CHUNK]):
                points.append(PointStruct(
                    id=pid, vector=vec.tolist(),
                    payload={"post_id": pid, "user_id": uid,
                             "tags": povs, "created_at": epoch}))
            qdrant_service.client.upsert(collection_name=COLLECTION_NAME, points=points)
            print(f"    {min(i + CHUNK, len(qdrant_meta))}/{len(qdrant_meta)}")
        print(f"  ✓ {len(qdrant_meta)} vectors in Qdrant")

        # --- Optional likes / comments ---------------------------------------
        if args.likes:
            like_rows, seen = [], set()
            for pid, _, _, _ in qdrant_meta:
                for _ in range(random.randint(0, 6)):
                    liker = random.choice(user_ids)[0]
                    if (pid, liker) in seen:
                        continue
                    seen.add((pid, liker))
                    like_rows.append(dict(id=str(uuid.uuid4()), post_id=pid,
                                          user_id=liker, created_at=now))
            for i in range(0, len(like_rows), 5000):
                db.bulk_insert_mappings(Like, like_rows[i:i + 5000])
                db.commit()
            print(f"  ✓ {len(like_rows)} likes")

        if args.comments:
            comment_rows = []
            for pid, _, _, _ in qdrant_meta:
                for _ in range(random.randint(0, 3)):
                    comment_rows.append(dict(
                        id=str(uuid.uuid4()), post_id=pid,
                        user_id=random.choice(user_ids)[0],
                        text=random.choice(COMMENT_TEXTS), created_at=now))
            for i in range(0, len(comment_rows), 5000):
                db.bulk_insert_mappings(Comment, comment_rows[i:i + 5000])
                db.commit()
            print(f"  ✓ {len(comment_rows)} comments")

        print("\n✅ Seed complete.")
        print(f"   Login with any of: seeduser{base + 1}@example.com .. "
              f"seeduser{base + args.users}@example.com")
        print("   Password: password123")
    finally:
        db.close()


if __name__ == "__main__":
    main()
