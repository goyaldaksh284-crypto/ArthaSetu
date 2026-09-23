# ArthaSetu - Free Tier Deployment Guide (Vercel + Render)

This guide provides step-by-step instructions for deploying **ArthaSetu** completely **100% FREE** with zero monthly infrastructure cost:
- **Frontend (SPA):** Deployed to **Vercel Hobby Tier** ($0/month, unlimited bandwidth, global CDN).
- **Backend (FastAPI):** Deployed to **Render Free Web Service** ($0/month, 750 free instance hours/month, 512MB RAM).
- **AI Chatbot:** Powered dedicatedly by **Groq LPU API** (ultra-fast, free tier inference).

---

## Architecture & Free Tier Specs

| Component | Platform | Free Tier Resource Limit | ArthaSetu Actual Usage |
| :--- | :--- | :--- | :--- |
| **Frontend** | Vercel | 100 GB bandwidth / mo | ~5 MB static assets, cached globally |
| **Backend** | Render | 512 MB RAM, 0.1 CPU, 750 hrs/mo | **~42 MB RAM** (ultra-lean FastAPI) |
| **Chatbot AI** | Groq LPU | Free Developer Tier RPM/TPM | ~0.4s response latency, zero GPU cost |
| **Database** | Supabase | 500 MB DB, 50k monthly active users | Free PostgreSQL + Auth |

> **Key Optimization:** Heavy ML frameworks like PyTorch (`torch`, `transformers`) requiring >2 GB RAM were eliminated. ArthaSetu uses high-speed cloud APIs (Groq LPU) and lightweight libraries (`fastapi`, `requests`, `pillow`), staying well under Render's 512MB RAM ceiling and eliminating Out-of-Memory (OOM) crashes.

---

## Part 1: Deploy Backend to Render (Free Tier)

### Step 1: Push Code to GitHub
Ensure all recent changes are committed and pushed to your GitHub repository:
```bash
git add .
git commit -m "Configure Vercel and Render free tier compatibility"
git push origin main
```

