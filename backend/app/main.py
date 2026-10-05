"""
Voice RAG AI — FastAPI Backend (Milestone 5 — Hardened)
"""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.core.config import settings
from app.core.middleware import TimeoutMiddleware, SecurityHeadersMiddleware
from app.api import health, voice, documents, leads, conversations, analytics, outbound, twilio

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

# Rate limiter
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: create DB tables. Shutdown: cleanup."""
    logger.info("🚀 Starting Voice RAG AI backend (env=%s)", settings.app_env)
    try:
        from app.core.database import create_tables
        await create_tables()
        logger.info("✅ Database tables verified/created")
    except Exception as e:
        logger.error("⚠️  Database init failed (non-fatal for dev): %s", e)
    yield
    logger.info("👋 Shutting down Voice RAG AI backend")


app = FastAPI(
    title="Voice RAG AI — Sambash AI",
    description="Multilingual Voice Sales Agent · RAG Engine · Groq + ChromaDB + Supabase",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan,
)

# ── Middleware (order matters — outermost first) ──────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(TimeoutMiddleware, timeout=30)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(health.router,         tags=["health"])
app.include_router(voice.router,          prefix="/api/voice",          tags=["voice"])
app.include_router(documents.router,      prefix="/api/documents",      tags=["documents"])
app.include_router(leads.router,          prefix="/api/leads",          tags=["leads"])
app.include_router(conversations.router,  prefix="/api/conversations",  tags=["conversations"])
app.include_router(analytics.router,      prefix="/api/analytics",      tags=["analytics"])
app.include_router(outbound.router,       prefix="/api/outbound",       tags=["outbound"])
app.include_router(twilio.router,         prefix="/api/twilio",         tags=["twilio"])


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.exception("Unhandled exception: %s", exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "type": type(exc).__name__},
    )
