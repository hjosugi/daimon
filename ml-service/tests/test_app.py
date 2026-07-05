import time
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import pytest
from fastapi.testclient import TestClient

import app as mlapp


@pytest.fixture(autouse=True)
def reset_model_state(monkeypatch):
    monkeypatch.setattr(mlapp, "_model", None)
    monkeypatch.setattr(mlapp, "_nlp_cache", {})


def vector(value: float = 0.0) -> list[float]:
    return [value] * mlapp.EMBED_DIM


def test_chunks_preserve_empty_and_bound_long_text():
    assert mlapp._chunks("") == [""]

    text = "x" * (mlapp.CHUNK_CHARS * (mlapp.MAX_CHUNKS + 2))
    chunks = mlapp._chunks(text)
    assert len(chunks) == mlapp.MAX_CHUNKS
    assert all(len(chunk) <= mlapp.CHUNK_CHARS for chunk in chunks)


def test_detect_language():
    assert mlapp.detect_language("これは日本語です") == "ja"
    assert mlapp.detect_language("plain english text") == "en"


def test_fallback_extracts_language_specific_phrases():
    assert mlapp._fallback("価値観と検索", "ja") == ["価値観と検索"]
    assert mlapp._fallback("first idea. second idea", "en") == [
        "first idea",
        "second idea",
    ]


def test_encode_many_preserves_input_count(monkeypatch):
    class FakeModel:
        def encode(self, texts, convert_to_numpy, batch_size):
            assert convert_to_numpy is True
            assert batch_size == mlapp.ENCODE_BATCH_SIZE
            return np.array(
                [[float(i)] * mlapp.EMBED_DIM for i, _ in enumerate(texts)],
                dtype=float,
            )

    monkeypatch.setattr(mlapp, "model", lambda: FakeModel())

    out = mlapp.encode_many(["", "hello", "x" * (mlapp.CHUNK_CHARS + 1)])
    assert len(out) == 3
    assert all(len(item) == mlapp.EMBED_DIM for item in out)


def test_model_load_is_locked(monkeypatch):
    calls = 0

    class FakeSentenceTransformer:
        def __init__(self, name, device):
            nonlocal calls
            assert name == mlapp.EMBED_MODEL
            assert device == "cpu"
            time.sleep(0.01)
            calls += 1
            self.max_seq_length = None

    monkeypatch.setattr(mlapp, "SentenceTransformer", FakeSentenceTransformer)

    with ThreadPoolExecutor(max_workers=8) as pool:
        models = list(pool.map(lambda _: mlapp.model(), range(8)))

    assert calls == 1
    assert len({id(item) for item in models}) == 1
    assert models[0].max_seq_length == mlapp.MAX_SEQ_LEN


def test_nlp_load_is_locked(monkeypatch):
    import spacy

    calls = 0
    loaded = object()

    def fake_load(name):
        nonlocal calls
        assert name == "ja_core_news_sm"
        time.sleep(0.01)
        calls += 1
        return loaded

    monkeypatch.setattr(spacy, "load", fake_load)

    with ThreadPoolExecutor(max_workers=8) as pool:
        models = list(pool.map(lambda _: mlapp._nlp("ja"), range(8)))

    assert calls == 1
    assert models == [loaded] * 8


def test_health_reports_not_ready_until_models_loaded(monkeypatch):
    client = TestClient(mlapp.app)

    not_ready = client.get("/health")
    assert not_ready.status_code == 503
    assert not_ready.json()["status"] == "not_ready"

    monkeypatch.setattr(mlapp, "_model", object())
    monkeypatch.setattr(
        mlapp,
        "_nlp_cache",
        {
            "ja_core_news_sm": object(),
            "en_core_web_sm": object(),
        },
    )

    ready = client.get("/health")
    assert ready.status_code == 200
    assert ready.json()["ready"] is True


def test_embed_endpoint_contract(monkeypatch):
    monkeypatch.setattr(mlapp, "encode_full", lambda text: vector(1.0))
    client = TestClient(mlapp.app)

    response = client.post("/embed", json={"text": "hello"})
    assert response.status_code == 200
    assert len(response.json()["vector"]) == mlapp.EMBED_DIM


def test_embed_endpoint_returns_structured_error(monkeypatch):
    def fail(text):
        raise RuntimeError("model unavailable")

    monkeypatch.setattr(mlapp, "encode_full", fail)
    client = TestClient(mlapp.app)

    response = client.post("/embed", json={"text": "hello"})
    assert response.status_code == 503
    assert response.json()["detail"]["error"] == "embedding_failed"
    assert "model unavailable" in response.json()["detail"]["message"]


def test_embed_batch_rejects_count_mismatch(monkeypatch):
    monkeypatch.setattr(mlapp, "encode_many", lambda texts: [vector()])
    client = TestClient(mlapp.app)

    response = client.post("/embed_batch", json={"texts": ["a", "b"]})
    assert response.status_code == 503
    assert response.json()["detail"]["error"] == "embedding_failed"
    assert "count mismatch" in response.json()["detail"]["message"]


def test_povs_deduplicates_and_caps(monkeypatch):
    monkeypatch.setattr(
        mlapp,
        "extract_phrases",
        lambda text, lang: [
            "Alpha",
            "alpha",
            "Beta",
            "Gamma",
            "Delta",
            "Epsilon",
            "Zeta",
        ],
    )
    client = TestClient(mlapp.app)

    response = client.post("/povs", json={"text": "english text"})
    assert response.status_code == 200
    assert response.json()["povs"] == [
        "Alpha",
        "Beta",
        "Gamma",
        "Delta",
        "Epsilon",
    ]
