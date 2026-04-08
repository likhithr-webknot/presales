#!/usr/bin/env bash
# dev-start.sh — Start the full local dev environment
# Run from the project root: bash scripts/dev-start.sh

set -e
cd "$(dirname "$0")/.."
ROOT=$(pwd)

echo ""
echo "🏛️  Presales Orchestrator — Local Dev Setup"
echo "============================================="
echo ""

# ── Check .env ────────────────────────────────────────────────────────────────
if [ ! -f .env ]; then
  echo "❌  .env file not found. Run: cp .env.example .env and fill in your API keys."
  exit 1
fi

# ── Step 1: Start infra ───────────────────────────────────────────────────────
echo "▶  Starting infrastructure (Postgres, Redis, MinIO)..."
docker compose up postgres redis minio -d

echo "   Waiting for services to be healthy..."
for i in {1..20}; do
  if docker compose ps postgres | grep -q "healthy" && \
     docker compose ps redis   | grep -q "healthy" && \
     docker compose ps minio   | grep -q "healthy"; then
    echo "✅  All infra services healthy."
    break
  fi
  sleep 3
  if [ $i -eq 20 ]; then
    echo "❌  Services didn't become healthy in time. Check: docker compose logs"
    exit 1
  fi
done

# ── Step 2: Backend ───────────────────────────────────────────────────────────
echo ""
echo "▶  Setting up backend..."
cd "$ROOT/backend"
npm install --silent

echo "   Running DB migrations..."
npx prisma migrate deploy 2>/dev/null || npx prisma migrate dev --name "sprint-8-schema" --skip-seed

echo "   Regenerating Prisma client..."
npx prisma generate

echo "   Seeding database..."
npm run db:seed 2>/dev/null || true  # ignore errors if already seeded

# ── Step 3: Python AI Service ──────────────────────────────────────────────────
echo ""
echo "▶  Setting up Python AI service..."
cd "$ROOT/ai-service"

if [ ! -d ".venv" ]; then
  echo "   Creating virtualenv..."
  python3 -m venv .venv
fi

echo "   Installing Python dependencies..."
.venv/bin/pip install -q -r requirements.txt

# ── Step 4: Frontend ──────────────────────────────────────────────────────────
echo ""
echo "▶  Installing frontend dependencies..."
cd "$ROOT/frontend"
npm install --silent

# ── Step 5: Print launch instructions ────────────────────────────────────────
echo ""
echo "============================================="
echo "✅  Setup complete! Now open 3 terminal tabs:"
echo ""
echo "  Tab 1 — Backend:"
echo "    cd $(realpath "$ROOT/backend") && npm run dev"
echo ""
echo "  Tab 2 — Python AI Service:"
echo "    cd $(realpath "$ROOT/ai-service") && source .venv/bin/activate && BACKEND_URL=http://localhost:3000 uvicorn main:app --host 0.0.0.0 --port 8001 --reload"
echo ""
echo "  Tab 3 — Frontend:"
echo "    cd $(realpath "$ROOT/frontend") && npm run dev"
echo ""
echo "  Then open: http://localhost:5173"
echo ""
echo "  MinIO console: http://localhost:9001  (minioadmin / minioadmin)"
echo "  DB explorer:   cd backend && npx prisma studio"
echo ""
echo "  First login: Sign in with Google, then assign yourself ADMIN via Prisma Studio:"
echo "    → UserRole table → Create → userId: <your-id>, role: ADMIN"
echo "============================================="
