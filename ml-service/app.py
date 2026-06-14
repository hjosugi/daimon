"""
Daimon ML microservice — the ONLY Python in the stack.

Exposes the two things Go can't do well: text embeddings (sentence-transformers)
and POV phrase extraction (spaCy). Everything else lives in the Go API.

    POST /embed  {"text": "..."}          -> {"vector": [...384 floats...]}
    POST /povs   {"text": "..."}          -> {"povs": [...]}
    GET  /health                          -> {"status": "ok"}
"""
from __future__ import annotations

import re
from contextlib import asynccontextmanager

from fastapi import FastAPI
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

_model: SentenceTransformer | None = None
_nlp_cache: dict[str, object] = {}


def model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer("all-MiniLM-L6-v2", device="cpu")
    return _model


@asynccontextmanager
async def lifespan(app: FastAPI):
    model()  # warm the model at startup so the first request is fast
    yield


app = FastAPI(title="daimon-ml", lifespan=lifespan)


class TextReq(BaseModel):
    text: str


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/embed")
def embed(req: TextReq):
    vec = model().encode(req.text or "", convert_to_numpy=True)
    return {"vector": vec.tolist()}


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
