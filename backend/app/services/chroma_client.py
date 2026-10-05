"""
ChromaDB vector store client.
Manages the document embedding collection for RAG retrieval.
"""
from __future__ import annotations
import logging
from functools import lru_cache
import chromadb
from chromadb.config import Settings as ChromaSettings
from app.core.config import settings

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def get_chroma_client() -> chromadb.PersistentClient:
    """Return a cached persistent ChromaDB client."""
    logger.info("Initializing ChromaDB at: %s", settings.chroma_persist_dir)
    client = chromadb.PersistentClient(
        path=settings.chroma_persist_dir,
        settings=ChromaSettings(anonymized_telemetry=False),
    )
    return client


def get_collection() -> chromadb.Collection:
    """Get or create the document chunks collection."""
    client = get_chroma_client()
    collection = client.get_or_create_collection(
        name=settings.chroma_collection,
        metadata={"hnsw:space": "cosine"},
    )
    return collection


def upsert_chunks(
    ids: list[str],
    embeddings: list[list[float]],
    documents: list[str],
    metadatas: list[dict],
) -> None:
    """Add or update document chunks in the collection."""
    collection = get_collection()
    collection.upsert(
        ids=ids,
        embeddings=embeddings,
        documents=documents,
        metadatas=metadatas,
    )
    logger.info("Upserted %d chunks into ChromaDB", len(ids))


def query_collection(
    query_embedding: list[float],
    n_results: int = 5,
    where: dict | None = None,
) -> dict:
    """
    Query the vector store with a pre-computed embedding.
    Returns the raw ChromaDB query result dict.
    """
    collection = get_collection()
    kwargs: dict = dict(
        query_embeddings=[query_embedding],
        n_results=min(n_results, collection.count() or 1),
        include=["documents", "metadatas", "distances"],
    )
    if where:
        kwargs["where"] = where
    return collection.query(**kwargs)


def delete_document_chunks(document_id: str) -> int:
    """Delete all chunks belonging to a document. Returns count deleted."""
    collection = get_collection()
    results = collection.get(where={"document_id": document_id}, include=[])
    ids = results.get("ids", [])
    if ids:
        collection.delete(ids=ids)
        logger.info("Deleted %d chunks for document %s", len(ids), document_id)
    return len(ids)


def collection_count() -> int:
    """Return total number of chunks in the collection."""
    return get_collection().count()
