# Presales Orchestrator

Webknot's internal AI-driven presales lifecycle platform. AMs describe a client opportunity in plain language — the system autonomously researches, writes, packages, and routes collateral through approval gates.

---

## Prerequisites

| Tool | Notes |
|------|--------|
| **Docker + Docker Compose** | Postgres (pgvector), Redis, MinIO — required for local data layer |
| **Node.js 20+** | `backend/` and `frontend/` |
| **Python 3.11+** | `ai-service/` (venv + pip, or Poetry) |
| **API keys** | OpenAI, Anthropic, Gemini; Tavily (or Brave) if you use web search |
| **Google OAuth** | For SSO — [Google Cloud Console](https://console.cloud.google.com/) |

---

## Environment variables

From the **repository root**:

```bash
cp .env.example .env
```

Edit `.env` and set at least:

- **LLM:** `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`
- **Web search (if used):** `TAVILY_API_KEY` when `SEARCH_PROVIDER=tavily` (see `.env.example`)
- **Google SSO:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and redirect `GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback`
- **Secrets:** `JWT_SECRET` and `AI_INTERNAL_SECRET` — each **32+ characters**; `AI_INTERNAL_SECRET` must match in both Node and Python
- **URLs:** `FRONTEND_URL=http://localhost:5173`, `API_BASE_URL=http://localhost:3000/api`
- **Email:** set `EMAIL_ENABLED=false` in dev if you do not want SMTP (still provide placeholder vars if the app validates them — see `.env.example`)

**`AI_SERVICE_URL`** must point at wherever the Python service listens:

| Setup | Typical value |
|--------|----------------|
| Python on host, port **8001** (matches examples below) | `http://localhost:8001` |
| Python on host, port **8000** | `http://localhost:8000` |
| Full Docker stack (Compose maps container `8000` → host **8001**) | `http://localhost:8001` from the host, or `http://ai-service:8000` inside Compose |

For Python calling back into Node on your machine, set **`BACKEND_URL=http://localhost:3000`** in `.env` (Compose overrides this for containers).

The AI service loads **`ai-service/.env` first**, then the **repo root `.env`**, so you usually only maintain one file at the root.

---

## Option A — Infra in Docker, apps on the host (recommended for development)

### 1. Start Postgres, Redis, MinIO

```bash
docker compose up postgres redis minio -d
```

Wait until they are healthy: `docker compose ps`.

### 2. Backend (API + Prisma)

**The Prisma schema lives only under `backend/`.** Run all Prisma commands from there — not from `frontend/`.

```bash
cd backend
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

Backend: **http://localhost:3000**

### 3. AI service (Python)

Using **venv + pip** (same approach as `scripts/dev-start.sh`):

```bash
cd ai-service
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
BACKEND_URL=http://localhost:3000 uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

Using **Poetry** instead:

```bash
cd ai-service
poetry install
BACKEND_URL=http://localhost:3000 poetry run uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

Ensure root `.env` has **`AI_SERVICE_URL=http://localhost:8001`** when using port **8001**.

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

App: **http://localhost:5173** (Vite proxies `/api`, `/auth`, `/health` to the backend).

### 5. First login

1. Open **http://localhost:5173** and sign in with Google.
2. Grant **ADMIN** (or other roles) via seed data or **Prisma Studio**: `cd backend && npx prisma studio` → `UserRole`.

---

## Option B — Docker for backend + AI + infra (frontend still on host)

Compose starts Postgres, Redis, MinIO, **backend**, and **ai-service**. The **frontend is not** in Compose.

```bash
cp .env.example .env   # if you have not already
# Fill .env; for Compose, backend gets AI_SERVICE_URL=http://ai-service:8000 from compose.yml
docker compose up --build
```

Then in another terminal:

```bash
cd frontend
npm install
npm run dev
```

- API (through host port mapping): **http://localhost:3000**
- AI service on host: **http://localhost:8001** (mapped from container `8000`)
- Frontend: **http://localhost:5173**

---

## Automated setup script

From the repo root:

```bash
bash scripts/dev-start.sh
```

This starts Docker infra, installs dependencies, runs migrations, generates Prisma client, seeds (best-effort), and prints commands to start backend, AI service, and frontend in separate terminals.

---

## Services at a glance

| Service | URL | Notes |
|---------|-----|--------|
| Frontend | http://localhost:5173 | React + Vite |
| Backend API | http://localhost:3000 | Express + Prisma + BullMQ |
| Python AI | http://localhost:8001 | FastAPI (or **8000** if you choose that port locally) |
| MinIO console | http://localhost:9001 | `minioadmin` / `minioadmin` |
| Prisma Studio | run from `backend/` | `npx prisma studio` |

---

## Troubleshooting

| Issue | What to check |
|--------|----------------|
| **`Could not find Prisma Schema`** | You ran `npx prisma` from **`frontend/`**. Use **`cd backend`** then `npx prisma migrate dev` / `generate` / `studio`. |
| **AI service validation errors (`openai_api_key`, `ai_internal_secret`)** | Root `.env` missing keys or AI service cannot see them. Keep keys in repo root `.env` or `ai-service/.env`. |
| **AI service unreachable** | Python process running; `AI_SERVICE_URL` in `.env` matches the **host and port** uvicorn uses. |
| **Database connection errors** | `docker compose ps` — Postgres up and healthy; `DATABASE_URL` uses `localhost:5432` when apps run on the host. |
| **Google SSO redirect mismatch** | Authorized redirect URI: `http://localhost:3000/auth/google/callback`. |
| **Prisma client out of date** | `cd backend && npx prisma generate` after schema changes. |

---

## Quick demo flow

1. **Dashboard** → New Engagement (e.g. client "TechCorp India", domain FinTech, type "First Meeting Deck").
2. **Chat** — describe the opportunity; watch the **Agent Feed**.
3. **Download** generated artifacts when ready.
4. **Gates** — submit for review; assign **REVIEWER** in Admin and approve.

---

## Project structure

```
presales/
├── backend/              Node.js API (Express + Prisma + BullMQ)
│   └── prisma/           Schema, migrations, seed — Prisma CLI runs here
├── ai-service/           Python FastAPI (LLM / agents)
├── frontend/             React + Vite (no Prisma)
├── docker-compose.yml    Postgres, Redis, MinIO; optional backend + ai-service
├── .env.example          Documented environment variables
├── scripts/dev-start.sh  Local infra + install + migrate helper
├── INTERFACE.md          API contract (routes + WS events)
└── CONTEXT.md            Project context for agents
```
