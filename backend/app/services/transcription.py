import logging
import os
import time
from groq import Groq
from app.core.config import settings

logger = logging.getLogger(__name__)

# Initialize Groq client using the API key from settings
client = Groq(api_key=settings.groq_api_key)


def transcribe_audio_file(file_path: str, language: str | None = None) -> str:
    """
    Transcribes audio using Groq's whisper-large-v3 API.
    This entirely replaces local faster-whisper to solve download timeouts and significantly improve Hinglish accuracy.
    """
    logger.info("Transcribing via Groq Whisper API: %s", file_path)
    start = time.time()
    try:
        with open(file_path, "rb") as file:
            transcription = client.audio.transcriptions.create(
                file=(os.path.basename(file_path), file.read()),
                model="whisper-large-v3",
                prompt="The user is speaking Hinglish, a mix of Hindi and English. Please transcribe accurately.",
                response_format="text",
                language="hi" if language and "hi" in language.lower() else "en"
            )

        result_text = transcription.strip()
        logger.info("Groq transcription complete in %.1fs. Length: %d chars",
                    time.time() - start, len(result_text))
        return result_text

    except Exception as e:
        logger.error("Groq Whisper API failed: %s", e)
        raise e