### Step 2: Create Web Service on Render
1. Go to [Render Dashboard](https://dashboard.render.com/) and sign in.
2. Click **New +** -> **Web Service**.
3. Connect your GitHub repository: `Kamai-Financial-Companion`.
4. Configure the Web Service settings:
   - **Name:** `arthasetu-api` (or your preferred name)
   - **Region:** Singapore (`singapore`) or Frankfurt / Ohio (pick nearest to your users)
   - **Branch:** `main`
   - **Root Directory:** *(Leave blank to use repo root)*
   - **Runtime:** `Python 3`
   - **Build Command:**
     ```bash
     pip install -r requirements.txt
     ```
   - **Start Command:**
     ```bash
     uvicorn backend.main:app --host 0.0.0.0 --port $PORT
     ```
   - **Instance Type:** Select **Free** ($0/month, 512 MB RAM)

### Step 3: Configure Render Environment Variables
Under the **Environment Variables** section in Render, add:

| Key | Value | Description |
| :--- | :--- | :--- |
| `GROQ_API_KEY` | `gsk_...` | **Required.** Your Groq API key for the dedicated AI chatbot |
| `PYTHON_VERSION` | `3.10.12` | Python version for Render |
| `ENVIRONMENT` | `production` | Deployment environment |
| `CORS_ORIGINS` | `https://*.vercel.app,http://localhost:8080` | Allowed origins (auto-handles Vercel previews) |
| `SUPABASE_URL` | `https://your-project.supabase.co` | (Optional) Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | `your-service-role-key` | (Optional) Supabase server key |

*(Note: Render sets the `$PORT` environment variable automatically, and `backend/main.py` binds to it.)*

### Step 4: Deploy & Verify
1. Click **Create Web Service**.
2. Wait 2-3 minutes for the build to finish.
3. Once live, Render will assign you a URL like:
   `https://arthasetu-api.onrender.com`
4. Test the health endpoint in your browser:
   `https://arthasetu-api.onrender.com/health`
   Should return: `{"status": "healthy", "service": "ArthaSetu Unified Backend"}`

---

## Part 2: Deploy Frontend to Vercel (Free Tier)

### Step 1: Import Project into Vercel
1. Go to [Vercel Dashboard](https://vercel.com/dashboard) and sign in with GitHub.
2. Click **Add New...** -> **Project**.
3. Select your GitHub repository: `Kamai-Financial-Companion`.

### Step 2: Configure Vercel Project Settings
In the Project Configuration screen:
- **Framework Preset:** `Vite`
- **Root Directory:** Click **Edit** and choose `frontend`
- **Build Command:** `npm run build` (Default)
- **Output Directory:** `dist` (Default)
- **Install Command:** `npm install` (Default)

### Step 3: Add Vercel Environment Variables
Under **Environment Variables**, add the following:

| Key | Value | Notes |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | `https://arthasetu-api.onrender.com` | Replace with your actual Render URL |
| `VITE_PARSER_API_URL` | `https://arthasetu-api.onrender.com/api` | API subpath for transactions & chat |
| `VITE_SUPABASE_URL` | `https://your-project.supabase.co` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | `your-anon-key` | Your Supabase public anonymous key |

> **Note on SPA Routing:** Both `vercel.json` (in root) and `frontend/vercel.json` are pre-configured with client-side rewrites (`{"source": "/(.*)", "destination": "/"}`), ensuring URLs like `/dashboard`, `/login`, and `/risk` work on page refresh without 404 errors.

### Step 4: Deploy
1. Click **Deploy**.
2. The Vite production build completes in ~25-30 seconds.
3. You will receive your live production URL:
   `https://your-project-name.vercel.app`

---

## Part 3: AI Chatbot & Anti-Hallucination Details

The ArthaSetu AI Financial Assistant uses Groq's low-latency LPU infrastructure with the following guardrails:

1. **Dedicated Groq Engine:**
   - Primary Model: `qwen/qwen3.8-27b`
   - Fallback Model: `openai/gpt-oss-120b`
   - Temperature: `0.1` (deterministic, fact-grounded responses)
   - Max Tokens: `500`

2. **Strict Guardrails:**
   - **In-Scope Topics:** ArthaSetu website features, Team Invictus information, gig income volatility forecasting, Section 87A / 44ADA FY 2024-25 tax guidance, adaptive daily budgets, risk score interpretation, welfare schemes (e-Shram, PM-SYM).
   - **Out-of-Scope Topics:** Generic coding, politics, celebrities, essays, poetry, non-ArthaSetu questions.
   - **Refusal Behavior:** Off-topic prompts are strictly declined with the standard ArthaSetu assistant disclaimer.

---

## Part 4: Managing Render Free Tier Cold Starts (Optional)

Render's free tier web services spin down to save resources after **15 minutes of inactivity**. When a new request arrives, a **cold start** takes ~30-50 seconds to boot up.

### Recommended Free Workarounds:
1. **Free Uptime Pinger:**
   - Sign up for a free account at [cron-job.org](https://cron-job.org/) or [UptimeRobot](https://uptimerobot.com/).
   - Set up an HTTP GET monitor targeting:
     `https://arthasetu-api.onrender.com/health`
   - Schedule it to ping once every **14 minutes**.
   - This keeps your Render container warm 24/7 without exceeding your 750 free monthly hours.
2. **Frontend Graceful Handling:**
   - The frontend chatbot has a built-in timeout and graceful offline fallback message if the backend is cold-starting.

---

## Deployment Checklist Summary

- [ ] Pushed latest changes to GitHub
- [ ] Render Web Service created (`pip install -r requirements.txt`, `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`)
- [ ] Added `GROQ_API_KEY` in Render environment variables
- [ ] Verified Render `/health` returns `200 OK`
- [ ] Vercel project created with Root Directory = `frontend`
- [ ] Set `VITE_API_BASE_URL` and `VITE_PARSER_API_URL` to Render URL in Vercel
- [ ] Tested live AI Chatbot on Vercel site
- [ ] Off-topic guardrail test passed (refuses non-ArthaSetu questions)
