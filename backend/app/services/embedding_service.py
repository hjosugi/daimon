from sentence_transformers import SentenceTransformer
from typing import List
import asyncio
from concurrent.futures import ThreadPoolExecutor

class EmbeddingService:
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        self.model = SentenceTransformer(model_name)
        self.executor = ThreadPoolExecutor(max_workers=2)

    async def embed_text_async(self, text: str) -> List[float]:
        loop = asyncio.get_event_loop()
        embedding = await loop.run_in_executor(
            self.executor,
            self.model.encode,
            text
        )
        return embedding.tolist()

embedding_service = EmbeddingService()
