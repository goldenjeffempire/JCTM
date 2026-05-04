# JCTM Digital Sanctuary

## Overview

The JCTM Digital Sanctuary is a full-stack pnpm monorepo serving as the comprehensive, production-grade digital platform for Jesus Christ Temple Ministry (jctm.org.ng). It expands JCTM's global outreach through sermons, AI-powered spiritual assistance (TempleBots), giving portal, live streaming, events, and community engagement tools.

## User Preferences

I want iterative development and detailed explanations of changes.

## AI Architecture — Zero External API (Local-First)

**All AI features run locally — no OpenAI dependency.**

As of this upgrade, all GPT-4o and external AI calls have been removed and replaced with a tiered local AI system:

| Tier | Engine | Latency | Scope |
|------|--------|---------|-------|
| 1 | Local AI Engine (pattern matching + TF-IDF) | <1ms | High-confidence ministry queries |
| 2 | RAG (pgvector + local embeddings) | 10-50ms | Sermon & knowledge base context |
| 3 | Local Template Generation (JCTM knowledge base) | 1-5ms | Complex theological / emotional queries |

### Local AI Modules (all in `artifacts/api-server/src/lib/`)

| File | Purpose |
|------|---------|
| `local-ai-engine.ts` | Core pattern-matching inference engine with 200+ intents |
| `local-text-generation.ts` | 365+ devotion pool, scripture study, spiritual insight templates, TempleBots responses |
| `local-content-intelligence.ts` | TF-IDF tagging, extractive sermon summarization, blog templates, categorization |
| `local-embeddings.ts` | Local embedding generation (transformer model / TF-IDF hash fallback) |
| `local-moderation.ts` | Rule-based content moderation, spam detection, behavioral anomaly detection |
| `analytics-ai.ts` | Engagement prediction, content performance forecasting, optimal notification timing |
| `openai-enhancer.ts` | Fully local enhanced response engine (no OpenAI dependency) |
| `platform-monitor.ts` | Comprehensive platform health monitoring for all subsystems |

### Routes — Local AI Only

- `routes/ai.ts` — scripture-study, spiritual-insight, testimony-reflect, suggested-questions, voice-chat (all local SSE streaming)
- `routes/chat.ts` — TempleBots: Tier 1 local engine → Tier 2 local enhanced (RAG + templates)
- `routes/prayer.ts` — Local prayer generation with scripture templates by category
- `routes/sermon-assistant.ts` — Local sermon assistant with RAG context
- `routes/translate.ts` — Local phrase matching for ministry strings (no external translation API)
- `routes/sermons.ts` — Local summarization via `summarizeSermon()`
- `lib/devotion-engine.ts` — Local devotion generation from 365+ pool
- `lib/blog-generator.ts` — Local blog content generation via content intelligence
- `lib/broadcast-engine.ts` — Local sermon scoring/recommendation engine

## Google AdSense Fix

- Root cause: `VITE_ADSENSE_CLIENT_ID` env var was not set → `ADSENSE_ENABLED = false`
- Fix: `AdSense.tsx` hardcodes fallback publisher ID `ca-pub-6817509745706083`
- Script deduplication guard added; `ins` element ref fixed; consent-change re-render added
- `VITE_ADSENSE_ENABLE=true` is set in .env

## System Architecture

pnpm monorepo with:

- **Frontend (`@workspace/jctm-platform`):** React 18, Vite 7, Tailwind CSS v4
- **Backend (`@workspace/api-server`):** Express 5, Drizzle ORM, Pino logging
- **Database (`@workspace/db`):** Drizzle schema + Neon PostgreSQL
- **API Types (`@workspace/api-zod`):** Shared Zod schemas
- **API Hooks (`@workspace/api-client-react`):** TanStack Query wrappers

### Key Features

- **TempleBots** — 3-tier local AI chat assistant with pastoral intelligence, emotional detection, scripture study
- **Daily Devotions** — 365+ local devotion pool, email delivery, RSS subscription
- **Temple TV Integration** — YouTube WebSub + RSS + API v3 sync pipeline (2000+ sermons)
- **Live Streaming** — Adaptive quality, SSE viewer counts, broadcast automation
- **Giving Portal** — Paystack integration
- **Global Altar** — Real-time 3D prayer counter (Three.js)
- **Gallery** — Enterprise bulk upload with GCS, compression, dedup
- **Events** — Full lifecycle management, multi-channel push/email notifications
- **Blog Engine** — Local AI content generation, SEO-optimized
- **Platform Monitor** — `/api/health` with subsystem status, AI tier health, system resources
- **PWA** — Service worker, push notifications, offline capability
- **SEO** — Schema.org JSON-LD, Open Graph, sitemaps, canonical URLs, geo meta

### Security

- Helmet, rate limiting, Gzip, scrypt hashing, CORS, JSON body limits
- Role-based admin (HMAC-signed JWTs for `gallery`, `sermon`, `livestream`)
- Content moderation (local ML + rule-based)

## Email Infrastructure (SMTP)

**Configuration (Replit Secrets):**
- `SMTP_HOST` = `mail.jctm.org.ng`
- `SMTP_PORT` = `587`
- `SMTP_SECURE` = `false` (STARTTLS)
- `SMTP_USER` = `info@jctm.org.ng`
- `SMTP_FROM` = `Jesus Christ Temple Ministry <info@jctm.org.ng>`

**Email flows:** Daily devotion, devotion welcome, member registration, password reset, event reminders, admin SMTP test

## External Dependencies

- **PostgreSQL:** Neon (production DB)
- **Google Cloud Storage:** Object storage via Replit App Storage
- **YouTube Data API v3:** Sermon sync
- **Paystack:** Giving portal payments
- **Google AdSense:** `ca-pub-6817509745706083` (hardcoded fallback in AdSense.tsx)
- **VAPID:** Web push notifications
- **Leaflet / OpenStreetMap:** Venue maps
- **Three.js / Framer Motion / Radix UI / Lucide:** UI libraries
- **Sharp / Uppy:** Image processing and file upload

## Environment Variables Required

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Neon PostgreSQL connection |
| `YOUTUBE_API_KEY` | YouTube Data API v3 sync |
| `PAYSTACK_SECRET_KEY` | Giving portal |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Web push |
| `SMTP_HOST` / `SMTP_PASS` | Email delivery |
| `VITE_ADSENSE_CLIENT_ID` | AdSense (fallback hardcoded) |
| `VITE_ADSENSE_ENABLE` | Set to `true` |
| `ADMIN_HEALTH_TOKEN` | Admin-only health endpoint |

**Note:** `OPENAI_API_KEY` is no longer required — all AI runs locally.
