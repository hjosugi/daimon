"""
Daimon ML microservice

Exposes the two things Go can't do well: text embeddings (sentence-transformers)
and POV phrase extraction (spaCy). Everything else lives in the Go API.

    POST /embed  {"text": "..."}          -> {"vector": [...384 floats...]}
    POST /povs   {"text": "..."}          -> {"povs": [...]}
    GET  /health                          -> {"status": "ok"}
"""
from __future__ import annotations

import logging
import os
import re
import time
from contextlib import asynccontextmanager
from importlib.util import find_spec
from threading import Lock
from typing import Annotated

import torch
from fastapi import FastAPI, HTTPException, Request, Response
from pydantic import BaseModel, Field, field_validator
from sentence_transformers import SentenceTransformer

# Multilingual (50+ languages incl. Japanese). all-MiniLM-L6-v2 is English-only
# and maps Japanese to near-degenerate vectors, so JA search was meaningless.
# This model is also 384-dim, so Qdrant needs no schema change — but every post
# must be RE-EMBEDDED (re-seed) after a model swap or query/post vectors won't align.
EMBED_MODEL = "paraphrase-multilingual-MiniLM-L12-v2"
EMBED_DIM = 384

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger("daimon.ml")

_model: SentenceTransformer | None = None
_model_lock = Lock()
_nlp_cache: dict[str, object | None] = {}
_nlp_lock = Lock()
_CACHE_MISS = object()
_SPACY_MODEL_BY_LANG = {
    "ja": "ja_core_news_sm",
    "en": "en_core_web_sm",
}


# Long posts (up to 40k chars) must be embedded as a WHOLE, not just their first
# ~128 tokens. We raise the per-chunk window and mean-pool over chunks so a deep
# post's full meaning is represented in its single 384-d vector.
MAX_SEQ_LEN = 512
CHUNK_CHARS = 1200  # ~one 512-token window of mixed JA/EN text
MAX_CHUNKS = 48     # bound cost: covers ~57k chars, beyond the 40k post cap
ENCODE_BATCH_SIZE = 32
POST_TEXT_MAX_CHARS = 40_000
BATCH_TEXT_MAX_ITEMS = 128
BATCH_TEXT_MAX_TOTAL_CHARS = 256_000
POV_ANALYSIS_CHARS = 8_000

BoundedPostText = Annotated[str, Field(max_length=POST_TEXT_MAX_CHARS)]


