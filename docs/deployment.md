# Deployment Guide — Mission Control

## Architecture

```
Vercel (Frontend)          Railway/Render (Backend)
https://mc.vercel.app  -->  https://mc-api.railway.app
                                |           |
                           Neon Postgres   Upstash Redis
```

## Frontend (Vercel)

### Deploy
1. Connect the GitHub repo to Vercel
2. Set root directory to `frontend`
3. Framework preset: Next.js (auto-detected)

### Environment Variables
```
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
NEXT_PUBLIC_AUTH_MODE=local
```

If using Clerk auth:
```
NEXT_PUBLIC_AUTH_MODE=clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
```

## Backend (Railway or Render)

### Deploy
1. Connect the GitHub repo
2. Set root directory to `backend`
3. Build command: `pip install .` (or use the Dockerfile)
4. Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

### Environment Variables
```
ENVIRONMENT=prod
DATABASE_URL=postgresql+psycopg://user:pass@host:5432/dbname
RQ_REDIS_URL=redis://:password@host:port/0
CORS_ORIGINS=https://your-app.vercel.app
BASE_URL=https://your-backend.railway.app
AUTH_MODE=local
LOCAL_AUTH_TOKEN=<generate with: openssl rand -hex 32>
DB_AUTO_MIGRATE=true    # set to false after first deploy
LOG_LEVEL=INFO
GATEWAY_MIN_VERSION=2026.02.9
OPENCLAW_DIR=            # leave empty in cloud (no local OpenClaw)
```

### Worker (if using Redis queues)
Separate service with same env vars:
```
python scripts/rq-docker worker
```

## Database (Neon / Supabase / Railway Postgres)

### Neon
1. Create a project at neon.tech
2. Copy the connection string
3. Set as `DATABASE_URL` in backend env (replace `postgresql://` with `postgresql+psycopg://`)

### First-time migration
Set `DB_AUTO_MIGRATE=true` on first deploy. The backend runs Alembic migrations on startup.
After successful migration, set to `false`.

## Redis (Upstash / Railway Redis)

### Upstash
1. Create a database at upstash.com
2. Copy the Redis URL
3. Set as `RQ_REDIS_URL` in backend env

## Local Development

Both services run via PM2:
```bash
cd ~/.openclaw/workspace/mission-control
pm2 start ecosystem.config.cjs
```

- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- API docs: http://localhost:8000/docs

Auth token for local login: check `backend/.env` for `LOCAL_AUTH_TOKEN`

## CORS

The backend reads `CORS_ORIGINS` as a comma-separated list. For multiple origins:
```
CORS_ORIGINS=https://mc.vercel.app,http://localhost:3000
```
