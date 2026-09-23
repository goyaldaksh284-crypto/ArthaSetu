"""
FastAPI Backend for the ArthaSetu agent pipeline.

This backend:
1. Receives a verified user_id from the frontend's Supabase Auth session
2. Triggers 9 agents for analysis (context_agent, knowledge_agent, and
   pattern_agent were removed -- see agents/finance_helpers.py and
   CLAUDE.md's Phase 1 notes for why)
3. Agents compute real numbers from real transaction/profile data and write
   directly to Supabase (see backend/agents/finance_helpers.py) -- the LLM
   is used only for short narrative text, not for the numbers themselves
4. Returns status to frontend
5. Frontend fetches results directly from database
"""

import logging
import os
import sys
import tempfile
from datetime import datetime
from typing import Dict, Any, Optional, List
from fastapi import Depends, FastAPI, HTTPException, BackgroundTasks, Request, UploadFile, File
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
try:
    from slowapi import Limiter, _rate_limit_exceeded_handler
    from slowapi.errors import RateLimitExceeded
    has_slowapi = True
except ImportError:
    has_slowapi = False

# Load environment variables
load_dotenv()

# Add backend, agents and repo root to path
backend_dir = os.path.dirname(os.path.abspath(__file__))
repo_root = os.path.dirname(backend_dir)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)
if os.path.join(backend_dir, 'agents') not in sys.path:
    sys.path.insert(0, os.path.join(backend_dir, 'agents'))
if repo_root not in sys.path:
    sys.path.insert(0, repo_root)

from auth import get_current_user_id, get_user_id_for_rate_limit
from transaction_parser import TransactionParser

# finance_helpers configures the root logger on first import
logger = logging.getLogger(__name__)

from finance_helpers import fetch_records, write_record, update_record

# Import all agents
from budget_agent import BudgetAnalysisAgent
from volatility_agent import VolatilityForecasterAgent
from tax_agent import TaxComplianceAgent
from risk_agent import RiskAssessmentAgent
from savings_investment_agent import SavingsInvestmentAgent
from bill_payment_agent import BillPaymentAgent
from goals_agent import FinancialGoalsAgent
from recommendation_agent import RecommendationAgent
from action_agent import ActionExecutionAgent

# Initialize FastAPI
app = FastAPI(
    title="ArthaSetu Unified Backend",
    description="Unified financial analysis, multimodal OCR, voice processing, and Groq-powered AI chatbot",
    version="2.0.0"
)

if has_slowapi:
    limiter = Limiter(key_func=get_user_id_for_rate_limit)
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
else:
    class DummyLimiter:
        def limit(self, *args, **kwargs):
            def decorator(func):
                return func
            return decorator
    limiter = DummyLimiter()

# Initialize Transaction & Chatbot Parser
parser = TransactionParser()

# CORS configuration supporting localhost, Vercel deployments (*.vercel.app), and custom origins
cors_env = os.environ.get("CORS_ALLOWED_ORIGINS", "").strip()
if cors_env:
    CORS_ALLOWED_ORIGINS = [o.strip() for o in cors_env.split(",") if o.strip()]
