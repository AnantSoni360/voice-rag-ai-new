import logging
import cloudinary
import cloudinary.uploader
from app.core.config import settings

logger = logging.getLogger(__name__)


def setup_cloudinary():
    if not settings.cloudinary_cloud_name:
        raise ValueError("Cloudinary configuration missing")
    cloudinary.config(
        cloud_name=settings.cloudinary_cloud_name,
        api_key=settings.cloudinary_api_key,
        api_secret=settings.cloudinary_api_secret,
        secure=True
    )


async def upload_recording_to_cloudinary(recording_content: bytes, filename: str) -> str:
    """Uploads a recording to Cloudinary and returns the secure URL."""
    setup_cloudinary()
    try:
        # Cloudinary treats audio as 'video' resource type
        upload_result = cloudinary.uploader.upload(
            recording_content,
            resource_type="video",
            folder="nexus_recordings",
            public_id=filename.split(".")[0]
        )
        secure_url = upload_result.get("secure_url")
        logger.info(f"Successfully uploaded {filename} to Cloudinary: {secure_url}")
        return secure_url
    except Exception as e:
        logger.error(f"Failed to upload to Cloudinary: {e}")
        raise e


def generate_presigned_url(object_key: str, expiration: int = 3600) -> str:
    """For Cloudinary, the object_key is already a public secure_url, so we just return it.
       This keeps compatibility with existing code that calls this function."""
    if not object_key:
        return ""
    return object_key
