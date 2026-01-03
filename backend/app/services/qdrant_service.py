import os
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct, Distance, VectorParams, Filter, FieldCondition, MatchValue
from typing import List, Dict, Optional, Any
import uuid

# Configuration
# For local development: QDRANT_HOST=localhost, QDRANT_PORT=6333
# For Qdrant Cloud: QDRANT_URL=https://xxx.qdrant.io, QDRANT_API_KEY=xxx
QDRANT_HOST = os.getenv("QDRANT_HOST", "localhost")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", 6333))
QDRANT_URL = os.getenv("QDRANT_URL")  # For Qdrant Cloud (e.g., https://xxx.qdrant.io)
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")  # For Qdrant Cloud
COLLECTION_NAME = "posts"
VECTOR_SIZE = 384  # Matches all-MiniLM-L6-v2

class QdrantService:
    def __init__(self):
        # Support both local Qdrant and Qdrant Cloud
        if QDRANT_URL:
            # Qdrant Cloud
            self.client = QdrantClient(
                url=QDRANT_URL,
                api_key=QDRANT_API_KEY,
            )
        else:
            # Local Qdrant
            self.client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)
        self._ensure_collection()

    def _ensure_collection(self):
        collections = self.client.get_collections()
        exists = any(c.name == COLLECTION_NAME for c in collections.collections)
        
        if not exists:
            self.client.create_collection(
                collection_name=COLLECTION_NAME,
                vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
            )

    def upsert_post(self, vector: List[float], post_id: str, user_id: Optional[str] = None, 
                    tags: Optional[List[str]] = None, created_at: Optional[int] = None):
        """
        Upsert a post vector to Qdrant.
        
        Qdrant = System of Search (検索・推薦のための近似インデックス)
        Only stores minimal information needed for filtering and search:
        - vector: embedding vector (required)
        - post_id: reference to PostgreSQL post (required)
        - user_id: for filtering (e.g., block user's posts)
        - tags: for tag-based filtering (lightweight, normalized)
        - created_at: for time-based filtering (epoch timestamp)
        
        Note: Full text, author details, likes count, etc. are stored in PostgreSQL (System of Record).
        """
        payload = {
            "post_id": post_id,
        }
        if user_id:
            payload["user_id"] = user_id
        if tags:
            payload["tags"] = tags  # For tag filtering in Qdrant
        if created_at:
            payload["created_at"] = created_at  # Epoch timestamp for time filtering
        
        self.client.upsert(
            collection_name=COLLECTION_NAME,
            points=[
                PointStruct(
                    id=post_id,
                    vector=vector,
                    payload=payload
                )
            ]
        )
        return post_id

    def get_user_posts(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Get all post vectors by a specific user from Qdrant.
        Returns list of points with vectors for similarity comparison.
        """
        from qdrant_client.models import ScrollRequest, Filter, FieldCondition, MatchValue
        
        query_filter = Filter(
            must=[
                FieldCondition(key="user_id", match=MatchValue(value=user_id))
            ]
        )
        
        scroll_result = self.client.scroll(
            collection_name=COLLECTION_NAME,
            scroll_filter=query_filter,
            limit=100,  # Get up to 100 user posts
            with_payload=True,
            with_vectors=True,
        )
        
        return scroll_result[0] if scroll_result else []  # Returns list of points

    def search_similar(self, vector: List[float], limit: int = 10, required_tags: Optional[List[str]] = None):
        """
        Search for similar posts using vector similarity.
        Optional tag filtering using payload tags.
        
        This is the "candidate generation" step (System of Search).
        Full filtering and ranking should be done in PostgreSQL (System of Record).
        """
        query_filter = None
        if required_tags:
            # Simple OR logic for tags: if post has ANY of the required tags
            # Tags are stored in payload for fast filtering
            # (Adjust logic based on requirements: AND vs OR)
            conditions = [
                FieldCondition(key="tags", match=MatchValue(value=tag))
                for tag in required_tags
            ]
            if conditions:
                query_filter = Filter(should=conditions)

        hits = self.client.search(
            collection_name=COLLECTION_NAME,
            query_vector=vector,
            query_filter=query_filter,
            limit=limit
        )
        return hits

    def search_by_tags(self, tags: List[str], limit: int = 20):
        """
        Search posts by tags only (no vector similarity).
        Note: This is now handled in PostgreSQL, but kept for backward compatibility.
        Returns empty list - use PostgreSQL for tag-based search.
        """
        # Tag search is now done in PostgreSQL for better performance
        # This method is kept for backward compatibility but returns empty
        return []

# Singleton
qdrant_service = QdrantService()
