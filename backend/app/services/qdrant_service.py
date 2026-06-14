import os
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct, Distance, VectorParams, Filter, FieldCondition, MatchValue
from typing import List, Dict, Optional, Any

QDRANT_HOST = os.getenv("QDRANT_HOST", "localhost")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", 6333))
QDRANT_URL = os.getenv("QDRANT_URL")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")
COLLECTION_NAME = "posts"
VECTOR_SIZE = 384

class QdrantService:
    def __init__(self):
        self._client = None
        self._initialized = False

    @property
    def client(self):
        if self._client is None:
            if QDRANT_URL:
                self._client = QdrantClient(
                    url=QDRANT_URL,
                    api_key=QDRANT_API_KEY,
                )
            else:
                self._client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)
            if not self._initialized:
                self._ensure_collection()
                self._initialized = True
        return self._client

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
        payload = {
            "post_id": post_id,
        }
        if user_id:
            payload["user_id"] = user_id
        if tags:
            payload["tags"] = tags
        if created_at:
            payload["created_at"] = created_at
        
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
        try:
            query_filter = Filter(
                must=[
                    FieldCondition(key="user_id", match=MatchValue(value=user_id))
                ]
            )
            
            scroll_result = self.client.scroll(
                collection_name=COLLECTION_NAME,
                scroll_filter=query_filter,
                limit=100,
                with_payload=True,
                with_vectors=True,
            )
            
            return scroll_result[0] if scroll_result else []
        except Exception as e:
            # Log error and return empty list if Qdrant is unavailable
            import logging
            logger = logging.getLogger("daimon")
            logger.warning(f"Qdrant get_user_posts failed: {e}")
            return []

    def search_similar(self, vector: List[float], limit: int = 10, required_tags: Optional[List[str]] = None,
                       with_vectors: bool = False):
        try:
            query_filter = None
            if required_tags:
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
                limit=limit,
                # Return vectors inline so callers avoid a per-result retrieve() round-trip.
                with_vectors=with_vectors,
            )
            return hits
        except Exception as e:
            # Log error and re-raise to be handled by caller
            import logging
            logger = logging.getLogger("daimon")
            logger.error(f"Qdrant search_similar failed: {e}", exc_info=True)
            raise

qdrant_service = QdrantService()
