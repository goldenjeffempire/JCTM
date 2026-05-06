# JCTM Digital Sanctuary

A full-stack ministry platform for Jesus Christ Temple Ministry (Warri, Nigeria) — sermon streaming, testimony sharing, event management, an AI chat assistant (TempleBots), devotions, gallery, and a live Global Altar worshipper counter.

## Run & Operate

| Command | Purpose |
|---|---|
| `pnpm install` | Install all workspace dependencies |
| `pnpm --filter @workspace/jctm-platform run build` | Build React frontend |
| `pnpm --filter @workspace/api-server run build` | Build Express API |
| `NODE_ENV=production PORT=5000 node artifacts/api-server/dist/index.mjs` | Start production server |

**Required env vars:** `DATABASE_URL` (Replit PostgreSQL — auto-provisioned), `OPENAI_API_KEY`, `YOUTUBE_API_KEY`, `PAYSTACK_SECRET_KEY`, `STRIPE_SECRET_KEY`

**Optional:** `SMTP_*` (email), `VAPID_*` (push notifications), `SENTRY_DSN`, `GCS_*` (Google Cloud Storage)

## Stack

- **Frontend:** React 19, Vite 7, Tailwind CSS 4, Framer Motion, Three.js, TanStack Query
- **Backend:** Express 5 (ESM), Pino logging, Helmet security, rate limiting
- **Database:** PostgreSQL 16 (Replit built-in) + Drizzle ORM
- **AI:** OpenAI GPT-4o for TempleBots; local embeddings fallback
- **Runtime:** Node.js 20, pnpm 10 monorepo

## Where things live

- `artifacts/jctm-platform/` — React web app (Vite)
- `artifacts/api-server/src/` — Express server, routes, lib utilities
- `artifacts/api-server/src/lib/migrations.ts` — All DB migrations (idempotent, run at startup)
- `lib/db/src/schema/` — Drizzle ORM schema definitions
- `lib/api-spec/openapi.yaml` — OpenAPI 3.1 source of truth
- `lib/api-client-react/` — Auto-generated React Query hooks (via Orval)
- `.replit` — Workflow, deployment, and port config

## Architecture decisions

- **Single-port architecture:** Express serves both the built React SPA (`dist/public/`) and all `/api/*` routes on port 5000. No separate dev proxy in production.
- **Idempotent startup migrations:** `runMigrations()` in `migrations.ts` uses `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` throughout — safe to call on every deploy and startup.
- **Object storage driver:** Defaults to `database` (stores blobs in `local_objects` PostgreSQL table). Can be switched to GCS via `OBJECT_STORAGE_DRIVER=gcs` + GCS credentials.
- **SSE for real-time:** Sermon updates, gallery changes, visitor counts, and livestream state all use Server-Sent Events rather than WebSockets.
- **Local AI fallback:** TempleBots uses local embeddings (384-dim) when OpenAI is unavailable; pgvector powers RAG search on `knowledge_chunks`.

## Product

- Sermon library with YouTube sync, live streaming, and rebroadcast detection
- Ministry Moments (short videos) with likes and comments
- Global Altar 3D — live worshipper count visualization
- TempleBots AI assistant with RAG over ministry knowledge base
- Daily devotionals with email subscription
- Event promotions with countdown banners and push notifications
- Member directory and auth (registration, login, password reset)
- Gallery with image uploads and admin management
- Giving/donations via Paystack and Stripe
- Admin panels for sermons, gallery, livestream, broadcasts

## User preferences

- Keep the pnpm monorepo structure intact
- All migrations are idempotent — safe to re-run on every restart

## Gotchas

- The `migrations.ts` file runs `ALTER TABLE member_auth ADD COLUMN IF NOT EXISTS role` — this requires `member_auth` to already exist. The base schema tables must be created first.
- `DATABASE_URL` must not have `sslmode=prefer` — the db client normalizes it to `verify-full` to suppress pg deprecation warnings.
- Port 5000 is the only exposed port (mapped to external port 80 in `.replit`).
- The `blog_posts` table has both `meta_title`/`meta_description` declared twice (idempotent ALTER TABLE handles this).

## Pointers

- DB skill: `.local/skills/database/SKILL.md`
- Workflows skill: `.local/skills/workflows/SKILL.md`
- Environment secrets: `.local/skills/environment-secrets/SKILL.md`
