from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from pydantic import BaseModel

from app.core.database import get_db
from app.models.models import Lead

router = APIRouter()


class LeadStatusUpdate(BaseModel):
    status: str


@router.get("/")
async def list_leads(
    status: Optional[str] = None,
    min_score: Optional[int] = None,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
):
    """List leads with optional filters."""
    query = select(Lead).order_by(Lead.updated_at.desc()).limit(limit)
    if status:
        query = query.where(Lead.status == status)
    if min_score is not None:
        query = query.where(Lead.score >= min_score)

    result = await db.execute(query)
    leads = result.scalars().all()

    return [
        {
            "id": l.id,
            "name": l.name,
            "company": l.company,
            "score": l.score,
            "status": l.status,
            "budget_range": l.budget_range,
            "purchase_timeline": l.purchase_timeline,
            "decision_authority": l.decision_authority,
            "main_objection": l.main_objection,
            "requirements": l.requirements,
            "language": l.language,
            "next_action": l.next_action,
            "created_at": l.created_at.isoformat() if l.created_at else None,
            "updated_at": l.updated_at.isoformat() if l.updated_at else None,
        }
        for l in leads
    ]


@router.get("/{lead_id}")
async def get_lead(lead_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Lead).where(Lead.id == lead_id))
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found.")
    return lead


@router.patch("/{lead_id}/status")
async def update_lead_status(
    lead_id: str,
    body: LeadStatusUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update lead status (qualified, nurture, lost, in_progress)."""
    result = await db.execute(select(Lead).where(Lead.id == lead_id))
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found.")
    lead.status = body.status
    await db.commit()
    return {"id": lead_id, "status": lead.status}
