"""
Multilingual embedding service using sentence-transformers.
Model: paraphrase-multilingual-MiniLM-L12-v2
Supports: Hindi, English, and code-switching.
GPU-accelerated when EMBEDDING_DEVICE=cuda.
"""
from __future__ import annotations
import logging
from functools import lru_cache
from sentence_transformers import SentenceTransformer
from app.core.config import settings

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _load_model() -> SentenceTransformer:
    """Load the model once and cache it in memory."""
    logger.info(
        "Loading embedding model: %s on device: %s",
        settings.embedding_model,
        settings.embedding_device,
    )
    model = SentenceTransformer(
        settings.embedding_model,
        device=settings.embedding_device,
    )
    logger.info("Embedding model loaded. Dimension: %d",
                model.get_sentence_embedding_dimension())
    return model


def get_embedding(text: str) -> list[float]:
    """
    Generate a single embedding vector for a text string.
    Works for Hindi, English, and mixed input.
    """
    model = _load_model()
    embedding = model.encode(text, normalize_embeddings=True)
    return embedding.tolist()


def get_embeddings(texts: list[str], batch_size: int = 64) -> list[list[float]]:
    """
    Generate embeddings for a list of texts in batches.
    Returns a list of float lists (one per input text).
    """
    model = _load_model()
    embeddings = model.encode(
        texts,
        batch_size=batch_size,
        normalize_embeddings=True,
        show_progress_bar=len(texts) > 100,
    )
    return embeddings.tolist()


def embedding_dimension() -> int:
    """Return the dimension of the embedding vectors."""
    return _load_model().get_sentence_embedding_dimension()
