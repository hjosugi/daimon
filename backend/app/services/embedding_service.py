from sentence_transformers import SentenceTransformer
from typing import List, Optional
import asyncio
import os
from concurrent.futures import ThreadPoolExecutor
from app.logger import logger

class EmbeddingService:
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        self.model_name = model_name
        self.device = os.getenv("EMBEDDING_DEVICE", "cpu")
        self._model: Optional[SentenceTransformer] = None
        self.executor = ThreadPoolExecutor(max_workers=2)
        self._initialized = False

    def _ensure_initialized(self):
        if not self._initialized:
            logger.info(f"Initializing EmbeddingService with model '{self.model_name}' on device '{self.device}'")
            self._model = SentenceTransformer(self.model_name, device=self.device)
            self._initialized = True
            logger.info(f"EmbeddingService initialized successfully (device: {self.device})")

    async def embed_text_async(self, text: str) -> List[float]:
        self._ensure_initialized()
        loop = asyncio.get_event_loop()
        embedding = await loop.run_in_executor(
            self.executor,
            self._model.encode,
            text
        )
        return embedding.tolist()

embedding_service = EmbeddingService()
