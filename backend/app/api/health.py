import time
from fastapi import APIRouter
from datetime import datetime
from app.core.config import settings

router = APIRouter()

_START_TIME = time.time()


@router.get("/health")
async def health_check():
    """System health — checks each service and returns live status."""

    uptime_seconds = round(time.time() - _START_TIME, 1)

    # Check ChromaDB
    chroma_status = "ok"
    chroma_chunks = 0
    try:
        from app.services.chroma_client import get_collection, collection_count
        get_collection()
        chroma_chunks = collection_count()
    except Exception as e:
        chroma_status = f"error: {str(e)[:80]}"

    # Check Groq
    groq_status = "ok"
    try:
        from groq import Groq
        Groq(api_key=settings.groq_api_key)
    except Exception as e:
        groq_status = f"error: {str(e)[:80]}"

    # Check DB with a real ping
    db_status = "ok"
    try:
        from app.core.database import engine
        import sqlalchemy
        async with engine.connect() as conn:
            await conn.execute(sqlalchemy.text("SELECT 1"))
    except Exception as e:
        db_status = f"error: {str(e)[:80]}"

    # Check Twilio config
    twilio_status = "ok" if settings.twilio_account_sid and settings.twilio_auth_token else "not_configured"

    # Check Cloudinary config
    cloudinary_status = "ok" if settings.cloudinary_cloud_name and settings.cloudinary_api_key else "not_configured"

    # Check Embeddings (cached — fast after first load)
    embedding_status = "ok"
    try:
        from app.services.embeddings import _load_model
        _load_model()
    except Exception as e:
        embedding_status = f"not_loaded: {str(e)[:60]}"

    all_critical_ok = all(s == "ok" for s in [db_status, groq_status, chroma_status])

    return {
        "status": "ok" if all_critical_ok else "degraded",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "uptime_seconds": uptime_seconds,
        "version": "1.0.0",
        "milestone": 5,
        "environment": settings.app_env,
        "project": "Sambash AI — Voice RAG AI",
        "services": {
            "api": "ok",
            "database": db_status,
            "groq_llm": groq_status,
            "chromadb": chroma_status,
            "chromadb_chunks": chroma_chunks,
            "embeddings": embedding_status,
            "twilio": twilio_status,
            "cloudinary": cloudinary_status,
        },
        "config": {
            "llm_model": settings.groq_chat_model,
            "embedding_model": settings.embedding_model,
            "top_k": settings.top_k,
            "chunk_size": settings.chunk_size,
        }
    }
