from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    app_env: str = "development"
    secret_key: str = "change-me"
    allowed_origins: str = "http://localhost:5173"

    # Groq
    groq_api_key: str
    groq_chat_model: str = "llama-3.3-70b-versatile"
    groq_fast_model: str = "llama-3.1-8b-instant"

    # Database
    database_url: str

    # ChromaDB
    chroma_persist_dir: str = "./data/chroma"
    chroma_collection: str = "nexus_crm_docs"

    # Embeddings
    embedding_model: str = "paraphrase-multilingual-MiniLM-L12-v2"
    embedding_device: str = "cpu"

    # RAG
    chunk_size: int = 512
    chunk_overlap: int = 64
    top_k: int = 5
    min_relevance_score: float = 0.40

    # Whisper
    whisper_model_size: str = "small"
    whisper_device: str = "cpu"

    # Uploads
    max_upload_size_mb: int = 50
    upload_dir: str = "./data/uploads"

    # Scoring
    score_high_threshold: int = 70
    score_medium_threshold: int = 40

    # Twilio (Telephony)
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_phone_number: str = ""

    # Cloudinary
    cloudinary_cloud_name: str = ""
    cloudinary_api_key: str = ""
    cloudinary_api_secret: str = ""

    @property
    def origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
