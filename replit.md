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
| `local-embeddings.ts` | Local embedding generation (TF-IDF hash 384-dim, with @xenova/transformers as optional accelerator) |
| `local-moderation.ts` | Rule-based content moderation, spam detection, behavioral anomaly detection — wired into testimonies, prayer, comments |
| `analytics-ai.ts` | Engagement prediction, content performance forecasting, optimal notification timing — available at `/api/admin/analytics` |
| `local-ai-enhancer.ts` | In-house AI enhanced response engine — Tier 3 fallback with RAG context injection, scripture study, spiritual insight routing |
| `platform-monitor.ts` | Comprehensive platform health monitoring for all subsystems |

### Routes — Local AI Only

- `routes/ai.ts` — scripture-study, spiritual-insight, testimony-reflect, suggested-questions, voice-chat (all local SSE streaming)
- `routes/chat.ts` — TempleBots: Tier 1 local engine → Tier 2 local enhanced (RAG + templates)
- `routes/prayer.ts` — Local prayer generation + content moderation gate
- `routes/sermon-assistant.ts` — Local sermon assistant with RAG context
- `routes/translate.ts` — Local phrase matching for ministry strings (no external translation API)
- `routes/sermons.ts` — Local summarization via `summarizeSermon()`
- `routes/testimonies.ts` — Content moderation + anomaly detection before insert
- `routes/moments.ts` — Content moderation + anomaly detection on comments
- `lib/devotion-engine.ts` — Local devotion generation from 365+ pool
- `lib/blog-generator.ts` — Local blog content generation via content intelligence
- `lib/broadcast-engine.ts` — Local sermon scoring/recommendation engine

### Admin Dashboard Features

- **Overview** — Live visitor stats, sermon metrics, AI enrichment progress
- **Broadcast** — YouTube sync queue, curation strategy, sermon library metrics
- **Events** — Event promotion manager, push notification scheduler
- **Sermons** — Sermon management, AI metadata enrichment
- **Gallery** — GCS image management, bulk upload
- **Testimonies** — Moderation queue, approve/reject, liked testimonies
- **Platform** — System health, uptime, push subscriber stats
- **Analytics** — Predictive audience metrics, engagement forecasting, optimal notification timing (`GET /api/admin/analytics`)
- **AI Engine** — 3-tier AI health, feedback loop, knowledge base status, feature flags
- **Credentials** — Secure HMAC token management for all admin roles

## pgvector Embedding Dimensions

The `knowledge_chunks.embedding` column uses **384 dimensions** (local TF-IDF / all-MiniLM-L6-v2).
Previous builds used `vector(1536)` for OpenAI. A migration in `migrations.ts` auto-detects and fixes this on startup.

## Content Moderation

All user-submitted content (testimonies, prayer requests, Moments comments) passes through `local-moderation.ts` before database insert:
- Rule-based profanity, blasphemy, spam, hate speech detection
- Statistical signals: URL density, caps ratio, repetition, emoji overuse
- Behavioral anomaly detection: rate limiting per IP (10 req/min window)
- Decisions: `approve` | `flag` | `reject` — rejected content returns HTTP 422

## Frontend Fixes (May 2026)

- `Status.tsx` — AI status now shows "Local AI · TempleBots" (was "OpenAI / TempleBots")
- `Topics.tsx` — Fixed `bg-white` → `bg-background` (dark mode compatibility)
- `Leadership.tsx` — Fixed `bg-white` → `bg-background` (dark mode compatibility)
- `Devotion.tsx` — Loading state upgraded from italic text to full skeleton layout
- `SpiritualInsight.tsx` — Added missing `path="/spiritual-insight"` to SEO component
- `VoiceTempleBots.tsx` — Replaced `@workspace/integrations-openai-ai-react` imports with native MediaRecorder + fetch SSE hooks (no external AI package dependency)

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
- Content moderation gate on all user-generated content (local ML + rule-based)

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
