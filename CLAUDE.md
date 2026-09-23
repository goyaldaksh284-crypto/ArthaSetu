# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

ArthaSetu is a hackathon project: a financial companion for Indian gig workers. React/TypeScript frontend, a FastAPI backend that orchestrates 9 agents (`backend/agents/*.py`) computing real numbers from real transaction data (Gemini, with Groq as fallback, used only for narrative text), and Supabase (Postgres) as the database. The frontend talks to Supabase directly for most reads/writes and calls the backend only to trigger agent analysis runs.

## Commands

### Frontend (`frontend/`)
```bash
npm install
npm run dev        # Vite dev server on port 8080 (see vite.config.ts; README says 5173, that's stale)
npm run build       # production build
npm run build:dev   # development-mode build
npm run lint         # eslint .
```
No test runner is configured for the frontend.

### Backend (`backend/`)
```bash
python -m venv venv
venv\Scripts\activate        # Windows; source venv/bin/activate on WSL/Linux
pip install -r requirements.txt
python main.py                 # FastAPI app on port 8000, docs at /docs
```
Requires `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` (real data fetching/writes) and `GOOGLE_API_KEY`/`GROQ_API_KEY` (narrative text only) — see `backend/.env.example`. `main.py` no longer needs `autogen-agentchat`/`autogen-ext` installed to boot (see Architecture below) — only `fastapi`, `requests`, `PyJWT`, `python-dotenv` are actually exercised by the live pipeline. There is no automated test suite; agent modules are runnable individually as smoke tests, e.g.:
```bash
python agents/budget_agent.py   # runs analyze_user() against a hardcoded test user_id
```

### Standalone transaction-parser API (repo root)
```bash
pip install -r requirements.txt
uvicorn simple_api_server:app --reload --port 8000
```
This is a separate FastAPI app (OCR/voice receipt parsing via `transaction_parser.py`) and also defaults to port 8000 — don't run it at the same time as `backend/main.py`.

## Architecture

### Three services, not one backend
- **`backend/main.py`** — the live orchestrator. `AgentOrchestrator` runs 9 agent classes from `backend/agents/*.py` in sequence for a given `user_id` (`POST /api/analyze` for async/background, `/api/analyze-sync` to await inline, `/api/status/{user_id}` to poll).
- **`simple_api_server.py`** (repo root) — unrelated standalone service wrapping `transaction_parser.py` for OCR/voice-based transaction entry. Not invoked from `backend/`.
- **`backend/README.md` and `backend/configs/agent_config.yaml`** describe a *third*, older design ("Spare Backend": Claude Agent SDK + direct Postgres access via MCP, orchestrator + 3 sub-agents via the Task tool). That design is **not** what `main.py` runs — treat those two files as stale/aspirational, not as documentation of current behavior.