def int_env(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        value = int(raw)
    except ValueError:
        logger.warning("invalid integer env %s=%r; using %d", name, raw, default)
        return default
    if value < 1:
        logger.warning("invalid integer env %s=%r; using %d", name, raw, default)
        return default
    return value


TORCH_NUM_THREADS = int_env("DAIMON_TORCH_NUM_THREADS", 1)
TORCH_INTEROP_THREADS = int_env("DAIMON_TORCH_INTEROP_THREADS", 1)


def configure_torch_threads() -> None:
    torch.set_num_threads(TORCH_NUM_THREADS)
    try:
        torch.set_num_interop_threads(TORCH_INTEROP_THREADS)
    except RuntimeError:
        logger.warning("torch interop thread count was already initialized")


configure_torch_threads()


def model() -> SentenceTransformer:
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:
                loaded = SentenceTransformer(EMBED_MODEL, device="cpu")
                loaded.max_seq_length = MAX_SEQ_LEN
                _model = loaded
    return _model


def _chunks(text: str) -> list[str]:
    if len(text) <= CHUNK_CHARS:
        return [text]
    out = [text[i : i + CHUNK_CHARS] for i in range(0, len(text), CHUNK_CHARS)]
    return out[:MAX_CHUNKS]


def encode_full(text: str) -> list[float]:
    """Embed arbitrarily long text by chunking + mean-pooling (cosine-safe)."""
    text = text or ""
    parts = _chunks(text)
    vecs = model().encode(parts, convert_to_numpy=True, batch_size=ENCODE_BATCH_SIZE)
    vec = vecs.mean(axis=0) if len(parts) > 1 else vecs[0]
    return vec.tolist()


def encode_many(texts: list[str]) -> list[list[float]]:
    """Batch embed texts while preserving long-text chunk mean-pooling."""
    if not texts:
        return []

    all_chunks: list[str] = []
    spans: list[tuple[int, int]] = []
    for text in texts:
        parts = _chunks(text or "")
        start = len(all_chunks)
        all_chunks.extend(parts)
        spans.append((start, len(all_chunks)))

    chunk_vecs = model().encode(
        all_chunks,
        convert_to_numpy=True,
        batch_size=ENCODE_BATCH_SIZE,
    )

    out: list[list[float]] = []
    for start, end in spans:
        vecs = chunk_vecs[start:end]
        vec = vecs.mean(axis=0) if len(vecs) > 1 else vecs[0]
        out.append(vec.tolist())
    if len(out) != len(texts):
        raise RuntimeError(f"embedding count mismatch: got {len(out)}, want {len(texts)}")
    return out


@asynccontextmanager
async def lifespan(app: FastAPI):
    model()  # warm the model at startup so the first request is fast
    _nlp("ja")
    _nlp("en")
    yield


app = FastAPI(title="daimon-ml", lifespan=lifespan)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    started = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        duration_ms = (time.perf_counter() - started) * 1000
        logger.exception(
            "request_failed method=%s path=%s duration_ms=%.2f",
            request.method,
            request.url.path,
            duration_ms,
        )
        raise
    duration_ms = (time.perf_counter() - started) * 1000
    logger.info(
        "request_completed method=%s path=%s status=%d duration_ms=%.2f",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response


class TextReq(BaseModel):
    text: BoundedPostText = ""


def readiness_state() -> dict[str, object]:
    spacy_loaded = {
        lang: _nlp_cache.get(name) is not None
        for lang, name in _SPACY_MODEL_BY_LANG.items()
    }
    ready = _model is not None and all(spacy_loaded.values())
    return {
        "ready": ready,
        "embedding_model_loaded": _model is not None,
        "spacy_models_loaded": spacy_loaded,
    }


@app.get("/live")
def live():
    return {"status": "ok"}


@app.get("/health")
def health(response: Response):
    state = readiness_state()
    if not state["ready"]:
        response.status_code = 503
    return {
        "status": "ok" if state["ready"] else "not_ready",
        "embedding_model": EMBED_MODEL,
        "embedding_dim": EMBED_DIM,
        **state,
        "max_seq_len": MAX_SEQ_LEN,
        "chunk_chars": CHUNK_CHARS,
        "max_chunks": MAX_CHUNKS,
        "post_text_max_chars": POST_TEXT_MAX_CHARS,
        "batch_text_max_items": BATCH_TEXT_MAX_ITEMS,
        "batch_text_max_total_chars": BATCH_TEXT_MAX_TOTAL_CHARS,
        "pov_analysis_chars": POV_ANALYSIS_CHARS,
        "spacy_models": {
            "ja": find_spec("ja_core_news_sm") is not None,
            "en": find_spec("en_core_web_sm") is not None,
        },
        "torch_num_threads": TORCH_NUM_THREADS,
        "torch_interop_threads": TORCH_INTEROP_THREADS,
    }


@app.post("/embed")
def embed(req: TextReq):
    try:
        vector = encode_full(req.text or "")
        validate_vector(vector, "embed")
    except Exception as exc:
        raise_inference_error("embedding_failed", exc)
    return {"vector": vector}


class BatchReq(BaseModel):
    texts: list[BoundedPostText] = Field(
        default_factory=list,
        max_length=BATCH_TEXT_MAX_ITEMS,
    )

    @field_validator("texts")
    @classmethod
    def total_chars_within_limit(cls, texts: list[str]) -> list[str]:
        total = sum(len(text or "") for text in texts)
        if total > BATCH_TEXT_MAX_TOTAL_CHARS:
            raise ValueError(
                f"batch text total must be {BATCH_TEXT_MAX_TOTAL_CHARS} characters or less"
            )
        return texts


@app.post("/embed_batch")
def embed_batch(req: BatchReq):
    # Used by the Go seed command: many full-post embeddings in one round-trip.
    texts = req.texts or []
    try:
        vectors = encode_many(texts)
        if len(vectors) != len(texts):
            raise RuntimeError(
                f"embedding count mismatch: got {len(vectors)}, want {len(texts)}"
            )
        for idx, vector in enumerate(vectors):
            validate_vector(vector, f"embed_batch[{idx}]")
    except Exception as exc:
        raise_inference_error("embedding_failed", exc)
    return {"vectors": vectors}


def validate_vector(vector: list[float], context: str) -> None:
    if len(vector) != EMBED_DIM:
        raise RuntimeError(f"{context} vector dimension {len(vector)} != {EMBED_DIM}")


def raise_inference_error(error: str, exc: Exception) -> None:
    logger.exception("%s: %s", error, exc)
    raise HTTPException(
        status_code=503,
        detail={
            "error": error,
            "message": str(exc),
        },
    ) from exc


# --- POV extraction (spaCy ja/en, with a regex fallback) -------------------

_JA = re.compile(r"[぀-ゟ゠-ヿ一-龯]")


def detect_language(text: str) -> str:
    return "ja" if _JA.search(text) else "en"


def _nlp(language: str):
    name = _SPACY_MODEL_BY_LANG["ja" if language == "ja" else "en"]
    cached = _nlp_cache.get(name, _CACHE_MISS)
    if cached is not _CACHE_MISS:
        return cached
    with _nlp_lock:
        cached = _nlp_cache.get(name, _CACHE_MISS)
        if cached is not _CACHE_MISS:
            return cached
        import spacy

        try:
            _nlp_cache[name] = spacy.load(name)
        except OSError:
            logger.exception("spacy_model_load_failed model=%s", name)
            _nlp_cache[name] = None
        return _nlp_cache[name]


def extract_phrases(text: str, language: str) -> list[str]:
    nlp = _nlp(language)
    if nlp is None:
        return _fallback(text, language)
    doc = nlp(text)
    phrases: list[str] = []
    for chunk in doc.noun_chunks:
        if 1 <= len(chunk) <= 10:
            p = chunk.text.strip()
            if 2 <= len(p) <= 300:
                phrases.append(p)
    if language == "ja":
        seq: list[str] = []
        for tok in doc:
            if tok.pos_ in ("NOUN", "PROPN"):
                seq.append(tok.text)
            else:
                if 1 <= len(seq) <= 10:
                    p = "".join(seq)
                    if 2 <= len(p) <= 300:
                        phrases.append(p)
                seq = []
        if 1 <= len(seq) <= 10:
            p = "".join(seq)
            if 2 <= len(p) <= 300:
                phrases.append(p)
    return phrases


def _fallback(text: str, language: str) -> list[str]:
    if language == "ja":
        return [s for s in re.findall(r"[぀-ゟ゠-ヿ一-龯]+", text) if 2 <= len(s) <= 20]
    return [w for w in re.split(r"[.!?]\s+|\s{2,}", text) if 2 <= len(w) <= 60][:10]


@app.post("/povs")
def povs(req: TextReq):
    text = (req.text or "").strip()
    if not text:
        return {"povs": []}
    try:
        analysis_text = text[:POV_ANALYSIS_CHARS]
        lang = detect_language(analysis_text)
        seen: set[str] = set()
        out: list[str] = []
        for p in extract_phrases(analysis_text, lang):
            key = p.lower() if lang == "en" else p
            if key not in seen and len(p) <= 300:
                seen.add(key)
                out.append(p)
    except Exception as exc:
        raise_inference_error("pov_extraction_failed", exc)
    return {"povs": out[:5]}
