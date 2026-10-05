"""
Script: Ingest all 10 sample Nexus CRM documents into ChromaDB.
Run from the backend/ directory:
    python -X utf8 scripts/ingest_sample_docs.py
"""
import sys
import os

# Force UTF-8 on Windows to avoid cp1252 errors
os.environ["PYTHONIOENCODING"] = "utf-8"
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# Add backend root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from data.sample_docs_content import SAMPLE_DOCUMENTS
from app.services.ingestion import chunk_text, extract_text
from app.services.embeddings import get_embeddings
from app.services.chroma_client import upsert_chunks, collection_count
from app.core.config import settings


def ingest_sample_docs():
    """Write sample docs to disk and ingest into ChromaDB synchronously."""
    print("\n[START] Nexus CRM -- Sample Document Ingestion")
    print("=" * 60)

    os.makedirs("./data/sample_docs", exist_ok=True)
    os.makedirs(settings.chroma_persist_dir, exist_ok=True)

    total_chunks = 0

    for filename, content in SAMPLE_DOCUMENTS.items():
        file_path = f"./data/sample_docs/{filename}"
        doc_name = filename.replace(".txt", "").replace("_", " ").title()

        # Write .txt file with UTF-8
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content.strip())

        print(f"\n[DOC] {filename}")

        # Extract text
        text, pages = extract_text(file_path, "text/plain")
        print(f"   -> {len(text)} chars, ~{pages} pages")

        # Chunk
        chunks = chunk_text(
            text,
            chunk_size=settings.chunk_size,
            overlap=settings.chunk_overlap,
            document_name=doc_name,
        )
        print(f"   -> {len(chunks)} chunks")

        # Embed
        print("   -> Embedding...", end="", flush=True)
        texts = [c["text"] for c in chunks]
        embeddings = get_embeddings(texts)
        print(" OK")

        # Store in ChromaDB
        doc_id = f"sample_{filename.replace('.txt', '')}"
        ids = [f"{doc_id}_chunk_{c['chunk_index']}" for c in chunks]
        metadatas = [
            {
                "document_id": doc_id,
                "document_name": doc_name,
                "chunk_index": c["chunk_index"],
                "source": c["source"],
                "section_hint": c["section_hint"],
            }
            for c in chunks
        ]
        upsert_chunks(ids=ids, embeddings=embeddings, documents=texts, metadatas=metadatas)
        total_chunks += len(chunks)
        print("   -> ChromaDB [OK]")

    print("\n" + "=" * 60)
    print(f"[DONE] {len(SAMPLE_DOCUMENTS)} documents | {total_chunks} total chunks | collection={settings.chroma_collection}")
    print(f"ChromaDB total: {collection_count()}")
    print("\nTest with: POST http://localhost:8000/api/voice/chat")
    print('Body: {"message": "Nexus CRM ki pricing kya hai?", "language": "hi-en"}')


if __name__ == "__main__":
    ingest_sample_docs()
