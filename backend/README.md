# ClauseAI Backend

Production backend for ClauseAI: an intelligence layer that discovers and analyzes AI infrastructure.

## Tech stack

- **Node.js** + **TypeScript**
- **Express** API
- **Supabase** (Auth + Postgres)
- **Redis** + **BullMQ** (background jobs)
- **Zod** (validation), **Winston** (logging), **dotenv** (config)

## Setup

1. Copy `.env.example` to `.env` and set:
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `REDIS_URL` (e.g. `redis://localhost:6379`)
   - `ENCRYPTION_KEY` (32-byte hex: `openssl rand -hex 32`)

2. Run the SQL schema in Supabase:
   - Open Supabase Dashboard → SQL Editor
   - Paste and run `prisma/schema.sql`

3. Install and build:
   ```bash
   npm install
   npm run build
   ```

## Run

- **API server:** `npm run dev` or `npm start`
- **Scan worker:** `npm run worker` (in a separate terminal; requires Redis)

## API (all under `/api`, JWT required except health)

| Method | Path | Description |
|--------|------|-------------|
| POST   | /company | Create company profile |
| POST   | /vendors/connect | Connect vendor (store encrypted API key) |
| POST   | /scan/start | Start scan job (enqueues BullMQ job) |
| GET    | /scan/status/:jobId | Scan progress and logs |
| GET    | /systems | List discovered AI systems |
| PATCH  | /systems/:id | Override inferred fields (team_owner, system_type, environment) |

Send `Authorization: Bearer <supabase_jwt>` for authenticated routes.

## Project structure

- `src/config` – env, Supabase, Redis, logger
- `src/routes` + `src/controllers` – API layer
- `src/services` – vendors (OpenAI, Anthropic, Google, Pinecone, LangSmith), discovery, inference, scan orchestrator
- `src/workers` – BullMQ scan worker
- `src/jobs` – scan job queue
- `src/middleware` – auth, error, validation
- `src/types` – vendor and system types
- `prisma/schema.sql` – Postgres schema for Supabase
