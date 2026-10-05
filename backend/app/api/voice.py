"""
Voice API — transcription and RAG chat.
"""
import os
import tempfile
from fastapi.concurrency import run_in_threadpool
from app.services.transcription import transcribe_audio_file
from app.services.lead_scoring import extract_and_score_lead
from fastapi import BackgroundTasks
import time
import logging
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from app.core.database import get_db
from app.models.models import Conversation, Message
from app.services.rag import generate_rag_response

logger = logging.getLogger(__name__)
router = APIRouter()


class ChatRequest(BaseModel):
    session_id: Optional[str] = None
    message: str
    language: str = "hi-en"
    conversation_history: list[dict] = []
    use_fast_model: bool = False


class ChatResponse(BaseModel):
    answer: str
    sources: list[dict]
    found: bool
    confidence: float
    latency_ms: float
    model: str
    session_id: Optional[str] = None


class TranscribeResponse(BaseModel):
    transcript: str
    language: str
    duration_s: float


# ─── RAG Chat ─────────────────────────────────────────────────────────────────
@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest, db: AsyncSession = Depends(get_db)):
    """
    RAG-powered multilingual chat endpoint.
    Retrieves relevant document chunks and generates a grounded response via Groq.
    """
    if not req.message.strip():
        raise HTTPException(status_code=422, detail="Message cannot be empty.")

    # Generate RAG response
    rag = await generate_rag_response(
        question=req.message,
        conversation_history=req.conversation_history,
        language=req.language,
        use_fast_model=req.use_fast_model,
    )

    # Persist message to DB if session exists
    session_id = req.session_id
    if session_id:
        try:
            result = await db.execute(
                select(Conversation).where(Conversation.id == session_id)
            )
            conv = result.scalar_one_or_none()
            if conv:
                # Save user message
                user_msg = Message(
                    conversation_id=session_id,
                    role="user",
                    content=req.message,
                    latency_ms=None,
                )
                db.add(user_msg)

                # Save AI message
                ai_msg = Message(
                    conversation_id=session_id,
                    role="ai",
                    content=rag.answer,
                    sources=rag.sources,
                    retrieval_score=rag.confidence,
                    latency_ms=rag.latency_ms,
                    flagged=not rag.found,
                    flag_reason="No relevant evidence found" if not rag.found else None,
                )
                db.add(ai_msg)
                conv.turn_count = (conv.turn_count or 0) + 1
                await db.commit()
        except Exception as e:
            logger.warning("Could not persist message to DB: %s", e)

    return ChatResponse(
        answer=rag.answer,
        sources=rag.sources,
        found=rag.found,
        confidence=rag.confidence,
        latency_ms=rag.latency_ms,
        model=rag.model,
        session_id=session_id,
    )


# ─── New Session ──────────────────────────────────────────────────────────────
@router.post("/session/start")
async def start_session(language: str = "hi-en", db: AsyncSession = Depends(get_db)):
    """Create a new conversation session and return its ID."""
    conv = Conversation(language=language, status="active")
    db.add(conv)
    await db.commit()
    await db.refresh(conv)
    return {"session_id": conv.id, "language": language, "status": "active"}


@router.post("/session/{session_id}/end")
async def end_session(session_id: str, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    """Mark a conversation session as completed and score the lead."""
    from datetime import datetime
    result = await db.execute(select(Conversation).where(Conversation.id == session_id))
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Session not found.")
    conv.status = "completed"
    conv.ended_at = datetime.utcnow()
    await db.commit()

    # Run the lead scoring synchronously before returning
    lead = await extract_and_score_lead(session_id, db)

    lead_data = None
    if lead:
        lead_data = {
            "id": lead.id,
            "name": lead.name,
            "company": lead.company,
            "requirements": lead.requirements,
            "budget": lead.budget_range,
            "timeline": lead.purchase_timeline,
            "authority": lead.decision_authority,
            "objection": lead.main_objection,
            "score": lead.score,
            "status": lead.status,
            "nextAction": lead.next_action,
        }

    return {"session_id": session_id, "status": "completed", "lead": lead_data}


# ─── Transcribe (Milestone 3) ────────────────────────────────────────────────


@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe_audio(
    audio: UploadFile = File(...),
    language: str = "hi",
):
    """
    Audio → text transcription via faster-whisper.
    Saves the uploaded file to disk temporarily, transcribes it in a separate thread, and cleans up.
    """
    start = time.time()

    # Save the uploaded file to a temporary location
    fd, temp_path = tempfile.mkstemp(suffix=".webm")
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(await audio.read())

        # Call the faster-whisper service in a threadpool to prevent blocking the async event loop
        # (This is especially important when Whisper is downloading its weights on the first run!)
        transcript = await run_in_threadpool(transcribe_audio_file, temp_path, language)
    finally:
        # Clean up the temp file
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception as e:
                logger.warning(
                    "Failed to remove temp audio file %s: %s", temp_path, e)

    return TranscribeResponse(
        transcript=transcript,
        language=language,
        duration_s=round(time.time() - start, 3),
    )
