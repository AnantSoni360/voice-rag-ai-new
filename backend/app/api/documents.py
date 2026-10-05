"""
Document ingestion API — upload, index, list, delete.
"""
import os
import uuid
import logging
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import aiofiles

from app.core.config import settings
from app.core.database import get_db
from app.models.models import Document
from app.services.ingestion import ingest_document
from app.services.chroma_client import collection_count, delete_document_chunks

logger = logging.getLogger(__name__)
router = APIRouter()


# ─── List documents ──────────────────────────────────────────────────────────
@router.get("/")
async def list_documents(db: AsyncSession = Depends(get_db)):
    """Return all documents with current indexing status."""
    result = await db.execute(select(Document).order_by(Document.created_at.desc()))
    docs = result.scalars().all()
    return [
        {
            "id": d.id,
            "name": d.name,
            "original_filename": d.original_filename,
            "size_bytes": d.file_size_bytes,
            "content_type": d.content_type,
            "page_count": d.page_count,
            "chunk_count": d.chunk_count,
            "status": d.status,
            "error": d.error_message,
            "uploaded_at": d.created_at.isoformat(),
        }
        for d in docs
    ]


# ─── Upload and ingest ───────────────────────────────────────────────────────
@router.post("/upload", status_code=202)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload a PDF or TXT document.
    Returns immediately with status 'indexing'.
    Ingestion pipeline runs in the background.
    """
    # Validate content type
    allowed_types = {"application/pdf", "text/plain"}
    ct = file.content_type or ""
    ext = Path(file.filename or "").suffix.lower()
    if ct not in allowed_types and ext not in {".pdf", ".txt"}:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported file type '{ct}'. Supported: PDF, TXT.",
        )

    # Read and validate size
    content = await file.read()
    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({len(content) // 1024 // 1024} MB). Max: {settings.max_upload_size_mb} MB.",
        )

    # Save to disk
    os.makedirs(settings.upload_dir, exist_ok=True)
    doc_id = str(uuid.uuid4())
    filename = file.filename or f"document_{doc_id}.txt"
    safe_name = filename.replace(" ", "_").replace("/", "_")
    file_path = os.path.join(settings.upload_dir, f"{doc_id}_{safe_name}")

    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)

    # Create DB record
    doc = Document(
        id=doc_id,
        name=Path(filename).stem,
        original_filename=filename,
        file_path=file_path,
        file_size_bytes=len(content),
        content_type=ct or ("application/pdf" if ext ==
                            ".pdf" else "text/plain"),
        status="indexing",
        chroma_collection=settings.chroma_collection,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    # Background ingestion
    background_tasks.add_task(
        _run_ingestion, doc_id, file_path, doc.name, doc.content_type
    )

    logger.info("Document upload received: %s (%d bytes)",
                filename, len(content))
    return {
        "id": doc_id,
        "name": doc.name,
        "status": "indexing",
        "message": "Document uploaded. Indexing started in the background.",
    }


async def _run_ingestion(doc_id: str, file_path: str, name: str, content_type: str):
    """Background task wrapper for document ingestion."""
    from app.core.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        await ingest_document(doc_id, file_path, name, content_type, db)


# ─── Get single document ─────────────────────────────────────────────────────
@router.get("/{doc_id}")
async def get_document(doc_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Document).where(Document.id == doc_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    return {
        "id": doc.id,
        "name": doc.name,
        "status": doc.status,
        "chunk_count": doc.chunk_count,
        "page_count": doc.page_count,
        "error": doc.error_message,
    }


# ─── Delete document ─────────────────────────────────────────────────────────
@router.delete("/{doc_id}", status_code=204)
async def delete_document(doc_id: str, db: AsyncSession = Depends(get_db)):
    """Delete document from DB and remove all its chunks from ChromaDB."""
    result = await db.execute(select(Document).where(Document.id == doc_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    # Remove vectors
    deleted = delete_document_chunks(doc_id)
    logger.info("Deleted %d chunks from ChromaDB for document %s",
                deleted, doc_id)

    # Remove file
    if doc.file_path and os.path.exists(doc.file_path):
        os.remove(doc.file_path)

    await db.delete(doc)
    await db.commit()


# ─── Collection stats ─────────────────────────────────────────────────────────
@router.get("/stats/collection")
async def collection_stats(db: AsyncSession = Depends(get_db)):
    """Return ChromaDB collection statistics."""
    total_chunks = collection_count()
    result = await db.execute(select(Document))
    docs = result.scalars().all()
    return {
        "total_chunks_in_chroma": total_chunks,
        "total_documents": len(docs),
        "indexed": sum(1 for d in docs if d.status == "indexed"),
        "indexing": sum(1 for d in docs if d.status == "indexing"),
        "failed": sum(1 for d in docs if d.status == "failed"),
    }
