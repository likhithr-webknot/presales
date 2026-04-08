# Presales Orchestrator

Webknot's internal AI-driven presales lifecycle platform. AMs describe a client opportunity in plain language — the system autonomously researches, writes, packages, and routes collateral through approval gates.

---

## Running Locally for Demo

### What you need
- Docker + Docker Compose (for Postgres, Redis, MinIO)
- Node.js 20+
- Python 3.11+
- API keys: OpenAI, Anthropic, Gemini, Tavily
- Google OAuth credentials (for SSO login)

---

### Step 1 — Clone & copy env

```bash
cd projects/presales-orchestrator
cp .env.example .env
```

Edit `.env` and fill in:

```env
# Required API keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=AIza...
TAVILY_API_KEY=tvly-...

# Google SSO (create at console.cloud.google.com)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

# JWT — generate any 32+ char random string
JWT_SECRET=some-long-random-string-at-least-32-chars

# Internal secret — shared between Node and Python
AI_INTERNAL_SECRET=another-long-random-string-at-least-32-chars

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173

# Local AI service URL (running outside Docker)
AI_SERVICE_URL=http://localhost:8001

# Email — optional for demo (set EMAIL_ENABLED=false to skip)
EMAIL_ENABLED=false
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=your@email.com
EMAIL_SMTP_PASS=your-app-password
```

---

### Step 2 — Start infrastructure (Docker)

```bash
# Start only Postgres, Redis, MinIO (not the full app containers)
docker compose up postgres redis minio -d
```

Wait ~10s for them to be healthy. Then verify:

```bash
docker compose ps
# All three should show "healthy"
```

---

### Step 3 — Backend setup

```bash
cd backend
npm install

# Run DB migrations
npx prisma migrate dev --name init

# Seed the database (creates admin user + system config defaults)
npm run db:seed

# Start the backend
npm run dev
# → Running on http://localhost:3000
```

---

### Step 4 — Python AI Service setup

```bash
cd ai-service

# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start the service (reads .env from project root automatically)
BACKEND_URL=http://localhost:3000 uvicorn main:app --host 0.0.0.0 --port 8001 --reload
# → Running on http://localhost:8001
```

---

### Step 5 — Frontend setup

```bash
cd frontend
npm install
npm run dev
# → Running on http://localhost:5173
```

---

### Step 6 — Open the app

1. Navigate to **http://localhost:5173**
2. Click **Sign in with Google**
3. After first login, grant yourself ADMIN via the seed user OR run:
   ```bash
   cd backend
   npx prisma studio
   # Find your user in UserRole table, add role=ADMIN
   ```
4. You're in. Create an engagement, send a message, watch the agents run.

---

## One-command setup (recommended)

```bash
bash scripts/dev-start.sh
```

This handles: Docker infra, DB migrations, seed, npm/pip installs.
Then follow the printed instructions to start the 3 processes.

---

## Quick Demo Flow

1. **Dashboard** → New Engagement
   - Client: "TechCorp India"
   - Domain: "FinTech"
   - Type: "First Meeting Deck"

2. **Chat** → type: *"We need a first meeting deck for TechCorp India. They're a FinTech company looking to build a digital lending platform. Budget ~50L, timeline 6 months."*

3. Watch the **Agent Feed** — Research + Context run in parallel, then Packaging fires automatically.

4. When done — **Download** the PPTX from the top bar.

5. Try the **Gates tab** — submit the artifact for Gate 1 review.

6. **Admin panel** → Users & Roles → assign yourself REVIEWER → approve the gate.

---

## Services at a Glance

| Service | URL | Notes |
|---------|-----|-------|
| Frontend | http://localhost:5173 | React + Vite |
| Backend API | http://localhost:3000 | Express + Node |
| Python AI Service | http://localhost:8001 | FastAPI |
| MinIO Console | http://localhost:9001 | Credentials: minioadmin / minioadmin |
| Prisma Studio | `npx prisma studio` in backend/ | DB explorer |

---

## Troubleshooting

**"AI service unreachable"** — Make sure Python service is running on :8001 and `AI_SERVICE_URL=http://localhost:8001` in `.env`

**"Cannot connect to database"** — Check Docker containers: `docker compose ps`. Run `docker compose up postgres -d` if stopped.

**"Google SSO redirect mismatch"** — In Google Cloud Console, add `http://localhost:3000/auth/google/callback` as an authorized redirect URI.

**Prisma client out of date** — Run `cd backend && npx prisma generate` after any schema change.

**Python import errors** — Make sure you're in the virtualenv: `source ai-service/.venv/bin/activate`

---

## Project Structure

```
presales-orchestrator/
├── backend/              Node.js API (Express + Prisma + BullMQ)
│   ├── src/routes/       All API routes
│   ├── src/agents/       Orchestrator, pipeline, cascade
│   ├── src/services/     AI client, audit, WebSocket, storage
│   └── prisma/           Schema + migrations + seed
├── ai-service/           Python FastAPI (all LLM logic)
│   ├── workers/          10 real agent workers
│   ├── routers/          HTTP endpoints
│   └── schemas/          Pydantic models
├── frontend/             React + Vite
│   ├── src/pages/        Dashboard, Engagement, Admin, Login
│   ├── src/components/   AgentFeed, GatePanel, etc.
│   └── src/services/     API client, WebSocket
├── docker-compose.yml    Infra services (Postgres, Redis, MinIO)
├── .env.example          All required env vars
├── INTERFACE.md          Full API contract (routes + WS events)
└── CONTEXT.md            Project context for agents
```
