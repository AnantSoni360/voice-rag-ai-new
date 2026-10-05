# Voice RAG AI — Multilingual Voice Sales Agent

> **Sambash AI** — An AI-powered outbound voice sales agent that calls customers, understands their queries in Hindi/English, answers using your business documents (RAG), and logs everything to the CRM.

## Milestones

| # | Title | Status |
|---|-------|--------|
| 1 | Foundation & UI | ✅ Done |
| 2 | RAG Engine | ✅ Done |
| 3 | Voice Pipeline (Twilio) | ✅ Done |
| 4 | Lead Intelligence | ✅ Done |
| 5 | Hardening & Deploy | ✅ Done |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Vite, Framer Motion, Recharts, React Router |
| **Backend** | FastAPI, Python 3.11+, SQLAlchemy (async), SlowAPI |
| **AI / LLM** | Groq (Qwen / LLaMA), Sentence Transformers, faster-whisper |
| **Vector DB** | ChromaDB (local persistent) |
| **Database** | PostgreSQL via Supabase |
| **Telephony** | Twilio Programmable Voice |
| **Storage** | Cloudinary (call recording audio) |
| **Design** | White (#FAFAF8) + Orange (#F97316) |

## Project Structure

```
voice-rag-ai/
├── frontend/          # React + Vite UI
├── backend/           # FastAPI backend
│   ├── app/
│   │   ├── api/       # Route handlers
│   │   ├── core/      # Config, security, DB, middleware
│   │   ├── models/    # SQLAlchemy models
│   │   ├── schemas/   # Pydantic schemas
│   │   └── services/  # RAG, voice, lead logic, storage
│   ├── Dockerfile
│   ├── .env.example
│   └── requirements.txt
├── data/              # ChromaDB vectors, uploads
├── docker-compose.yml
├── railway.json       # Railway.app deploy config
├── render.yaml        # Render.com deploy config
└── README.md
```

## Quick Start

### Backend
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env        # Fill in your values
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Tunneling (for Twilio webhooks in dev)
```bash
ngrok http 8000
# Paste the ngrok URL into the Webhook URL field in the Control Room
```

## Deploy with Docker
```bash
docker-compose up --build
```

## Deploy to Railway / Render
- **Railway:** Push to GitHub → Import repo → Set env vars from `.env.example`
- **Render:** Push to GitHub → New Web Service → select `render.yaml` blueprint

## Health Check
```
GET /health
```
Returns database, Groq LLM, ChromaDB, Twilio, Cloudinary status + uptime.
