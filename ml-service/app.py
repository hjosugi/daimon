"""
Daimon ML microservice

Exposes the two things Go can't do well: text embeddings (sentence-transformers)
and POV phrase extraction (spaCy). Everything else lives in the Go API.

    POST /embed  {"text": "..."}          -> {"vector": [...384 floats...]}
    POST /povs   {"text": "..."}          -> {"povs": [...]}
    GET  /health                          -> {"status": "ok"}
"""
from __future__ import annotations

import re
from contextlib import asynccontextmanager
from importlib.util import find_spec

from fastapi import FastAPI
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

# Multilingual (50+ languages incl. Japanese). all-MiniLM-L6-v2 is English-only
# and maps Japanese to near-degenerate vectors, so JA search was meaningless.
# This model is also 384-dim, so Qdrant needs no schema change — but every post
# must be RE-EMBEDDED (re-seed) after a model swap or query/post vectors won't align.
EMBED_MODEL = "paraphrase-multilingual-MiniLM-L12-v2"
EMBED_DIM = 384

_model: SentenceTransformer | None = None
_nlp_cache: dict[str, object] = {}


# Long posts (up to 40k chars) must be embedded as a WHOLE, not just their first
# ~128 tokens. We raise the per-chunk window and mean-pool over chunks so a deep
# post's full meaning is represented in its single 384-d vector.
MAX_SEQ_LEN = 512
CHUNK_CHARS = 1200  # ~one 512-token window of mixed JA/EN text
MAX_CHUNKS = 48     # bound cost: covers ~57k chars, beyond the 40k post cap
ENCODE_BATCH_SIZE = 32


def model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer(EMBED_MODEL, device="cpu")
        _model.max_seq_length = MAX_SEQ_LEN
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
    return out


@asynccontextmanager
async def lifespan(app: FastAPI):
    model()  # warm the model at startup so the first request is fast
    yield


app = FastAPI(title="daimon-ml", lifespan=lifespan)


class TextReq(BaseModel):
    text: str


@app.get("/health")
def health():
    return {
        "status": "ok",
        "embedding_model": EMBED_MODEL,
        "embedding_dim": EMBED_DIM,
        "max_seq_len": MAX_SEQ_LEN,
        "chunk_chars": CHUNK_CHARS,
        "max_chunks": MAX_CHUNKS,
        "spacy_models": {
            "ja": find_spec("ja_core_news_sm") is not None,
            "en": find_spec("en_core_web_sm") is not None,
        },
    }


@app.post("/embed")
def embed(req: TextReq):
    return {"vector": encode_full(req.text or "")}


class BatchReq(BaseModel):
    texts: list[str]


@app.post("/embed_batch")
def embed_batch(req: BatchReq):
    # Used by the Go seed command: many full-post embeddings in one round-trip.
    return {"vectors": encode_many(req.texts or [])}


# --- POV extraction (spaCy ja/en, with a regex fallback) -------------------

_JA = re.compile(r"[぀-ゟ゠-ヿ一-龯]")


def detect_language(text: str) -> str:
    return "ja" if _JA.search(text) else "en"


def _nlp(language: str):
    name = "ja_core_news_sm" if language == "ja" else "en_core_web_sm"
    if name not in _nlp_cache:
        import spacy

        try:
            _nlp_cache[name] = spacy.load(name)
        except OSError:
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
    lang = detect_language(text)
    seen: set[str] = set()
    out: list[str] = []
    for p in extract_phrases(text, lang):
        key = p.lower() if lang == "en" else p
        if key not in seen and len(p) <= 300:
            seen.add(key)
            out.append(p)
    return {"povs": out[:5]}
