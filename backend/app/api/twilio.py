from fastapi import APIRouter, Request, Depends, HTTPException
from fastapi.responses import HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from twilio.rest import Client
from twilio.twiml.voice_response import VoiceResponse, Gather
from app.core.database import get_db
from app.models.models import OutboundTask, Conversation, Message
from app.core.config import settings
import logging

router = APIRouter(tags=["Twilio Telephony"])
logger = logging.getLogger(__name__)


def get_twilio_client():
    if not settings.twilio_account_sid or not settings.twilio_auth_token:
        raise ValueError("Twilio credentials not configured in .env")
    return Client(settings.twilio_account_sid, settings.twilio_auth_token)


@router.post("/{task_id}/start")
async def start_twilio_call(
    task_id: str,
    base_url: str,
    db: AsyncSession = Depends(get_db)
):
    """Initiates a physical phone call to the customer via Twilio"""
    # Strip trailing slash from base_url
    base_url = base_url.rstrip("/")

    task = await db.get(OutboundTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    client = get_twilio_client()

    # Always create a fresh conversation session (handles retries gracefully)
    convo = Conversation()
    db.add(convo)
    await db.commit()

    task.session_id = convo.id
    task.status = "in_progress"
    task.summary = None
    db.add(task)
    await db.commit()

    logger.info("Starting Twilio call to %s with webhook base: %s",
                task.customer_phone, base_url)

    # Initiate Twilio Call — use ABSOLUTE URL so Twilio can reach it for the FIRST hit
    twiml_url = f"{base_url}/api/twilio/twiml/{task_id}"
    recording_callback = f"{base_url}/api/twilio/recording/{task_id}"
    logger.info("TwiML URL: %s", twiml_url)
    call = client.calls.create(
        to=task.customer_phone,
        from_=settings.twilio_phone_number,
        url=twiml_url,
        # record=True,
        # recording_status_callback=recording_callback,
        # recording_status_callback_event=["completed"]
    )
    logger.info("Twilio call SID: %s", call.sid)

    return {"status": "calling", "call_sid": call.sid, "session_id": convo.id}


@router.post("/twiml/{task_id}")
async def twilio_twiml_handler(task_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    """Provides the initial TwiML to Twilio when the call connects"""
    task = await db.get(OutboundTask, task_id)
    if not task:
        response = VoiceResponse()
        response.say("Sorry, we could not find this call session. Goodbye.")
        response.hangup()
        return HTMLResponse(content=str(response), media_type="application/xml")

    logger.info("TwiML handler called for task %s", task_id)

    # Build absolute base URL from the incoming request so we stay on the same ngrok domain
    base = str(request.base_url).rstrip("/")

    response = VoiceResponse()
    gather = Gather(
        input="speech",
        action=f"{base}/api/twilio/process/{task_id}",
        method="POST",
        speechTimeout="auto",
        language="en-US"
    )
    gather.say(
        f"Hello {task.customer_name}, this is the Nexus CRM AI assistant calling regarding your query about {task.query}. How can I help you today?",
        voice="Polly.Matthew-Neural"
    )
    response.append(gather)
    # If customer stays silent, redirect back using absolute URL
    response.redirect(f"{base}/api/twilio/twiml/{task_id}", method="POST")

    return HTMLResponse(content=str(response), media_type="application/xml")


@router.post("/process/{task_id}")
async def twilio_process_speech(
    task_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Handles the transcribed speech from Twilio, runs RAG, and responds"""
    form_data = await request.form()
    speech_result = form_data.get("SpeechResult")

    task = await db.get(OutboundTask, task_id)
    response = VoiceResponse()

    logger.info("Process speech for task %s: '%s'", task_id, speech_result)

    # Build absolute base URL from the incoming request
    base = str(request.base_url).rstrip("/")

    if not speech_result:
        gather = Gather(
            input="speech", action=f"{base}/api/twilio/process/{task_id}", method="POST")
        gather.say("I'm sorry, I didn't catch that. Could you repeat?",
                   voice="Polly.Matthew-Neural")
        response.append(gather)
        return HTMLResponse(content=str(response), media_type="application/xml")

    from app.services.rag import generate_rag_response

    # Save user message
    user_msg = Message(conversation_id=task.session_id,
                       role="user", content=speech_result)
    db.add(user_msg)
    await db.commit()

    # Get history
    history_result = await db.execute(select(Message).where(Message.conversation_id == task.session_id).order_by(Message.created_at))
    history = history_result.scalars().all()
    conv_history = [{"role": m.role, "content": m.content} for m in history]

    # Run RAG
    try:
        rag_res = await generate_rag_response(speech_result, conv_history)
        ai_answer = rag_res.answer
    except Exception as e:
        logger.exception("RAG failed: %s", e)
        ai_answer = "Sorry, I'm having a technical problem right now. Please try again in a moment."

    # Save AI message
    ai_msg = Message(conversation_id=task.session_id,
                     role="ai", content=ai_answer)
    db.add(ai_msg)
    await db.commit()

    # Check if AI wants to end call
    is_goodbye = any(word in ai_answer.lower()
                     for word in ["goodbye", "have a great day", "bye for now"])

    if is_goodbye:
        response.say(ai_answer, voice="Polly.Matthew-Neural")
        response.hangup()

        # Mark task completed
        task.status = "completed"
        task.summary = "Call completed successfully via Twilio."
        db.add(task)
        await db.commit()
    else:
        # Continue conversation — absolute URL
        gather = Gather(
            input="speech", action=f"{base}/api/twilio/process/{task_id}", method="POST")
        gather.say(ai_answer, voice="Polly.Matthew-Neural")
        response.append(gather)

    return HTMLResponse(content=str(response), media_type="application/xml")


@router.post("/recording/{task_id}")
async def twilio_recording_callback(
    task_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Webhook to receive the call recording from Twilio and upload it to Cloudflare R2"""
    form_data = await request.form()
    recording_url = form_data.get("RecordingUrl")
    
    if not recording_url:
        return {"status": "no_recording_url"}

    task = await db.get(OutboundTask, task_id)
    if not task or not task.session_id:
        return {"status": "task_not_found"}

    try:
        import httpx
        from app.services.storage import upload_recording_to_cloudinary
        
        # Download the recording from Twilio
        # Twilio RecordingUrl usually ends without extension, appending .mp3 downloads as mp3
        mp3_url = f"{recording_url}.mp3"
        
        # In production, we'd need Twilio Auth if recordings are protected.
        # Assuming public/unprotected for this prototype or appending auth.
        async with httpx.AsyncClient() as client:
            resp = await client.get(mp3_url)
            if resp.status_code == 200:
                audio_bytes = resp.content
                filename = f"recording_{task.session_id}.mp3"
                
                # Upload to Cloudinary (returns the secure URL directly)
                secure_url = await upload_recording_to_cloudinary(audio_bytes, filename)
                
                # Update Conversation in DB
                conv = await db.get(Conversation, task.session_id)
                if conv:
                    conv.recording_url = secure_url
                    await db.commit()
                    logger.info("Successfully saved recording for task %s to Cloudinary", task_id)
    except Exception as e:
        logger.error("Error processing recording for task %s: %s", task_id, e)

    return {"status": "received"}