### How an agent actually runs (Phase 1 rewrite — `backend/agents/finance_helpers.py`)
As of the Phase 1 rewrite, agents compute real numbers in Python from real Supabase data — the LLM is used only to phrase already-computed facts as a short narrative string, never to invent the numbers themselves. Each agent's `analyze_user(user_id)`:
1. Fetches real rows via `finance_helpers.fetch_transactions()`/`fetch_profile()`/`fetch_records()` (direct Supabase REST calls using the service-role key, bypassing RLS since the caller's ownership was already verified by `backend/auth.py` upstream).
2. Computes real numbers via a `finance_helpers.compute_*()` function — e.g. `compute_risk_assessment()` (deterministic DTI/emergency-fund/volatility formula), `compute_gig_worker_tax()` (ported from `frontend/src/pages/Tax.tsx`'s New Regime FY24-25 slab + Section 87A rebate logic, so both surfaces agree), `compute_budgets()`, `compute_volatility_forecast()`, `compute_savings_plan()`, `compute_goal_projection()`.
3. Optionally calls `finance_helpers.generate_narrative()` (re-exported from `backend/llm_client.py`) with the already-computed numbers, to get 1-2 sentences of plain-language explanation. Gemini first, Groq fallback on any failure — see `llm_client.py`. **Gemini 2.5's "thinking" mode will silently return empty/truncated content unless `reasoning_effort: "none"` is set** (confirmed empirically; `llm_client.OpenAICompatibleClient` already sets this for Gemini calls) — worth knowing if you add a new narrative call path that bypasses this client.
4. Writes the result directly to its target table via `finance_helpers.write_record()`/`update_record()` — no LLM-JSON-parsing, no separate dispatch table. Each agent owns its own write.

**`backend/autogen_runtime.py` and its `run_autogen_mcp_task()`/`write_agent_output_to_db()` are now dead code for the live pipeline** — none of the 9 agents import it anymore (confirmed: `main.py` boots without `autogen-agentchat`/`autogen-ext` installed). It's kept only because two orphaned, not-wired-into-`main.py` files (`agents/financial_agent.py`, `agents/monitor.py`) still import it; if those get cleaned up too, `autogen_runtime.py` can go. `backend/llm_client.py` holds the actual live LLM client now (extracted out of `autogen_runtime.py` specifically so `finance_helpers.py` doesn't need the AutoGen dependency stack).

**Removed agents** (audited and found to be pure no-ops or fully redundant, not just "needs fixing"): `context_agent` (never in the DB-write dispatch allowlist even before this rewrite — burned an LLM call and wrote nothing), `knowledge_agent` (same), `pattern_agent` (targeted a table, `income_patterns`, that was never actually queried by the frontend — `Stats.tsx` computes weekday/volatility patterns client-side from raw transactions directly — and its function is now provided for free by `finance_helpers.compute_income_expense_stats()`, which every other agent already calls).

**Orchestration order matters now**: `budget`/`volatility`/`tax`/`risk`/`savings`/`bills`/`goals` each compute independently from real transactions, but `recommendation` and `action` read those agents' freshly-written rows (via `finance_helpers.fetch_records()`) to ground their output in real numbers — so they run last (see `AgentOrchestrator.agents` dict order in `main.py`).

**When adding a new agent**: follow the pattern above (fetch → compute in a `finance_helpers.compute_*()` function → optionally narrate → `write_record()`), not the old LLM-produces-the-whole-JSON pattern.

### Frontend data flow
- `src/lib/supabase.ts` creates the Supabase client used by most of the app.
- `src/services/database.ts` (~1500 lines) is the primary data-access layer — direct Supabase table reads/writes, one interface per table, mirroring the schema in `docs/DATABASE_TABLES_DOCUMENTATION.md`.
- `src/services/spareBackend.ts` and `src/services/api.ts` call the FastAPI backend (`VITE_API_BASE_URL`/`VITE_SPARE_API_URL`, default `http://localhost:8000/api`) purely to kick off/poll agent analysis — not for CRUD.
- Auth is Supabase Auth (see "Auth & database" below) — `src/contexts/AppContext.tsx` derives `isAuthenticated`/`user` from the real Supabase session via `onAuthStateChange`, mirroring `user_id` into `localStorage` so the ~1500 lines of CRUD in `database.ts` (which read it directly) didn't need to change. `ProtectedRoute` gates purely on `AppContext`'s `isAuthenticated`.
- Routing (`src/App.tsx`) is flat: public routes (`/`, `/features`, `/phases`, `/login`, `/signup`) plus protected routes each individually wrapped in `<ProtectedRoute><MainLayout>...</MainLayout></ProtectedRoute>` — there's no nested/layout route group, so a new protected page means one more `<Route>` block following the existing pattern.

### Auth & database (Phase 0 security rebuild — read this before touching auth/DB code)
As of the Phase 0 rebuild, auth and data isolation are real:
- **Auth is Supabase Auth**, not the old custom phone/password check. The UI still collects a phone number, but signup/login use a synthetic "shadow email" (`{phone}@users.arthasetu.app`, see `shadowEmail()` in `frontend/src/services/database.ts`) as the actual Supabase Auth identity. A DB trigger (`handle_new_user()` in `supabase/migrations/20260811000100_profiles.sql`) auto-creates the matching `profiles` row from signup metadata. Two gotchas confirmed empirically against the live project: (1) Supabase's signup validator rejects reserved/placeholder domains (`.internal`, `.test`, `.invalid`, `.example`, `example.com`) with `email_address_invalid` — it doesn't do DNS/MX lookups, so any other-looking domain passes; (2) the Supabase project's Auth setting **"Confirm email" must be OFF** (Authentication → Sign In / Providers → Email), since these shadow addresses have no real inbox to click a confirmation link in — with it on, signup succeeds but the account can never be confirmed/logged into.
- **RLS is enabled and enforced** on every user-owned table (`supabase/migrations/20260811000400_rls_policies.sql`) — `auth.uid() = user_id` on every row. `government_schemes` is the one public-read reference table.
- **Backend endpoints require a verified Supabase JWT** (`backend/auth.py`'s `get_current_user_id` dependency) — `user_id` is derived from the token, never trusted from the request body/path without an ownership check.
- Schema lives in `supabase/migrations/` (ordered, idempotent SQL files) — apply them via the Supabase SQL editor in filename order. The old root-level `fix_users_table.sql`/`fix_auth_rls.sql`/`ensure_users_table.sql`/`supabase_new_tables.sql` are gone; they were three competing, unordered schemas (one of which `DROP TABLE ... CASCADE`d on every re-run).
- Secrets come from env vars only: `frontend/.env.local` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) and `backend/.env` (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `GOOGLE_API_KEY`, `GROQ_API_KEY`). See `frontend/.env.example`/`backend/.env.example`. Agent writes in `finance_helpers.write_record()`/`update_record()` use the **service-role** key (bypasses RLS, since agents write on a user's behalf server-side) — never the anon key.
- Done as of the Phase 1 rewrite (see the "How an agent actually runs" section above): the 9 remaining agents fetch real transaction/profile data and compute real numbers instead of LLM-fabricating them.
- Done as of the Phase 2 UI fixes (frontend-only, no backend changes):
  - **Actions page** (`frontend/src/pages/Actions.tsx`): Approve/Pause/Request Reversal now write real status changes via the new `db.actions.updateStatus()` (`frontend/src/services/database.ts`). This also fixed a real bug found while wiring it up — every action card was keying/acting on `action.id`, but `executed_actions`' primary key is `action_id` (see `supabase/migrations/20260811000200_domain_tables.sql`); approve/pause were previously silent no-ops passing `undefined`.
  - **RiskDashboard** (`frontend/src/pages/RiskDashboard.tsx`): the catch block no longer fabricates a fake "medium risk, 5.5/10" assessment on fetch failure. `db.riskAssessments.getLatest()` already distinguishes "no row yet" (resolves `null`, expected for a new user) from a real fetch error (throws) — the UI now does too: null shows the existing "no assessment yet" empty state, a thrown error shows a distinct error state with a Try Again button.
  - **Savings page** (`frontend/src/pages/Savings.tsx`): "Start Investing" now creates a real `executed_actions` row via `db.actions.create()` (action_type `investment`) and routes to the Actions page to approve it — consistent with the rest of the app's pattern of proposing actions for explicit user approval rather than moving money directly (there's no real brokerage integration to execute against).
  - **Profile page** (`frontend/src/pages/Profile.tsx`): password change is real — `db.auth.changePassword()` re-verifies the current password via `supabase.auth.signInWithPassword()` (Supabase's `updateUser()` alone doesn't require it, so skipping this would make "Current Password" decorative) before calling `supabase.auth.updateUser({ password })`.
  - All four verified live against the real Supabase project (RLS-scoped update via a real user token, cross-user isolation, password round-trip) — see commit history for the throwaway-test-user verification approach established in Phase 1.

### Other known rough edges
- `docs/DATABASE_TABLES_DOCUMENTATION.md` still documents `income_patterns` — it was never created (see the removed-agents note above) and never will be; the doc's own top note already flags tables like this as aspirational, not live schema.

### Phase 3 (deployment readiness)
- **Port collision resolved**: `backend/main.py` owns 8000, `simple_api_server.py` owns 8001 (`frontend/src/components/TransactionInputCard.tsx`'s `VITE_PARSER_API_URL` already pointed at 8001; the code's own `if __name__ == "__main__"` block already bound 8001). The actual bug was that `simple_api_server.py`'s module docstring and two docs (`docs/QUICK_START_PARSER.md`, `docs/INSTALL_AND_SETUP.md`) still documented `uvicorn simple_api_server:app --port 8000` — anyone following that literally would have collided with `backend/main.py`. Fixed in all three places; both servers can now run simultaneously as documented.
- **Production logging**: the 9 live agents, `main.py`'s orchestrator, and `llm_client.py` used bare `print()` for runtime status/errors. Replaced with Python's `logging` module — `backend/agents/finance_helpers.py` calls `logging.basicConfig()` once at import time (every agent already imports it, so this covers the whole pipeline without touching each file's entrypoint), configurable via `LOG_LEVEL` (defaults to `INFO`). Errors now log with `exc_info=True` for real stack traces. Each agent's own `if __name__ == "__main__":` smoke-test block (`python agents/budget_agent.py`) still uses `print()` for its result dump — that's deliberate, it's developer-facing CLI output, not a production runtime path.
- **Not yet done**: final CORS origin audit for the actual production frontend domain (currently defaults to `localhost:8080` via `CORS_ALLOWED_ORIGINS`, correct for dev but must be set explicitly at deploy time), and no hosting target has been chosen yet for frontend/backend/DB.

### Phase 4 (production hardening)
A senior-architect-level review after Phase 3 found the security/correctness axis solid but the operational-resilience axis still hackathon-grade: job state lived only in memory, there was no test suite, no CI, and a miscalibrated rate limiter made every analysis run take ~8 minutes. All fixed and verified live:
- **Durable job state**: `backend/main.py`'s old `analysis_status: Dict = {}` (lost on restart) is now the real `analysis_jobs` table (`supabase/migrations/20260815000100_analysis_jobs.sql`, one row per user, same owner-RLS pattern as every other table). `_get_job()`/`_start_job()` in `main.py` use the existing generic `finance_helpers.fetch_records`/`write_record`/`update_record` — no new DB-access code. Verified live: killed the backend process mid-analysis, started a completely fresh process, confirmed `/api/status/{user_id}` still returned the real last-known state instead of 404ing.
- **The real bottleneck wasn't `sleep(2)` between agents — it was `llm_client.py`'s `RATE_LIMIT_DELAY`.** It was set to 60s (checked the real free-tier quotas: Gemini 2.5 Flash allows 10 req/min, Groq's llama-3.3-70b-versatile allows 30/min), so every narrative call after the first in a run was forced to wait ~55-60s regardless of agent scheduling — this is why `estimated_completion_minutes: 8` in the old API response was accurate, not defensive. Lowered to `7` (margin under Gemini's tighter 10 RPM). This alone cut a real, live-timed 9-agent run from ~480s to **73.8s** — confirmed the originally-planned fix (`asyncio.gather` agent concurrency) would NOT have moved this number, since narrative calls would still have been serialized behind the same shared rate limiter; the one-line constant fix was correctly prioritized over building thread-pool concurrency + the cross-thread lock that would have been needed around the shared `last_call_time` global.
- **Test suite**: `backend/tests/test_finance_helpers.py`, 29 tests against the pure `compute_*` functions in `finance_helpers.py` (tax slabs, DTI/risk scoring, budgets, volatility forecast, savings plan, goal projection) — realistic + edge case per function, zero mocking (they're pure functions, no network/DB). `backend/requirements-test.txt` is separate from `requirements.txt` so CI doesn't install the unused AutoGen packages. Deliberately does NOT test `write_record`/`fetch_transactions`/agents' `analyze_user()` — those are thin Supabase REST wrappers already verified live repeatedly; mocking them would test the mock, not reality.
- **CI**: `.github/workflows/backend-tests.yml` (pytest) and `.github/workflows/frontend-checks.yml` (lint, tsc, build) — not yet exercised by an actual push/PR, only validated as syntactically correct YAML plus every step run locally.
- **Per-user rate limiting**: `/api/analyze` and `/api/analyze-sync` are now rate-limited via `slowapi`, keyed on the verified `user_id` from `auth.get_user_id_for_rate_limit()` (re-verifies the bearer token directly from the raw `Request`, since slowapi's key function runs before FastAPI dependency injection) — not IP, since shared carrier-NAT IPs are common. Verified live: second trigger within the same minute for the same user gets a real 429; a different user's trigger in the same window is unaffected.
- **Not yet done** (unchanged from Phase 3): hosting target still not chosen; Dockerfile/deployment and error-tracking/APM (Sentry or equivalent) both deferred pending that decision, since they need either a hosting choice or a new external account.
