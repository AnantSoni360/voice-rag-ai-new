"""
SQLAlchemy ORM models for Voice RAG AI.
Tables: documents, conversations, messages, leads, lead_scores
"""
import uuid
from datetime import datetime
from sqlalchemy import (
    String, Integer, Float, Text, Boolean,
    DateTime, ForeignKey, JSON, Enum as SAEnum
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.utcnow()


# ─────────────────────────────────────────────────────────
class Document(Base):
    """Uploaded knowledge base documents."""
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(512), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(512), nullable=False)
    file_path: Mapped[str] = mapped_column(String(1024), nullable=True)
    file_size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    content_type: Mapped[str] = mapped_column(
        String(128), default="text/plain")
    page_count: Mapped[int] = mapped_column(Integer, nullable=True)
    chunk_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(
        SAEnum("pending", "indexing", "indexed", "failed", name="doc_status"),
        default="pending",
    )
    error_message: Mapped[str] = mapped_column(Text, nullable=True)
    chroma_collection: Mapped[str] = mapped_column(String(256), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=_now, onupdate=_now)


# ─────────────────────────────────────────────────────────
class Lead(Base):
    """Customer lead records extracted from conversations."""
    __tablename__ = "leads"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(256), nullable=True)
    company: Mapped[str] = mapped_column(String(256), nullable=True)
    email: Mapped[str] = mapped_column(String(256), nullable=True)
    phone: Mapped[str] = mapped_column(String(64), nullable=True)
    language: Mapped[str] = mapped_column(String(16), default="en")

    # Qualification fields
    requirements: Mapped[str] = mapped_column(Text, nullable=True)
    budget_range: Mapped[str] = mapped_column(String(256), nullable=True)
    purchase_timeline: Mapped[str] = mapped_column(String(256), nullable=True)
    decision_authority: Mapped[str] = mapped_column(String(128), nullable=True)
    main_objection: Mapped[str] = mapped_column(String(256), nullable=True)
    product_fit: Mapped[str] = mapped_column(String(128), nullable=True)
    follow_up_preference: Mapped[str] = mapped_column(
        String(64), nullable=True)

    # Status
    status: Mapped[str] = mapped_column(
        SAEnum("new", "in_progress", "qualified",
               "nurture", "lost", name="lead_status"),
        default="new",
    )
    next_action: Mapped[str] = mapped_column(Text, nullable=True)
    score: Mapped[int] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=_now, onupdate=_now)

    conversations: Mapped[list["Conversation"]] = relationship(
        "Conversation", back_populates="lead")
    scores: Mapped[list["LeadScore"]] = relationship(
        "LeadScore", back_populates="lead")


# ─────────────────────────────────────────────────────────
class Conversation(Base):
    """Voice conversation sessions."""
    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=_uuid)
    lead_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("leads.id"), nullable=True)
    language: Mapped[str] = mapped_column(String(16), default="hi-en")
    status: Mapped[str] = mapped_column(
        SAEnum("active", "completed", "dropped", name="conv_status"),
        default="active",
    )
    turn_count: Mapped[int] = mapped_column(Integer, default=0)
    duration_seconds: Mapped[float] = mapped_column(Float, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    ended_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    recording_url: Mapped[str] = mapped_column(String(1024), nullable=True)

    lead: Mapped["Lead"] = relationship("Lead", back_populates="conversations")
    messages: Mapped[list["Message"]] = relationship(
        "Message", back_populates="conversation")


# ─────────────────────────────────────────────────────────
class Message(Base):
    """Individual messages within a conversation."""
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=_uuid)
    conversation_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("conversations.id"), nullable=False)
    role: Mapped[str] = mapped_column(
        SAEnum("user", "ai", name="msg_role"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    transcript_raw: Mapped[str] = mapped_column(Text, nullable=True)
    sources: Mapped[list] = mapped_column(JSON, default=list)
    retrieval_score: Mapped[float] = mapped_column(Float, nullable=True)
    latency_ms: Mapped[float] = mapped_column(Float, nullable=True)
    flagged: Mapped[bool] = mapped_column(Boolean, default=False)
    flag_reason: Mapped[str] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    conversation: Mapped["Conversation"] = relationship(
        "Conversation", back_populates="messages")


# ─────────────────────────────────────────────────────────
class LeadScore(Base):
    """Explainable lead scores per conversation."""
    __tablename__ = "lead_scores"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=_uuid)
    lead_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("leads.id"), nullable=False)
    conversation_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("conversations.id"), nullable=True)
    total_score: Mapped[int] = mapped_column(Integer, nullable=False)
    product_fit_score: Mapped[int] = mapped_column(
        Integer, default=0)    # 0-30
    budget_score: Mapped[int] = mapped_column(
        Integer, default=0)         # 0-25
    timeline_score: Mapped[int] = mapped_column(
        Integer, default=0)       # 0-20
    authority_score: Mapped[int] = mapped_column(
        Integer, default=0)      # 0-15
    intent_score: Mapped[int] = mapped_column(
        Integer, default=0)         # 0-10
    explanation: Mapped[str] = mapped_column(Text, nullable=True)
    scoring_version: Mapped[str] = mapped_column(String(16), default="1.0")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    lead: Mapped["Lead"] = relationship("Lead", back_populates="scores")


# ─────────────────────────────────────────────────────────
class OutboundTask(Base):
    """Tasks for outbound AI calling."""
    __tablename__ = "outbound_tasks"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=_uuid)
    customer_name: Mapped[str] = mapped_column(String(256), nullable=False)
    customer_phone: Mapped[str] = mapped_column(String(64), nullable=False)
    query: Mapped[str] = mapped_column(Text, nullable=False)
    # pending, in_progress, completed, failed
    status: Mapped[str] = mapped_column(String(32), default="pending")
    session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("conversations.id"), nullable=True)
    summary: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=_now, onupdate=_now)

    conversation: Mapped["Conversation"] = relationship(
        "Conversation", foreign_keys=[session_id])

# ─────────────────────────────────────────────────────────


class User(Base):
    """System users (Admin / Agents)"""
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(
        String(256), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(512), nullable=False)
    full_name: Mapped[str] = mapped_column(String(256), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
