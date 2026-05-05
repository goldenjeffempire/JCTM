# JCTM Digital Sanctuary

## Overview

The JCTM Digital Sanctuary is a full-stack pnpm monorepo serving as the comprehensive, production-grade digital platform for Jesus Christ Temple Ministry (jctm.org.ng). It expands JCTM's global outreach through sermons, AI-powered spiritual assistance (TempleBots), giving portal, live streaming, events, and community engagement tools.

## User Preferences

I want iterative development and detailed explanations of changes.

## AI Architecture — Zero External API (Local-First) v2

**All AI features run locally — no OpenAI dependency.**

All GPT-4o and external AI calls removed. Replaced with a tiered local AI system, now at v2 with 32 intents and automatic learning.

| Tier | Engine | Latency | Scope |
|------|--------|---------|-------|
| 1 | Local AI Engine (pattern matching, 32 intents) | <1ms | High-confidence ministry queries |
| 2 | RAG (pgvector + local TF-IDF embeddings, 6 chunks) | 10-50ms | Sermon & knowledge base context |
| 3 | Local Template Generation + Activity Context | 1-5ms | Complex theological / emotional queries |

### Local AI Modules (all in `artifacts/api-server/src/lib/`)

| File | Purpose |
|------|---------|
| `local-ai-engine.ts` | Core pattern-matching inference engine — **32 intents** (v2.0.0), 700+ keyword patterns |
| `local-ai-enhancer.ts` | In-house enhancer v2 — handles all 32 intents, RAG injection, activity-aware context, compact response builders |
| `local-text-generation.ts` | 365+ devotion pool, scripture study, spiritual insight templates, TempleBots responses |
| `local-content-intelligence.ts` | TF-IDF tagging, extractive sermon summarization, blog templates, categorization |
| `local-embeddings.ts` | Local embedding generation (TF-IDF hash 384-dim, with @xenova/transformers as optional accelerator) |
| `local-moderation.ts` | Rule-based content moderation, spam detection, behavioral anomaly detection |
| `analytics-ai.ts` | Engagement prediction, content performance forecasting, optimal notification timing |
| `platform-monitor.ts` | Comprehensive platform health monitoring for all subsystems |
| `knowledge-ingestion.ts` | **v2.1** — Version-stamped static ingestion (18 JCTM docs) + `ingestAllSermons()` (up to 200 sermons) + `ingestActivityLearning()` (prayer themes, testimonies, blog posts, events, popular questions) |

### AI Learning Pipeline

- **Startup** (90-second delayed): `ingestAllSermons` + `ingestActivityLearning` run automatically
- **After daily full sync** (24h): Same two functions re-run so AI stays current with new YouTube content
- **Activity context** (5-min cache): `buildActivityContext()` in `chat.ts` fetches upcoming events, prayer categories, recent testimonies and injects them into every chat response

### 32 Supported Intents (v2.0.0)

Original 20: `ministry_overview`, `prophet_amos`, `correction_mandate`, `primitive_christianity`, `holiness_doctrine`, `water_baptism`, `holy_spirit_baptism`, `five_fold_ministry`, `giving_tithing`, `temple_tv`, `contact_location`, `service_times`, `warri_crusade`, `prayer_support`, `sermon_library`, `emotional_distress`, `scripture_inquiry`, `join_membership`, `viewing_centres`, `general_greeting`

New 12: `end_times`, `fasting_prayer`, `spiritual_warfare`, `salvation_new_birth`, `repentance_restoration`, `praise_worship`, `bible_study_method`, `sin_temptation`, `marriage_family`, `healing_miracles`, `new_believer`, `testimony_sharing`

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

## Google AdSense Fix (Updated May 2026)

- Root cause: `VITE_ADSENSE_CLIENT_ID` env var was not set → `ADSENSE_ENABLED = false`
- Fix: `AdSense.tsx` hardcodes fallback publisher ID `ca-pub-6817509745706083`
- Script deduplication guard added; `ins` element ref fixed; consent-change re-render added
- `VITE_ADSENSE_ENABLE=true` is set in .env
- **Production consent fix:** `canRender` no longer requires `consentResolved`. Ads now render
  immediately for new visitors under Google Consent Mode v2 (non-personalized). They are only
  blocked when a user has *explicitly* denied advertising consent (`consent !== null && consent.advertising === false`).
- **Push error fix:** Failed `adsbygoogle.push({})` calls no longer set `pushedRef.current = true`,
  allowing the push to retry on the next render cycle instead of silently giving up.

## AI System Overhaul — Zero External API (Completed May 2026)

All stale OpenAI references removed from production code:

| File | Change |
|------|--------|
| `local-ai-engine.ts` | Docstring rewritten; `escalateToOpenAI` renamed to `needsEnrichment` |
| `routes/chat.ts` | Updated both stream + non-stream handlers to use `needsEnrichment` |
| `knowledge-ingestion.ts` | Dead `_openai: unknown` parameter renamed to `_unused` |
| `platform-monitor.ts` | `AITierHealth` interface: removed `openaiEnabled`/`openaiQuotaExceeded`; replaced with `externalAIEnabled: false`. Feature flag renamed from `openai` to `externalAI`. |
| `routes/ai.ts` | Response fields renamed: `openAiModel` → `externalAIModel`, `openaiEnabled` → `externalAIEnabled` |
| `cron.ts` | Status object field renamed: `openaiEnabled` → `externalAIEnabled` |
| `lib/integrations-openai-ai-server/src/client.ts` | Live OpenAI SDK replaced with a stub that throws a descriptive error if called |
| `Admin.tsx` | Type definition updated; tier label key renamed from `openai` to `external-ai` |
| `Status.tsx` | `openaiEnabled?` field renamed to `externalAIEnabled?` |

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