else:
    CORS_ALLOWED_ORIGINS = [
        "http://localhost:8080",
        "http://localhost:5173",
        "http://127.0.0.1:8080",
        "http://127.0.0.1:5173",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOWED_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request/Response Models
class TextParseRequest(BaseModel):
    text: str

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    user_context: Optional[Dict[str, Any]] = None

class AnalysisResponse(BaseModel):
    status: str
    message: str
    user_id: str
    analysis_started: str
    estimated_completion_minutes: int

class StatusResponse(BaseModel):
    user_id: str
    status: str
    agents_completed: int
    total_agents: int
    last_updated: str

def _get_job(user_id: str) -> Optional[Dict[str, Any]]:
    """Latest analysis_jobs row for a user, or None if they've never run one."""
    rows = fetch_records("analysis_jobs", user_id, order_by="updated_at.desc", limit=1)
    return rows[0] if rows else None


def _start_job(user_id: str) -> Dict[str, Any]:
    """
    Resets (or creates) the one job row for this user to a fresh in_progress
    state and returns it, synchronously, before the background task starts --
    so a status poll right after /api/analyze returns sees real state
    immediately, matching the old in-memory dict's behavior.
    """
    now = datetime.now().isoformat()
    existing = _get_job(user_id)
    fields = {
        "status": "in_progress",
        "agents_completed": 0,
        "total_agents": 9,
        "started_at": now,
        "updated_at": now,
        "error_message": None,
    }
    if existing:
        return update_record("analysis_jobs", existing["id"], fields)
    return write_record("analysis_jobs", {**fields, "user_id": user_id})


class AgentOrchestrator:
    """
    Orchestrates the 9 agents for a user, in an order that matters now:
    budget/volatility/tax/risk/savings/bills/goals all compute from real
    transaction data independently, but recommendation_agent and
    action_agent read those agents' freshly-written rows (risk_assessments,
    budgets, savings_goals, tax_records, bills) to ground their output in
    real numbers -- so they must run last.
    """

    def __init__(self, mcp_servers: str = ".mcp.json"):
        self.mcp_servers = mcp_servers
        self.agents = {
            "budget": BudgetAnalysisAgent(mcp_servers),
            "volatility": VolatilityForecasterAgent(mcp_servers),
            "tax": TaxComplianceAgent(mcp_servers),
            "risk": RiskAssessmentAgent(mcp_servers),
            "savings": SavingsInvestmentAgent(mcp_servers),
            "bills": BillPaymentAgent(mcp_servers),
            "goals": FinancialGoalsAgent(mcp_servers),
            "recommendation": RecommendationAgent(mcp_servers),
            "action": ActionExecutionAgent(mcp_servers),
        }

    async def run_all_agents(self, user_id: str) -> Dict[str, Any]:
        """Run all 9 agents in sequence"""

        logger.info(f"Starting analysis for user {user_id}")

        job = _get_job(user_id)
        job_id = job["id"] if job else None

        results = {
            "user_id": user_id,
            "analysis_started": datetime.now().isoformat(),
            "agents": {}
        }

        agent_names = [
            ("budget", "Budget Analysis"),
            ("volatility", "Volatility Forecaster"),
            ("tax", "Tax & Compliance"),
            ("risk", "Risk Assessment"),
            ("savings", "Savings & Investment"),
            ("bills", "Bill Payment"),
            ("goals", "Financial Goals"),
            ("recommendation", "Recommendation Engine"),
            ("action", "Action Execution"),
        ]

        try:
            for idx, (agent_key, agent_name) in enumerate(agent_names, 1):
                logger.info(f"[{idx}/9] Running {agent_name} Agent...")

                try:
                    result = await self.agents[agent_key].analyze_user(user_id)
                    results["agents"][agent_key] = result
                    logger.info(f"{agent_name} completed")
                except Exception as e:
                    logger.error(f"{agent_name} failed: {str(e)}", exc_info=True)
                    results["agents"][agent_key] = {
                        "success": False,
                        "error": str(e)
                    }

                if job_id:
                    update_record("analysis_jobs", job_id, {
                        "agents_completed": idx,
                        "updated_at": datetime.now().isoformat(),
                    })

            results["analysis_completed"] = datetime.now().isoformat()

            if job_id:
                update_record("analysis_jobs", job_id, {
                    "status": "completed",
                    "updated_at": datetime.now().isoformat(),
                })

            logger.info(f"Analysis complete for user {user_id}")

        except Exception as e:
            # Catches failures outside any single agent's own try/except
            # (e.g. the analysis_jobs update call itself failing) so the job
            # row reflects reality instead of getting stuck "in_progress"
            # forever.
            logger.error(f"Analysis run failed for user {user_id}: {str(e)}", exc_info=True)
            if job_id:
                update_record("analysis_jobs", job_id, {
                    "status": "failed",
                    "error_message": str(e),
                    "updated_at": datetime.now().isoformat(),
                })
            raise

        return results


# Global orchestrator instance
orchestrator = AgentOrchestrator()


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "service": "ArthaSetu - Financial Analysis Backend",
        "status": "running",
        "version": "1.0.0",
        "agents": 9
    }


@app.post("/api/analyze", response_model=AnalysisResponse)
@limiter.limit("1/minute")
async def trigger_analysis(
    request: Request,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
):
    """
    Trigger complete financial analysis for the authenticated caller.

    user_id comes from the verified Supabase JWT, not a client-supplied
    value, so a caller can only ever trigger analysis for themselves.
    Analysis runs in background; frontend fetches results directly from
    the database. Rate-limited to 1/minute per user (in addition to the
    409-on-already-in-progress check below) -- a full analysis run is
    expensive enough that nothing legitimate needs to trigger it faster.
    """

    # Check if analysis already in progress
    existing = _get_job(user_id)
    if existing and existing["status"] == "in_progress":
        raise HTTPException(
            status_code=409,
            detail=f"Analysis already in progress for user {user_id}"
        )

    # Reset/create the job row synchronously so a status poll right after
    # this call sees real state immediately, then run the agents in the
    # background.
    _start_job(user_id)
    background_tasks.add_task(orchestrator.run_all_agents, user_id)

    return AnalysisResponse(
        status="started",
        message=f"Analysis started for user {user_id}. Results will be written to database.",
        user_id=user_id,
        analysis_started=datetime.now().isoformat(),
        estimated_completion_minutes=2
    )


