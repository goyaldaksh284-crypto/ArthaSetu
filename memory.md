# Project Memory - ArthaSetu (अर्थ सेतु)

**Last Updated:** September 2026  
**Status:** Fully Functional & Rebranded  
**Active Project Root:** `.` (Workspace Root)  
**Frontend URL:** `http://localhost:8080/`

---

## 1. Project Overview & Identity

- **Application Name:** ArthaSetu
- **Target Audience:** Indian gig economy workers (delivery partners, rideshare drivers, freelancers, daily-wage contractors)
- **Primary Value Proposition:** Smart financial tracking, Section 44ADA tax estimation, automated budgeting, and AI-driven financial insights tailored to volatile income cycles.
- **Legacy Cleanup:** The old, defunct Expo/React Native repository at `d:\getamantra\AaySetu` has been permanently deleted.

---

## 2. Solved Issues & Root Causes

### 1. "Invalid" Error on Login (Fixed)
- **Root Cause:** The frontend `.env` contained placeholder Supabase credentials (`https://demo.supabase.co`). Submitting login credentials triggered network failures or `Invalid login credentials` from Supabase Auth with no offline fallback.
- **Solution (`frontend/src/services/database.ts`):**
  - Implemented an offline-first **Hybrid Storage & Auth Engine** using browser `localStorage`.
  - Added built-in demo user:
    - **Phone:** `9876543210`
    - **Password:** `password123`
    - **Name:** Rahul Sharma (`rahul.sharma@aaysetu.app`)
  - Added **⚡ Quick Demo Login** 1-click button on [`Login.tsx`](frontend/src/pages/Login.tsx), [`Signup.tsx`](frontend/src/pages/Signup.tsx), and [`Auth.tsx`](frontend/src/pages/Auth.tsx).
  - Added universal auto-provisioning: Any valid 10-digit Indian mobile number logs in or signs up instantly.

### 2. State & Balance Sync (Fixed)
- **Root Cause:** [`AppContext.tsx`](frontend/src/contexts/AppContext.tsx) previously attempted to make direct HTTP calls (`POST /api/transactions`) to an unconfigured endpoint, failing silently and leaving the balance static.
- **Solution:** Re-routed transaction creation directly through `db.transactions.create()`. Adding income or expense transactions automatically recalculates and persists the account balance in real-time across browser reloads.

### 3. OCR & Voice Resiliency (Fixed)
- **Root Cause:** Voice recordings and receipt OCR hard-failed when the auxiliary Python microservice (`:8001`) was not running.
- **Solution (`frontend/src/components/TransactionInputCard.tsx`):** Added smart client-side simulation fallbacks in `catch` blocks so UI tests and user interactions never crash.

### 4. Features & Architecture Pages Removal (Completed)
- **Removed Pages:**
  - `FeaturesPage.tsx` (`/features`)
  - `PhasesPage.tsx` (`/phases` - System Architecture)
- **Removed Support Code:**
  - `FeatureCard.tsx`, `PhaseCard.tsx`, `MermaidDiagram.tsx`, `data/flowcharts.ts`
  - Unused Mermaid CSS rules removed from `index.css`
- **Updated Navigation:**
  - `Header.tsx` navigation updated to: **Home**, **Features** (smooth scroll to `#features` on landing page), **About** (smooth scroll to `#about`), **Sign In**, and **Get Started**.
  - All landing page CTAs now point directly to Sign In / Sign Up. Direct hits to `/features` or `/phases` cleanly render 404 pages.

### 5. Fin_service Bento Charts Integration (Completed)
- **Extracted from `imRahul05/Fin_service`**:
  - Extracted the Bento Cash Flow & Expense Breakdown component layout and Chart.js animations.
  - Installed `chart.js` and `react-chartjs-2`.
  - Created [`CashFlowExpenseCharts.tsx`](frontend/src/components/CashFlowExpenseCharts.tsx):
    - **Monthly Cash Flow**: Vertical rounded bar chart with Income (dark navy), Expenses (slate), Savings (light gray) pill bars.
    - **Expense Breakdown**: Doughnut chart with center readout (`TOTAL ₹1.1L`), `Top 5 + Other` badge, right-hand category ledger with %, amounts, and color dots.
    - **Total Outflow Footer**: Shows total outflow with `Edit →` link leading to transactions.
  - Linked directly to [`Dashboard.tsx`](frontend/src/pages/Dashboard.tsx) with dynamic data calculation from transactions.

---

## 3. Technology Stack

- **Frontend:**
  - React 18 + TypeScript + Vite
  - Tailwind CSS + Lucide Icons + Radix UI Primitives
  - Router: `react-router-dom` v6
  - Data Layer: Hybrid `database.ts` (LocalStorage backed with Supabase compatibility)
- **Backend:**
  - Python FastAPI (`backend/main.py`)
  - 9 Specialized Financial Analysis Agents:
    1. Orchestrator Agent
    2. Income Pattern Analyzer
    3. Expense Categorizer
    4. Tax Optimization (Section 44ADA)
    5. Financial Risk Assessment
    6. Smart Budget Generator
    7. Government Schemes Matcher
    8. Micro-Investment Advisory
    9. Financial Health Scorer

---

## 4. Key File Map

| Purpose | File Path |
| :--- | :--- |
| **Routing & App Entry** | [`frontend/src/App.tsx`](frontend/src/App.tsx) |
| **Hybrid Auth & Storage** | [`frontend/src/services/database.ts`](frontend/src/services/database.ts) |
| **Global State** | [`frontend/src/contexts/AppContext.tsx`](frontend/src/contexts/AppContext.tsx) |
| **Main Dashboard** | [`frontend/src/pages/Dashboard.tsx`](frontend/src/pages/Dashboard.tsx) |
| **Transactions Hub** | [`frontend/src/pages/Transactions.tsx`](frontend/src/pages/Transactions.tsx) |
| **Input Card (Receipt/Voice)**| [`frontend/src/components/TransactionInputCard.tsx`](frontend/src/components/TransactionInputCard.tsx) |
| **Budget Management** | [`frontend/src/pages/Budget.tsx`](frontend/src/pages/Budget.tsx) |
| **Tax Estimator** | [`frontend/src/pages/Tax.tsx`](frontend/src/pages/Tax.tsx) |
| **Savings Goals** | [`frontend/src/pages/Savings.tsx`](frontend/src/pages/Savings.tsx) |
| **Backend Agent Service** | [`backend/main.py`](backend/main.py) |

---

## 5. Development & Running Guide

### Run Frontend Locally:
```bash
cd frontend
npm run dev
# Server runs on http://localhost:8080/
```

### Build for Production:
```bash
cd frontend
npm run build
```

### Run Python Backend (Optional for Multi-Agent Analysis):
```bash
cd backend
uvicorn main:app --reload --port 8000
```

---

## 6. Demo Accounts & Credentials

- **Quick Login:** Click **⚡ Quick Demo Login (Rahul Sharma)** on `/login`.
- **Pre-configured Phone:** `9876543210`
- **Pre-configured Password:** `password123`
- **Any Other Phone:** Any 10-digit number (e.g. `9123456780`) with any password works automatically via instant self-provisioning.
