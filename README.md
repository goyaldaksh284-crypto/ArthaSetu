<div align="center">

# ArthaSetu

### AI-Powered Financial Companion for India's Gig Workers

[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com)
[![Gemini](https://img.shields.io/badge/Gemini_2.5_Flash-Groq_fallback-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev)

<br/>

[Architecture](#architecture) | [Installation](#installation) | [API](#api) | [Testing & CI](#testing--ci) | [Security](#security)

</div>

---

## What this is

ArthaSetu is a financial companion for Indian gig workers (delivery riders, drivers, freelancers): daily-earnings tracking, feast/famine budgeting, presumptive-tax calculation, risk scoring, and savings/investment guidance, all computed from a user's real transaction history.

**Core design decision:** the numbers are computed by deterministic Python, not guessed by an LLM. Tax slabs, debt-to-income ratios, budget splits, and volatility forecasts come from real formulas in `backend/agents/finance_helpers.py`. The LLM (Gemini 2.5 Flash, with Groq as fallback) is used only to phrase already-computed numbers into a short plain-language explanation — never to invent the numbers themselves. This matters for a finance app: a hallucinated tax figure is a compliance problem, not a UX quirk.

## Architecture

Three independent pieces:

- **`frontend/`** — React 18 + TypeScript + Vite. Talks to Supabase directly for almost all reads/writes (Supabase's Row Level Security is the real access-control boundary, not the frontend). Calls the backend only to trigger an analysis run.
- **`backend/`** — FastAPI. `AgentOrchestrator` (`backend/main.py`) runs 9 agents (`backend/agents/*.py`) per user: `budget`, `volatility`, `tax`, `risk`, `savings`, `bills`, `goals`, `recommendation`, `action`. Each agent fetches real transaction/profile data, computes real numbers via `finance_helpers.py`, optionally asks the LLM for a one-line narrative, and writes the result to Supabase.
- **`supabase/`** — Postgres schema and RLS policies, as ordered migration files in `supabase/migrations/`.

```
User's browser
      |
      v
Frontend (React) --------------------> Supabase (Postgres + Auth)
      |                                   ^
      | POST /api/analyze                 | agents write results
      v                                   |
Backend (FastAPI) -----> 9 agents --------+
                            |
                            v
                    Gemini 2.5 Flash
                      (Groq fallback)
                    -- narrative text only --
```

See **[`CLAUDE.md`](./CLAUDE.md)** for the full architecture writeup, including the per-agent fetch→compute→narrate→write pattern, the reasoning behind the two agents that were removed as no-ops, and a running log of what's been hardened in each phase of work.

## Installation

### Prerequisites

- Node.js 18+
- Python 3.10+
- A Supabase project (free tier is fine)
- A Gemini API key ([aistudio.google.com](https://aistudio.google.com)) and a Groq API key ([console.groq.com](https://console.groq.com)) — both free-tier

### Database

Apply the migrations in `supabase/migrations/` **in filename order** via the Supabase SQL editor. They're idempotent (safe to re-run). This creates the schema and enables Row Level Security on every user-owned table.

In the Supabase dashboard, turn **off** "Confirm email" (Authentication → Sign In / Providers → Email) — signup uses a synthetic "shadow email" derived from the user's phone number, which has no real inbox to confirm from.

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows; source venv/bin/activate on macOS/Linux
pip install -r requirements.txt
```

Create `backend/.env` (see `backend/.env.example`):

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-legacy-jwt-secret     # HS256 fallback; primary path is JWKS
GOOGLE_API_KEY=your-gemini-key
GEMINI_MODEL=gemini-2.5-flash
GROQ_API_KEY=your-groq-key
GROQ_MODEL=llama-3.3-70b-versatile
```

```bash
python main.py     # FastAPI on :8000, docs at /docs
```

`main.py` does **not** need `autogen-agentchat`/`autogen-ext` installed to boot — those are kept in `requirements.txt` only for two orphaned files not wired into the live pipeline (see `CLAUDE.md`).

### Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env.local` (see `frontend/.env.example`):

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_BASE_URL=http://localhost:8000/api
```

```bash
npm run dev     # Vite on :8080 (falls back to :8081+ if 8080 is taken)
```

## API

Base URL `http://localhost:8000`. Every endpoint below except `/` and `/api/health` requires a real Supabase-issued bearer token — `user_id` is derived from the verified JWT, never trusted from the request.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Health check |
| GET | `/api/health` | Detailed agent status |
| POST | `/api/analyze` | Trigger analysis for the authenticated user (async, rate-limited to 1/minute) |
| POST | `/api/analyze-sync` | Trigger analysis and wait for completion (rate-limited to 1/minute) |
| GET | `/api/status/{user_id}` | Poll analysis progress |
| GET | `/api/agent-logs/{user_id}` | Recent agent execution logs |

Interactive docs at `http://localhost:8000/docs`.

## Testing & CI

```bash
cd backend
pip install -r requirements-test.txt
pytest tests/     # 29 tests against finance_helpers.py's deterministic calculations
```

GitHub Actions (`.github/workflows/`) runs this suite plus frontend lint/typecheck/build on every push and PR. There's no frontend test runner configured yet.

## Security

- **Auth**: real Supabase Auth (not a hand-rolled check). The UI collects a phone number; signup uses a synthetic email internally so phone-based login still works.
- **Data isolation**: Row Level Security enforced on every user-owned table (`auth.uid() = user_id`) — verified live, not just configured.
- **Backend**: every endpoint requires a JWT verified against Supabase's JWKS (ES256), with an HS256 shared-secret fallback for legacy-configured projects. A caller can only ever act on their own `user_id`.
- **Secrets**: environment variables only, gitignored. Agent writes use the service-role key (bypasses RLS on the user's behalf, server-side, after ownership is already verified); the frontend only ever uses the anon key.

## Project structure

```
ArthaSetu/
├── backend/
│   ├── agents/              # 9 live agents + finance_helpers.py (shared compute/fetch/write)
│   ├── tests/                # pytest suite for finance_helpers.py
│   ├── auth.py                # JWT verification
│   ├── llm_client.py          # Gemini/Groq client, narrative-only
│   └── main.py                 # FastAPI app, AgentOrchestrator
├── frontend/
│   └── src/
│       ├── pages/            # one file per route
│       ├── components/
│       └── services/database.ts   # primary Supabase data-access layer
├── supabase/migrations/     # ordered, idempotent SQL
├── .github/workflows/         # CI
└── CLAUDE.md                    # maintained architecture + phase-by-phase notes
```

`simple_api_server.py` (repo root) is a separate, unrelated service for OCR/voice receipt parsing — runs on port 8001, not part of the main backend.

## License

MIT.

