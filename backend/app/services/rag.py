"""
RAG Engine for Voice RAG AI.

Pipeline per query:
  1. Embed the question (multilingual)
  2. Retrieve top-K chunks from ChromaDB
  3. Filter by minimum relevance score
  4. Build grounded prompt with conversation history
  5. Call Groq LLM
  6. Return answer + source citations + confidence

Critical rule: If no relevant evidence is found, the agent says so —
it does NOT invent prices, policies, or facts.
"""
from __future__ import annotations
import logging
import time
from dataclasses import dataclass
from groq import Groq
from app.core.config import settings
from app.services.embeddings import get_embedding
from app.services.chroma_client import query_collection

logger = logging.getLogger(__name__)

# ─── Groq client (initialized once) ──────────────────────────────────────────
_groq_client: Groq | None = None


def _get_groq() -> Groq:
    global _groq_client
    if _groq_client is None:
        _groq_client = Groq(api_key=settings.groq_api_key)
    return _groq_client


# ─── Data classes ─────────────────────────────────────────────────────────────
@dataclass
class RetrievedChunk:
    text: str
    document_name: str
    section_hint: str
    distance: float  # cosine distance — lower = more similar

    @property
    def similarity(self) -> float:
        """Convert cosine distance to a 0-1 similarity score."""
        return max(0.0, 1.0 - self.distance)

    @property
    def citation(self) -> str:
        return f"{self.document_name} · {self.section_hint}"


@dataclass
class RAGResponse:
    answer: str
    sources: list[dict]
    found: bool           # False = no relevant evidence
    confidence: float     # 0-1
    latency_ms: float
    model: str


# ─── System prompt ────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """You are Sambash AI, a multilingual voice sales assistant for Nexus CRM — a SaaS CRM platform for Indian businesses. You speak naturally in Hindi and English (code-switching is fine and encouraged for Indian customers).

CRITICAL RULES:
1. Answer ONLY using the RETRIEVED EVIDENCE provided below. Do NOT use your general knowledge to fill in prices, policies, features, or timelines.
2. If the evidence does not contain enough information to answer the question, say: "Mujhe is baare mein apne documents mein information nahi mili. Main is sawal ko hamare sales team ke paas escalate karta hoon." (and then say the same in English).
3. Never invent a discount, feature, or guarantee that is not in the evidence.
4. Cite your source when answering factual questions (e.g., "Pricing Guide ke according...").
5. Be conversational, warm, and helpful — you are talking to a potential customer.
6. Keep responses concise — 2-4 sentences for factual answers, slightly longer for objection handling.
7. For objection handling, use the approved responses from the Objection Handling Playbook.
8. NEVER promise unauthorized discounts. Escalate discount requests beyond the published table to the sales team.