@app.get("/api/status/{user_id}", response_model=StatusResponse)
async def get_analysis_status(
    user_id: str,
    current_user: str = Depends(get_current_user_id),
):
    """
    Get current status of analysis for a user

    Frontend can poll this to show progress. Callers may only read their
    own status.
    """

    if current_user != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to view this user's status")

    job = _get_job(user_id)
    if not job:
        raise HTTPException(
            status_code=404,
            detail=f"No analysis found for user {user_id}"
        )

    return StatusResponse(
        user_id=user_id,
        status=job["status"],
        agents_completed=job["agents_completed"],
        total_agents=job["total_agents"],
        last_updated=job["updated_at"]
    )


@app.get("/api/agent-logs/{user_id}")
async def get_agent_logs(
    user_id: str,
    current_user: str = Depends(get_current_user_id),
):
    """
    Get detailed agent execution logs for a user.

    Returns all agent responses and outputs for frontend display. Callers
    may only read their own logs; the 403 check below is what makes it safe
    to then read with the service-role key (which bypasses RLS) on their
    behalf.
    """
    if current_user != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to view this user's logs")

    try:
        import requests

        url = f"{os.environ['SUPABASE_URL']}/rest/v1/agent_logs"
        service_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
        headers = {
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
        }

        params = {
            "user_id": f"eq.{user_id}",
            "order": "created_at.desc",
            "limit": "20"
        }

        response = requests.get(url, headers=headers, params=params, timeout=10)
        response.raise_for_status()

        logs = response.json()

        return {
            "user_id": user_id,
            "logs": logs,
            "total_count": len(logs)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch agent logs: {str(e)}")


@app.post("/api/analyze-sync")
@limiter.limit("1/minute")
async def trigger_analysis_sync(request: Request, user_id: str = Depends(get_current_user_id)):
    """
    Trigger analysis and wait for completion (synchronous)

    Use /api/analyze (async) for production
    """

    try:
        results = await orchestrator.run_all_agents(user_id)
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/")
def root():
    return {
        "status": "healthy",
        "service": "ArthaSetu Unified Backend",
        "version": "2.0.0",
        "endpoints": {
            "health": "/health",
            "api_health": "/api/health",
            "chat": "/api/chat",
            "parse_image": "/api/parse-image",
            "parse_voice": "/api/parse-voice",
            "parse_text": "/api/parse-text",
            "analyze": "/api/analyze",
            "analyze_sync": "/api/analyze-sync",
            "status": "/api/status/{user_id}"
        }
    }


@app.get("/health")
def liveness_check():
    """Render and deployment liveness probe."""
    return {"status": "ok", "service": "ArthaSetu Unified Backend"}


@app.get("/api/health")
async def health_check():
    """Detailed health check for frontend & monitoring."""
    return {
        "status": "healthy",
        "service": "ArthaSetu Unified Backend",
        "groq_keys_available": len(parser.groq_keys),
        "google_keys_available": len(parser.google_keys),
        "openrouter_keys_available": len(parser.openrouter_keys),
        "agents": {
            "budget": "ready",
            "volatility": "ready",
            "tax": "ready",
            "risk": "ready",
            "savings": "ready",
            "bills": "ready",
            "goals": "ready",
            "recommendation": "ready",
            "action": "ready",
        },
        "database": "supabase_rest",
        "timestamp": datetime.now().isoformat()
    }


@app.post("/api/parse-image")
async def parse_image(file: UploadFile = File(...)):
    """Parse receipt/bill image using AI multimodal vision."""
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
    """Parse an audio recording (WAV, MP3, WEBM, OGG) to extract transaction details."""
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
    """Parse spoken transcript or typed text into a structured transaction."""
    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="Text field cannot be empty")
    return parser.parse_text(req.text)


@app.post("/api/chat")
def chat(req: ChatRequest):
    """
    ArthaSetu Website AI Assistant Chat endpoint.
    Strictly answers questions related to ArthaSetu and gig worker personal finance.
    Uses Groq LPU dedicatedly for instant ~0.4s response and zero hallucinations.
    """
    if not req.messages:
        raise HTTPException(status_code=400, detail="Messages list cannot be empty")

    dict_messages = [{"role": m.role, "content": m.content} for m in req.messages]
    result = parser.chat(dict_messages, req.user_context)
    return result


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "0.0.0.0")

    print("\n" + "="*60)
    print("Starting ArthaSetu Unified Backend (Analysis + Chatbot + OCR)")
    print(f"Listening on {host}:{port}")
    print("="*60 + "\n")

    uvicorn.run(
        app,
        host=host,
        port=port,
        log_level="info"
    )
