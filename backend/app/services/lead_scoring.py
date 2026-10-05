import json
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from groq import Groq

from app.core.config import settings
from app.models.models import Conversation, Message, Lead, LeadScore

logger = logging.getLogger(__name__)

# System prompt for the LLM to extract Lead info
LEAD_EXTRACTION_PROMPT = """You are an expert Sales Operations AI for Nexus CRM.
Your job is to analyze a sales conversation transcript between an AI Agent and a Customer, and extract Lead details and score the lead.

Output exactly a raw JSON object (without markdown blocks like ```json) with the following schema:
{
    "name": "string or null",
    "company": "string or null",
    "email": "string or null",
    "phone": "string or null",
    "requirements": "string summary or null",
    "budget_range": "string or null",
    "purchase_timeline": "string or null",
    "decision_authority": "string (e.g., 'decision maker', 'evaluator') or null",
    "main_objection": "string or null",
    "product_fit": "string (e.g., 'high', 'medium', 'low') or null",
    "follow_up_preference": "string or null",
    "next_action": "string or null",
    "scores": {
        "product_fit_score": integer 0-30,
        "budget_score": integer 0-25,
        "timeline_score": integer 0-20,
        "authority_score": integer 0-15,
        "intent_score": integer 0-10,
        "explanation": "short string explaining the scores"
    }
}

Be conservative. If a piece of information is not mentioned in the transcript, output null for that field, and give 0 for its score.
Total score will be calculated by summing the individual scores (max 100).
"""


async def extract_and_score_lead(session_id: str, db: AsyncSession):
    """
    Reads the conversation transcript, calls Groq to extract Lead JSON,
    and saves the Lead and LeadScore to the database.
    """
    logger.info("Starting lead extraction for session %s", session_id)

    # 1. Fetch conversation and messages
    result = await db.execute(select(Conversation).where(Conversation.id == session_id))
    conv = result.scalar_one_or_none()
    if not conv:
        logger.error("Conversation %s not found for scoring", session_id)
        return

    messages_result = await db.execute(
        select(Message)
        .where(Message.conversation_id == session_id)
        .order_by(Message.created_at.asc())
    )
    messages = messages_result.scalars().all()

    if len(messages) < 2:
        logger.info(
            "Conversation %s is too short to extract a lead.", session_id)
        return

    # 2. Build Transcript
    transcript_lines = []
    for msg in messages:
        role = "Customer" if msg.role == "user" else "AI Agent"
        transcript_lines.append(f"{role}: {msg.content}")

    transcript = "\n".join(transcript_lines)

    # 3. Call Groq
    client = Groq(api_key=settings.groq_api_key)
    try:
        response = client.chat.completions.create(
            model=settings.groq_chat_model,
            messages=[
                {"role": "system", "content": LEAD_EXTRACTION_PROMPT},
                {"role": "user", "content": f"Transcript:\n{transcript}"}
            ],
            response_format={"type": "json_object"},
            temperature=0.0,
        )
        content = response.choices[0].message.content
        data = json.loads(content)

    except Exception as e:
        logger.error("Failed to extract lead via Groq: %s", e)
        return

    # 4. Save to DB
    try:
        # Check if Lead already exists for this conv
        if conv.lead_id:
            lead_result = await db.execute(select(Lead).where(Lead.id == conv.lead_id))
            lead = lead_result.scalar_one()
        else:
            lead = Lead()
            db.add(lead)
            await db.flush()  # get ID
            conv.lead_id = lead.id

        # Update Lead fields
        lead.name = data.get("name", lead.name)
        lead.company = data.get("company", lead.company)
        lead.email = data.get("email", lead.email)
        lead.phone = data.get("phone", lead.phone)
        lead.requirements = data.get("requirements", lead.requirements)
        lead.budget_range = data.get("budget_range", lead.budget_range)
        lead.purchase_timeline = data.get(
            "purchase_timeline", lead.purchase_timeline)
        lead.decision_authority = data.get(
            "decision_authority", lead.decision_authority)
        lead.main_objection = data.get("main_objection", lead.main_objection)
        lead.product_fit = data.get("product_fit", lead.product_fit)
        lead.follow_up_preference = data.get(
            "follow_up_preference", lead.follow_up_preference)
        lead.next_action = data.get("next_action", lead.next_action)

        scores_data = data.get("scores", {})
        total_score = (
            scores_data.get("product_fit_score", 0) +
            scores_data.get("budget_score", 0) +
            scores_data.get("timeline_score", 0) +
            scores_data.get("authority_score", 0) +
            scores_data.get("intent_score", 0)
        )

        # Set Lead Status based on score
        if total_score >= settings.score_high_threshold:
            lead.status = "qualified"
        elif total_score >= settings.score_medium_threshold:
            lead.status = "in_progress"
        else:
            lead.status = "nurture"

        lead.score = total_score

        # Create LeadScore entry
        ls = LeadScore(
            lead_id=lead.id,
            conversation_id=session_id,
            total_score=total_score,
            product_fit_score=scores_data.get("product_fit_score", 0),
            budget_score=scores_data.get("budget_score", 0),
            timeline_score=scores_data.get("timeline_score", 0),
            authority_score=scores_data.get("authority_score", 0),
            intent_score=scores_data.get("intent_score", 0),
            explanation=scores_data.get("explanation", ""),
        )
        db.add(ls)

        await db.commit()
        logger.info("Successfully saved Lead (ID: %s, Score: %d) for session %s",
                    lead.id, total_score, session_id)
        return lead

    except Exception as e:
        logger.error("Failed to save Lead to database: %s", e)
        await db.rollback()