CONVERSATION STAGE AWARENESS:
- Greeting → Understand needs → Product info → Qualification → Objection handling → Next steps
- Try to gather: requirements, budget range, purchase timeline, decision authority.
- Recommend the appropriate Nexus CRM plan based on their size and needs.
"""

EVIDENCE_TEMPLATE = """
RETRIEVED EVIDENCE (use ONLY this to answer):
{evidence_block}
"""

NO_EVIDENCE_RESPONSE = {
    "hi-en": "Mujhe is sawaal ka jawab apne documents mein nahi mila. Main is query ko hamare sales team ke paas escalate karoonga — woh aapko 24 ghante mein contact karenge. Kya aap apna contact number share kar sakte hain?\n\nI couldn't find a specific answer to this question in our knowledge base. I'll escalate this to our sales team who will reach out within 24 hours. Could you share your contact details?",
    "hi": "Mujhe is sawaal ka jawab apne documents mein nahi mila. Main is query ko hamare sales team ke paas escalate karoonga.",
    "en": "I couldn't find a specific answer to this question in our knowledge base. I'll escalate this to our sales team who will reach out within 24 hours.",
}


# ═══════════════════════════════════════════════════════
# MAIN RAG FUNCTION
# ═══════════════════════════════════════════════════════

def retrieve_chunks(
    question: str,
    top_k: int | None = None,
    min_score: float | None = None,
) -> list[RetrievedChunk]:
    """
    Embed the question and retrieve the most relevant document chunks.
    Filters out chunks below the minimum relevance threshold.
    """
    k = top_k or settings.top_k
    threshold = min_score if min_score is not None else settings.min_relevance_score

    query_vec = get_embedding(question)
    results = query_collection(query_embedding=query_vec, n_results=k)

    chunks: list[RetrievedChunk] = []
    docs = results.get("documents", [[]])[0]
    metas = results.get("metadatas", [[]])[0]
    distances = results.get("distances", [[]])[0]

    for doc_text, meta, dist in zip(docs, metas, distances):
        similarity = max(0.0, 1.0 - dist)
        if similarity >= threshold:
            chunks.append(RetrievedChunk(
                text=doc_text,
                document_name=meta.get("document_name", "Unknown Document"),
                section_hint=meta.get("section_hint", ""),
                distance=dist,
            ))

    logger.info(
        "Retrieved %d relevant chunks (out of %d) for query: %s…",
        len(chunks), k, question[:60],
    )
    return chunks


def build_prompt(
    question: str,
    chunks: list[RetrievedChunk],
    conversation_history: list[dict] | None = None,
    language: str = "hi-en",
) -> list[dict]:
    """
    Build the messages array for the Groq chat completion call.
    """
    messages: list[dict] = []

    # System message with language hint
    lang_instruction = {
        "hi": "Respond entirely in Hindi (Devanagari script).",
        "en": "Respond in English only.",
        "hi-en": "Respond naturally in a mix of Hindi and English as Indian customers prefer.",
    }.get(language, "Respond in Hindi and English.")

    system = SYSTEM_PROMPT + f"\n\nLANGUAGE INSTRUCTION: {lang_instruction}"

    if chunks:
        evidence_block = "\n\n---\n".join(
            f"SOURCE: {c.citation}\nCONTENT: {c.text}" for c in chunks
        )
        system += EVIDENCE_TEMPLATE.format(evidence_block=evidence_block)

    messages.append({"role": "system", "content": system})

    # Conversation history (last 6 turns for context window efficiency)
    if conversation_history:
        for turn in conversation_history[-6:]:
            messages.append({"role": turn["role"], "content": turn["content"]})

    # Current question
    messages.append({"role": "user", "content": question})
    return messages


async def generate_rag_response(
    question: str,
    conversation_history: list[dict] | None = None,
    language: str = "hi-en",
    use_fast_model: bool = False,
) -> RAGResponse:
    """
    Full RAG pipeline: retrieve → prompt → generate.

    Args:
        question: The user's question (Hindi, English, or mixed).
        conversation_history: Previous turns as [{"role": "user"|"ai", "content": str}].
        language: "hi", "en", or "hi-en".
        use_fast_model: Use llama-3.1-8b-instant for lower latency.

    Returns:
        RAGResponse with answer, sources, confidence, and latency.
    """
    start = time.perf_counter()

    # 1. Retrieve
    chunks = retrieve_chunks(question)

    # 2. Check if evidence exists
    if not chunks:
        elapsed = (time.perf_counter() - start) * 1000
        return RAGResponse(
            answer=NO_EVIDENCE_RESPONSE.get(
                language, NO_EVIDENCE_RESPONSE["hi-en"]),
            sources=[],
            found=False,
            confidence=0.0,
            latency_ms=round(elapsed, 1),
            model="no-retrieval",
        )

    # 3. Build prompt
    model = settings.groq_fast_model if use_fast_model else settings.groq_chat_model
    messages = build_prompt(question, chunks, conversation_history, language)

    # 4. Call Groq
    groq = _get_groq()
    response = groq.chat.completions.create(
        model=model,
        messages=messages,
        temperature=0.3,
        max_tokens=512,
        top_p=0.9,
    )
    answer = response.choices[0].message.content.strip()

    elapsed = (time.perf_counter() - start) * 1000
    confidence = chunks[0].similarity if chunks else 0.0

    sources = [
        {
            "document": c.document_name,
            "section": c.section_hint,
            "similarity": round(c.similarity, 3),
        }
        for c in chunks[:3]  # top 3 sources
    ]

    logger.info(
        "RAG response generated in %.0fms | model=%s | confidence=%.2f | sources=%d",
        elapsed, model, confidence, len(sources),
    )

    return RAGResponse(
        answer=answer,
        sources=sources,
        found=True,
        confidence=round(confidence, 3),
        latency_ms=round(elapsed, 1),
        model=model,
    )
