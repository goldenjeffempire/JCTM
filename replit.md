# JCTM Digital Sanctuary

## Overview

Full-stack pnpm monorepo for **Jesus Christ Temple Ministry (JCTM)**, Warri, Nigeria. A production-grade church platform with sermons, AI TempleBots, giving portal, real-time global altar counter, and more.

---

## Architecture

| Layer | Package | Port | Description |
|-------|---------|------|-------------|
| Frontend | `@workspace/jctm-platform` | 3000 (dev) | React 18 + Vite 7 + Tailwind CSS v4 SPA |
| Backend | `@workspace/api-server` | 8080 (dev) | Express 5 + Drizzle ORM + Pino |
| DB client | `@workspace/db` | — | Drizzle schema + Neon PostgreSQL |
| API types | `@workspace/api-zod` | — | Shared Zod schemas |
| API hooks | `@workspace/api-client-react` | — | TanStack Query wrappers |

---

## Workflows

| Workflow | Command | Purpose |
|----------|---------|---------|
| **Backend API** | `PORT=8080 pnpm --filter @workspace/api-server run dev` | Express API server on port 8080 |
| **Start application** | `pnpm --filter @workspace/jctm-platform run dev` | Vite dev server on port 3000 |

The Vite dev server proxies all `/api/*` requests to `localhost:8080` (configured in `artifacts/jctm-platform/vite.config.ts`).

---

## Database (PostgreSQL / Neon)

15 tables, all created via raw SQL migration on startup (`artifacts/api-server/src/lib/db-migrate.ts`):

`sermon_data`, `testimonies`, `event_calendar`, `giving_logs`, `member_directory`, `member_auth`, `conversations`, `messages`, `crusade_registrations`, `knowledge_chunks`, `site_stats`, `daily_devotions`, `moment_comments`, `moment_engagements`, `moment_likes`

> **Note**: `pgvector` is not available on Replit PostgreSQL. The `knowledge_chunks.embedding` column stores text.

---

## Pages (24 total)

All routes verified HTTP 200:

`/` · `/sermons` · `/sermons/:id` · `/devotion` · `/prayer` · `/testimonies` · `/events` · `/give` · `/about` · `/leadership` · `/members` · `/moments` · `/join` · `/crusade` · `/topics` · `/topics/:slug` · `/timeline` · `/scripture-study` · `/sermon-assistant` · `/spiritual-insight` · `/viewing-centres` · `/privacy` · `/terms` · `/*` (404)

---

## API Routes (22 route modules)

All verified HTTP 200: `health`, `sermons`, `altar`, `devotion`, `prayer`, `testimonies`, `events`, `giving`, `crusade`, `members`, `moments`, `geo`, `ai`, `chat`, `livechat`, `livestream`, `auth`, `visitors`, `translate`, `websub`, `sermon-assistant`

---

## Security

- **Helmet** — HTTP security headers
- **Rate limiting** — 300/15min global; 20/min AI/chat/prayer/devotion; 30/15min auth
- **Gzip compression** — level 6, threshold 1KB
- **scrypt password hashing** — N=16384, per-user salt, timing-safe compare
- **CORS** — allows `jctm.org.ng`, `*.replit.dev`, `*.replit.app`, `*.onrender.com`
- **1MB JSON body limit**

---

## Performance

- **Code splitting**: React, Three.js, Framer Motion, Lucide, Radix UI, TanStack Query, date-fns, styling-utils, forms — all separate chunks
- **Lazy loading**: `GlobalAltar3D` and `MinistrySlideshow` loaded on demand (not in initial bundle)
- **TanStack Query**: 30-min GC time, `offlineFirst` network mode, no window-focus refetch, exponential backoff
- **Vite assets**: 4KB inline limit, no sourcemaps in production, CSS code-split
- **Production**: No source maps generated (`NODE_ENV=production` in build)

---

## Render Deployment (`render.yaml`)

- **Build**: `npm install -g pnpm@10 && pnpm install && vite build && NODE_ENV=production api-server build`
- **Start**: `node artifacts/api-server/dist/index.mjs`
- **Health check**: `/api/health`
- **Scaling**: 1 instance (altar counter is in-memory; Redis pub/sub ready for scale-out)
- **Cache headers**: `/assets/*` → 1 year immutable; HTML → no-cache; `/api/*` → no-store
- **Secrets needed** (set in Render dashboard): `DATABASE_URL`, `YOUTUBE_API_KEY`, `PAYSTACK_SECRET_KEY`, `OPENAI_API_KEY`, `SESSION_SECRET`

---

## Environment Variables

