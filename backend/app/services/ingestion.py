"""
Document ingestion pipeline for Voice RAG AI.

Flow:
  upload → validate → extract text → chunk → embed → store in ChromaDB → update DB
"""
from __future__ import annotations
import re
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

# ─── optional PDF support ─────────────────────────────────────────────────────
try:
    import fitz  # PyMuPDF
    HAS_PYMUPDF = True
except ImportError:
    HAS_PYMUPDF = False
    logger.warning(
        "PyMuPDF not installed — PDF support disabled. TXT files only.")


# ═══════════════════════════════════════════════════════
# TEXT EXTRACTION
# ═══════════════════════════════════════════════════════

def extract_text_from_pdf(file_path: str) -> tuple[str, int]:
    """Extract text from a PDF using PyMuPDF. Returns (text, page_count)."""
    if not HAS_PYMUPDF:
        raise RuntimeError(
            "PyMuPDF is not installed. Run: pip install pymupdf")
    doc = fitz.open(file_path)
    pages = []
    for page in doc:
        text = page.get_text("text")
        if text.strip():
            pages.append(f"[Page {page.number + 1}]\n{text}")
    doc.close()
    return "\n\n".join(pages), len(pages)


def extract_text_from_txt(file_path: str) -> tuple[str, int]:
    """Read a plain text file. Returns (text, estimated_pages)."""
    with open(file_path, encoding="utf-8", errors="replace") as f:
        text = f.read()
    estimated_pages = max(1, len(text) // 3000)
    return text, estimated_pages


def extract_text(file_path: str, content_type: str) -> tuple[str, int]:
    """Auto-detect format and extract text. Returns (text, page_count)."""
    ext = Path(file_path).suffix.lower()
    if ext == ".pdf" or content_type == "application/pdf":
        return extract_text_from_pdf(file_path)
    return extract_text_from_txt(file_path)


# ═══════════════════════════════════════════════════════
# CHUNKING
# ═══════════════════════════════════════════════════════

def _split_sentences(text: str) -> list[str]:
    """Split text on sentence boundaries (handles Hindi and English)."""
    sentences = re.split(r'(?<=[.!?।\n])\s+', text)
    return [s.strip() for s in sentences if s.strip()]


def chunk_text(
    text: str,
    chunk_size: int = 512,
    overlap: int = 64,
    document_name: str = "",
) -> list[dict]:
    """
    Split text into overlapping chunks of approximately chunk_size characters.

    Each chunk dict has:
      - text: the chunk content
      - chunk_index: sequential index
      - source: document name
      - section_hint: first heading-like line in the chunk
    """
    sentences = _split_sentences(text)
    chunks: list[dict] = []
    current: list[str] = []
    current_len = 0
    chunk_idx = 0

    for sentence in sentences:
        sent_len = len(sentence)
        if current_len + sent_len > chunk_size and current:
            chunk_text_str = " ".join(current)
            # find section hint (first ALL CAPS line or heading)
            hint = next(
                (ln.strip()
                 for ln in chunk_text_str.split("\n") if ln.strip().isupper()),
                document_name,
            )
            chunks.append({
                "text": chunk_text_str,
                "chunk_index": chunk_idx,
                "source": document_name,
                "section_hint": hint[:128],
            })
            chunk_idx += 1
            # keep overlap: retain last `overlap` characters worth of sentences
            overlap_sents: list[str] = []
            overlap_len = 0
            for s in reversed(current):
                if overlap_len + len(s) <= overlap:
                    overlap_sents.insert(0, s)
                    overlap_len += len(s)
                else:
                    break
            current = overlap_sents
            current_len = overlap_len

        current.append(sentence)
        current_len += sent_len

    if current:
        chunks.append({
            "text": " ".join(current),
            "chunk_index": chunk_idx,
            "source": document_name,
            "section_hint": document_name,
        })

    return chunks


# ═══════════════════════════════════════════════════════
# FULL INGESTION PIPELINE
# ═══════════════════════════════════════════════════════

async def ingest_document(
    document_id: str,
    file_path: str,
    document_name: str,
    content_type: str,
    db=None,
) -> dict:
    """
    Full ingestion pipeline for one document.
    Saves text chunks + embeddings into ChromaDB.
    Updates document status in Supabase.

    Returns: {"chunks": N, "pages": N, "status": "indexed" | "failed"}
    """
    from app.services.embeddings import get_embeddings
    from app.services.chroma_client import upsert_chunks
    from app.core.config import settings

    try:
        # 1. Extract text
        logger.info("Extracting text from: %s", document_name)
        text, page_count = extract_text(file_path, content_type)
        if not text.strip():
            raise ValueError("No text could be extracted from the document.")

        # 2. Chunk
        logger.info("Chunking document (chunk_size=%d, overlap=%d)",
                    settings.chunk_size, settings.chunk_overlap)
        chunks = chunk_text(
            text,
            chunk_size=settings.chunk_size,
            overlap=settings.chunk_overlap,
            document_name=document_name,
        )
        if not chunks:
            raise ValueError("Chunking produced 0 chunks.")

        # 3. Embed
        logger.info("Embedding %d chunks…", len(chunks))
        texts = [c["text"] for c in chunks]
        embeddings = get_embeddings(texts)

        # 4. Store in ChromaDB
        ids = [f"{document_id}_chunk_{c['chunk_index']}" for c in chunks]
        metadatas = [
            {
                "document_id": document_id,
                "document_name": document_name,
                "chunk_index": c["chunk_index"],
                "source": c["source"],
                "section_hint": c["section_hint"],
            }
            for c in chunks
        ]
        upsert_chunks(ids=ids, embeddings=embeddings,
                      documents=texts, metadatas=metadatas)

        # 5. Update DB status
        if db is not None:
            from app.models.models import Document
            from sqlalchemy import select
            result = await db.execute(select(Document).where(Document.id == document_id))
            doc = result.scalar_one_or_none()
            if doc:
                doc.status = "indexed"
                doc.chunk_count = len(chunks)
                doc.page_count = page_count
                await db.commit()

        logger.info("✅ Ingested '%s': %d chunks, %d pages",
                    document_name, len(chunks), page_count)
        return {"chunks": len(chunks), "pages": page_count, "status": "indexed"}

    except Exception as exc:
        logger.error("❌ Ingestion failed for '%s': %s", document_name, exc)
        if db is not None:
            from app.models.models import Document
            from sqlalchemy import select
            result = await db.execute(select(Document).where(Document.id == document_id))
            doc = result.scalar_one_or_none()
            if doc:
                doc.status = "failed"
                doc.error_message = str(exc)
                await db.commit()
        return {"chunks": 0, "pages": 0, "status": "failed", "error": str(exc)}
