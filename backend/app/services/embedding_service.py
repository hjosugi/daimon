from sentence_transformers import SentenceTransformer
from typing import List
import asyncio
import os
from concurrent.futures import ThreadPoolExecutor
from app.logger import logger

class EmbeddingService:
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        device = os.getenv("EMBEDDING_DEVICE", "cpu")
        logger.info(f"Initializing EmbeddingService with model '{model_name}' on device '{device}'")
        self.model = SentenceTransformer(model_name, device=device)
        self.executor = ThreadPoolExecutor(max_workers=2)
        logger.info(f"EmbeddingService initialized successfully (device: {device})")

    async def embed_text_async(self, text: str) -> List[float]:
        loop = asyncio.get_event_loop()
        embedding = await loop.run_in_executor(
            self.executor,
            self.model.encode,
            text
        )
        return embedding.tolist()

embedding_service = EmbeddingService()
