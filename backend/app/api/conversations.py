from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional

from app.core.database import get_db
from app.models.models import Conversation, Message, Lead

router = APIRouter()


@router.get("/")
async def list_conversations(
    lead_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    """List conversation sessions with optional filters."""
    query = (
        select(Conversation, Lead)
        .outerjoin(Lead, Conversation.lead_id == Lead.id)
        .order_by(Conversation.started_at.desc())
        .limit(limit)
    )
    if lead_id:
        query = query.where(Conversation.lead_id == lead_id)
    if status:
        query = query.where(Conversation.status == status)

    result = await db.execute(query)
    rows = result.all()

    return [
        {
            "id": c.id,
            "lead_id": c.lead_id,
            "language": c.language,
            "status": c.status,
            "turn_count": c.turn_count,
            "duration_seconds": c.duration_seconds,
            "started_at": c.started_at.isoformat() if c.started_at else None,
            "ended_at": c.ended_at.isoformat() if c.ended_at else None,
            "lead_name": l.name if l else "Unknown",
            "lead_company": l.company if l else "-",
            "lead_score": l.score if l else 0,
            "lead_outcome": l.status if l else "New"
        }
        for c, l in rows
    ]


@router.get("/{conv_id}/messages")
async def get_messages(conv_id: str, db: AsyncSession = Depends(get_db)):
    """Retrieve all messages for a conversation including sources."""
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conv_id)
        .order_by(Message.created_at)
    )
    messages = result.scalars().all()

    return {
        "conversation_id": conv_id,
        "messages": [
            {
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "sources": m.sources or [],
                "retrieval_score": m.retrieval_score,
                "latency_ms": m.latency_ms,
                "flagged": m.flagged,
                "flag_reason": m.flag_reason,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in messages
        ],
    }


@router.get("/stats/summary")
async def conversations_summary(db: AsyncSession = Depends(get_db)):
    """Aggregate stats for the analytics dashboard."""
    total = await db.scalar(select(func.count(Conversation.id)))
    completed = await db.scalar(
        select(func.count(Conversation.id)).where(
            Conversation.status == "completed")
    )
    flagged_msgs = await db.scalar(
        select(func.count(Message.id)).where(Message.flagged == True)
    )
    return {
        "total_conversations": total or 0,
        "completed": completed or 0,
        "flagged_messages": flagged_msgs or 0,
    }