| Variable | Purpose | Required |
|----------|---------|---------|
| `DATABASE_URL` | Neon PostgreSQL connection string | ✅ Yes |
| `YOUTUBE_API_KEY` | YouTube Data API v3 for sermon sync | ✅ Yes |
| `OPENAI_API_KEY` | AI features (TempleBots, devotions, sermon assistant) | ✅ Yes (prod) |
| `PAYSTACK_SECRET_KEY` | Donation/giving portal | Optional |
| `SESSION_SECRET` | Session cookie signing (64-char hex) | ✅ Yes |
| `PORT` | Server port (8080 dev, 10000 Render) | Auto-set |
| `NODE_ENV` | `development` or `production` | Auto-set |
| `BASE_PATH` | Vite base URL (`/`) | Auto-set |

---

## SEO Architecture

### Static SEO (`artifacts/jctm-platform/index.html`)
Schema.org JSON-LD blocks embedded in `<head>`:
- `ReligiousOrganization` — JCTM as an entity with geo, contacts, social media sameAs
- `WebSite` — with sitelinks searchbox `potentialAction`
- `BroadcastService` — Temple TV YouTube channel
- `FAQPage` — 8 ministry FAQs for rich snippets
- `WebPage` + `SpeakableSpecification` — voice search optimization
- **`Event`** — Warri City Crusade 2026 (April 30–May 1) with location, organizer, performer
- **`Person`** — Prophet Amos Evomobor with knowsAbout, sameAs (YouTube, Facebook), worksFor

### Per-Page SEO (`artifacts/jctm-platform/src/components/SEO.tsx`)
- Canonical URLs, Open Graph, Twitter Card, geo meta tags (ICBM, geo.position)
- Per-page `jsonLd` prop for additional structured data (AboutPage, Person, Event, VideoObject, BreadcrumbList)
- Sitemap referenced from `<head>` via `robots.txt`

### Dynamic Sitemaps (`artifacts/api-server/src/routes/seo.ts`)
Served at root level (not under `/api`) in `app.ts`:
- **`GET /sitemap.xml`** — 25 static pages + all dynamic sermon URLs with image extensions
- **`GET /sitemap-sermons.xml`** — Sermon-specific sitemap for Googlebot-Video with VideoObject-compatible data

### `robots.txt` (`artifacts/jctm-platform/public/robots.txt`)
- Points to both `sitemap.xml` and `sitemap-sermons.xml`
- Allows Googlebot, Bingbot, Twitterbot, WhatsApp, Facebook crawlers
- Blocks development paths, AI scrapers, bad bots

---

## Real-time Features

- **YouTube WebSub** — Push subscriptions for instant new sermon notifications (no polling)
- **YouTube sync cron** — Full resync every 30 minutes (2,027 sermons as of April 2026)
- **Global altar counter** — Real-time SSE stream of worldwide worshippers
- **Livestream status** — SSE stream for live service indicator

---

## AI Features

### Primary Layer: JCTM Local AI Engine (`artifacts/api-server/src/lib/local-ai-engine.ts`)
- **Custom inference system** — No external calls; sub-millisecond response for known queries
- **18 JCTM intent types**: `ministry_overview`, `prophet_amos`, `correction_mandate`, `primitive_christianity`, `holiness_doctrine`, `water_baptism`, `holy_spirit_baptism`, `five_fold_ministry`, `giving_tithing`, `temple_tv`, `contact_location`, `service_times`, `warri_crusade`, `prayer_support`, `sermon_library`, `join_membership`, `viewing_centres`, `general_greeting`
- **TF-IDF keyword scoring** — Multi-phrase matching (3× weight for n-grams), token-level partial matching
- **Confidence-gated routing**: ≥ 0.65 → serve locally; < 0.65 → escalate to OpenAI with enrichment context
- **Emotional & complex query detection** — Auto-escalates distress, grief, marriage, prophecy, personal advice queries
- **Diagnostic endpoint**: `POST /api/ai/local-inference` for direct engine testing
- **Health endpoint**: `GET /api/ai/health` exposes engine metadata, model, and architecture info

### Enhancement Layer: OpenAI gpt-4o (via Replit AI Integration)
- **Daily Devotion** — AI-generated scripture devotion refreshed daily
- **Prayer Ministry** — AI prayer response
- **TempleBots** — Two-tier: local engine first → OpenAI for complex/emotional queries
- **Sermon Assistant** — RAG-style Q&A over JCTM sermon knowledge base (12 pgvector chunks)
- **Scripture Study** — Deep-dive biblical commentary
- **Spiritual Insight** — Prophetic insight chatbot
- **Voice Chat, Translation, Testimony Reflection, Devotion** — All using gpt-4o
