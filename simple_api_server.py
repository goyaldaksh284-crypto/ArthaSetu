"""
Simple API Server for Transaction Parser & Chatbot Assistant
=============================================================

FastAPI server exposing AI endpoints for:
- Receipt / Bill image parsing (/api/parse-image)
- Voice recording parsing (/api/parse-voice)
- Voice transcript / text parsing (/api/parse-text)
- Dedicated website chatbot assistant (/api/chat)

Runs on port 8001 by default, alongside the main agent backend (port 8000).
"""

import os
import sys
import tempfile
from typing import List, Dict, Any, Optional
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# Ensure UTF-8 output on Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Load environment
load_dotenv()
load_dotenv(Path(__file__).parent / "backend" / ".env")

from transaction_parser import TransactionParser

app = FastAPI(
    title="ArthaSetu Parser & Chat API",
    description="Multimodal receipt OCR, voice processing, and AI chat assistant",
    version="2.0.0"
)

# CORS setup
allowed_origins = os.environ.get(
    "CORS_ALLOWED_ORIGINS",
    "http://localhost:8080,http://localhost:5173,http://127.0.0.1:8080,http://127.0.0.1:5173"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize parser
parser = TransactionParser()


class TextParseRequest(BaseModel):
    text: str


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    user_context: Optional[Dict[str, Any]] = None


@app.get("/")
def root():
    return {
        "status": "healthy",
        "service": "ArthaSetu Transaction Parser & Chatbot API",
        "version": "2.0.0",
        "endpoints": {
            "parse_image": "/api/parse-image",
            "parse_voice": "/api/parse-voice",
            "parse_text": "/api/parse-text",
            "chat": "/api/chat",
            "health": "/api/health"
        }
    }


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "google_keys_available": len(parser.google_keys),
        "openrouter_keys_available": len(parser.openrouter_keys)
    }


@app.post("/api/parse-image")
async def parse_image(file: UploadFile = File(...)):
    """
    Parse receipt/bill image using OpenAI (gpt-4o-mini) and Google (gemini) multimodal vision.
    """
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image (JPEG, PNG, WEBP, BMP)")

    safe_name = file.filename or "receipt.jpg"
    ext = safe_name.split(".")[-1] if "." in safe_name else "jpg"

    with tempfile.NamedTemporaryFile(delete=False, suffix=f".{ext}") as tmp:
        tmp_path = tmp.name

    try:
        content = await file.read()
        with open(tmp_path, "wb") as f:
            f.write(content)

        result = parser.parse_image(tmp_path)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing image: {str(e)}")
    finally:
        if os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except Exception:
                pass


@app.post("/api/parse-voice")
async def parse_voice(file: UploadFile = File(...)):
    """
    Parse an audio recording (WAV, MP3, WEBM, OGG) to extract transaction details.
    """
    safe_name = file.filename or "recording.wav"
    ext = safe_name.split(".")[-1] if "." in safe_name else "wav"

    with tempfile.NamedTemporaryFile(delete=False, suffix=f".{ext}") as tmp:
        tmp_path = tmp.name

    try:
        content = await file.read()
        with open(tmp_path, "wb") as f:
            f.write(content)

        result = parser.parse_voice(tmp_path)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing audio: {str(e)}")
    finally:
        if os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except Exception:
                pass


@app.post("/api/parse-text")
def parse_text(req: TextParseRequest):
    """
    Parse spoken transcript or typed text into a structured transaction.
    """
    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="Text field cannot be empty")
    return parser.parse_text(req.text)


@app.post("/api/chat")
def chat(req: ChatRequest):
    """
    ArthaSetu Website AI Assistant Chat endpoint.
    Strictly answers questions related to ArthaSetu and gig worker personal finance.
    """
    if not req.messages:
        raise HTTPException(status_code=400, detail="Messages list cannot be empty")

    dict_messages = [{"role": m.role, "content": m.content} for m in req.messages]
    result = parser.chat(dict_messages, req.user_context)
    return result


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PARSER_PORT", 8001))
    print(f"\n{'='*60}\nStarting ArthaSetu AI Parser & Chat Server on port {port}\n{'='*60}\n")
    uvicorn.run(app, host="0.0.0.0", port=port)
