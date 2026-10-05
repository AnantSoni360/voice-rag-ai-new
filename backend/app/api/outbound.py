from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid
from pydantic import BaseModel

from app.core.database import get_db
from app.models.models import OutboundTask, Conversation, Message

router = APIRouter()


@router.get("/")
async def list_outbound_tasks(db: AsyncSession = Depends(get_db)):
    from app.services.storage import generate_presigned_url
    
    query = select(OutboundTask, Conversation).outerjoin(Conversation, OutboundTask.session_id == Conversation.id).order_by(OutboundTask.created_at.desc())
    result = await db.execute(query)
    rows = result.all()
    
    tasks = []
    for task, conv in rows:
        task_dict = {
            "id": task.id,
            "customer_name": task.customer_name,
            "customer_phone": task.customer_phone,
            "query": task.query,
            "status": task.status,
            "session_id": task.session_id,
            "summary": task.summary,
            "created_at": task.created_at,
            "updated_at": task.updated_at,
            "recording_url": generate_presigned_url(conv.recording_url) if conv and conv.recording_url else None
        }
        tasks.append(task_dict)
    return tasks


class OutboundTaskCreate(BaseModel):
    customer_name: str
    customer_phone: str
    query: str


@router.post("/")
async def create_outbound_task(task_in: OutboundTaskCreate, db: AsyncSession = Depends(get_db)):
    task = OutboundTask(
        customer_name=task_in.customer_name,
        customer_phone=task_in.customer_phone,
        query=task_in.query,
        status="pending"
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return task


@router.post("/seed")
async def seed_outbound_tasks(db: AsyncSession = Depends(get_db)):
    """Seed dummy tasks for testing"""
    tasks = [
        OutboundTask(customer_name="Anant Soni (YOU)", customer_phone="+918073759321",
                     query="Wants a demo of the AI calling feature"),
        OutboundTask(customer_name="Rahul Gupta", customer_phone="+918073759321",
                     query="Wants a refund because the app crashes during login"),
        OutboundTask(customer_name="Amit Patel", customer_phone="+918073759321",
                     query="Needs help setting up the webhook integration")
    ]
    db.add_all(tasks)
    await db.commit()
    return {"message": "Seeded"}


@router.post("/{task_id}/start")
async def start_outbound_session(task_id: str, db: AsyncSession = Depends(get_db)):
    task = await db.scalar(select(OutboundTask).where(OutboundTask.id == task_id))
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    conv = Conversation(
        id=str(uuid.uuid4()),
        language="hi-en",
        status="active"
    )
    db.add(conv)

    # Inject context for the AI
    context_msg = Message(
        conversation_id=conv.id,
        role="system",
        content=f"IMPORTANT CONTEXT: You are making an OUTBOUND phone call to a customer named {task.customer_name}. They have the following query/problem: '{task.query}'. Start the conversation by greeting them by name, stating you are calling from Nexus CRM support, and asking about their issue."
    )
    db.add(context_msg)

    task.status = "in_progress"
    task.session_id = conv.id

    await db.commit()
    return {"session_id": conv.id, "status": "active"}


@router.post("/{task_id}/end")
async def end_outbound_session(task_id: str, db: AsyncSession = Depends(get_db)):
    task = await db.scalar(select(OutboundTask).where(OutboundTask.id == task_id))
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    task.status = "completed"

    # In a real app we would summarize the chat here via Groq.
    # For now we'll mark as completed and link them to Conversation History.
    task.summary = "Call completed. See conversation history for full transcript."
    await db.commit()
    return {"status": "completed"}
