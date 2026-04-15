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

## Replit Workflows

| Workflow | Command | Purpose |
|----------|---------|---------|
| **artifacts/api-server: API Server** | `pnpm --filter @workspace/api-server run dev` | Express API server on port 8080 |
| **artifacts/jctm-platform: web** | `pnpm --filter @workspace/jctm-platform run dev` | Vite dev server on port 3000 |
| **artifacts/jctm-mobile: expo** | `pnpm --filter @workspace/jctm-mobile run dev` | Expo mobile preview on port 26034 |

The Vite dev server proxies all `/api/*` requests to `localhost:8080` (configured in `artifacts/jctm-platform/vite.config.ts`). Duplicate legacy workflows from the original import were removed during Replit migration so the registered Replit artifact services own the active ports cleanly.

---

## Database (PostgreSQL / Neon)

15 tables, all created via raw SQL migration on startup (`artifacts/api-server/src/lib/db-migrate.ts`):

`sermon_data`, `testimonies`, `event_calendar`, `giving_logs`, `member_directory`, `member_auth`, `conversations`, `messages`, `crusade_registrations`, `knowledge_chunks`, `site_stats`, `daily_devotions`, `moment_comments`, `moment_engagements`, `moment_likes`

> **Note**: `pgvector` is not available on Replit PostgreSQL. The `knowledge_chunks.embedding` column stores text.

---

## Pages (27 total)

All routes verified HTTP 200:

`/` · `/sermons` · `/sermons/:id` · `/devotion` · `/prayer` · `/testimonies` · `/events` · `/give` · `/about` · `/leadership` · `/members` · `/moments` · `/join` · `/crusade` · `/topics` · `/topics/:slug` · `/timeline` · `/scripture-study` · `/sermon-assistant` · `/spiritual-insight` · `/viewing-centres` · `/privacy` · `/terms` · `/blog` · `/blog/:slug` · `/gallery` · `/*` (404)

## Gallery Feature

- **Route**: `/gallery`
- **Table**: `gallery_images` (PostgreSQL) — id, title, description, object_path, thumbnail_path, category, service_date, alt_text, is_published, sort_order, created_at
- **Object Storage**: GCS via Replit App Storage (`@google-cloud/storage`)
- **Client lib**: `@workspace/object-storage-web` — Uppy v5 ObjectUploader + useUpload hook
- **API endpoints**: `GET /api/gallery`, `GET /api/gallery/featured`, `GET /api/gallery/categories`, protected `POST /api/gallery`, protected `PATCH /api/gallery/:id`, protected `DELETE /api/gallery/:id`
- **Upload**: raw bytes sent to `POST /api/storage/uploads` (server-proxied; avoids CORS with GCS presigned URLs). Frontend compresses JPEG/PNG/WebP to max 1920 px at 87 % quality before sending. Server hard cap is 25 MB; client rejects > 25 MB before any network call.
- **Thumbnails**: After `POST /api/gallery`, a background job uses `sharp` to generate a 640px WebP thumbnail (quality 80) and saves it to `/objects/thumbs/<uuid>.webp`. The gallery grid uses the thumbnail; the lightbox serves the full-size original. Falls back gracefully if thumbnail generation fails.
- **Admin access**: unified role-based system — see Role-Based Admin section below. Gallery role also checks legacy `GALLERY_ADMIN_PASSPHRASE_HASH` for backward compat.
- **Homepage sync**: New uploads are featured by default and the Home page Ministry in Pictures slideshow pulls `GET /api/gallery/featured`, with bundled images as fallback.
- **Categories**: Built-in and dynamically created categories are exposed through `GET /api/gallery/categories` and available in the Gallery filter/upload dashboard.
- **Footer**: Admin link removed from footer; admin dashboard accessible only via direct URL (`/admin`).

## Role-Based Admin System

Three independent admin roles, each with its own passphrase, HMAC-signed JWT, and 2-hour TTL stored in localStorage.

### Credential resolution order (first match wins)
1. **`admin_credentials` DB table** — set via the in-app Setup or Change Passphrase UI. Persists across all deployments automatically. ← preferred
2. `ADMIN_PASSPHRASE_HASH_{ROLE}` env var — scrypt hash
3. `ADMIN_PASSPHRASE_{ROLE}` env var — plaintext
4. Legacy gallery env vars `GALLERY_ADMIN_PASSPHRASE_HASH` / `GALLERY_ADMIN_PASSPHRASE`
5. Dev defaults (only when `NODE_ENV !== "production"`)

| Role | Dev default |
|------|-------------|
| `gallery` | `jctm-gallery-2026` |
| `sermon` | `jctm-sermon-2026` |
| `livestream` | `jctm-stream-2026` |

**Token signing**: HMAC-SHA256 with `ADMIN_TOKEN_SECRET` (falls back to `SESSION_SECRET`).

**Backend**: `lib/adminAuth.ts`; `routes/adminAuth.ts`:
- `POST /api/admin/auth/login` — exchange passphrase for token
- `POST /api/admin/auth/setup` — first-time passphrase creation (only when unconfigured)
- `POST /api/admin/auth/change-passphrase` — update passphrase (requires valid token + current passphrase)
- `GET /api/admin/auth/session` — validate token
- `GET /api/admin/auth/roles` — list configured roles

**Protected routes**: `POST /api/sermons` (sermon), `POST /api/livestream/status` + `POST /api/livestream/rebroadcast` (livestream), all gallery writes (gallery).

**Frontend**: `hooks/useAdminAuth.ts` (`needsSetup`, `setup()`, `changePassphrase()`, `login()`, `logout()`); `components/admin/AdminLoginGate.tsx` — automatically shows Setup form, Login form, or authenticated children based on state.

## Recent Enhancements

### YouTube Sync — Fully Automated, Near-Real-Time Pipeline

Three sync layers run in parallel:

| Layer | Interval | Mechanism |
|-------|----------|-----------|
| **WebSub** (PubSubHubbub) | Instant push | YouTube notifies on every publish/edit/delete |
| **RSS** | 5 min | Quota-free Atom feed; immediately enriches new videos via API |
| **YouTube Data API v3** | 30 min | Full metadata refresh with quota-aware backoff |

Key behaviours:
- **RSS inserts → immediate API enrichment**: When RSS detects a new video, it fires a YouTube API call for that video's IDs within 4 seconds to fill in duration, view count, and HD thumbnail. A second SSE broadcast is sent when enrichment completes.
- **Thumbnail upgrade**: `enrichVideoIds` upgrades RSS placeholder (`hqdefault.jpg`) to the API's `maxresdefault` or `standard` thumbnail.
- **Live → ended transitions**: Handled by all three layers; `broadcastEndedAt` is stamped automatically.
- **Video deletion**: WebSub `<at:deleted-entry>` notifications remove the record from the DB and broadcast to SSE clients.
- **Shorts filter relaxation**: `/sermons/shorts` includes videos published within the last 24 hours even if duration is not yet known (covers the brief window before enrichment).
- **Moments SSE**: Reconnects with exponential backoff (2 s → 60 s cap); 30-minute polling fallback when SSE is unavailable.
- **Quota handling**: `QuotaExceededError` pauses the API sync until UTC midnight; RSS and WebSub continue unaffected.

### Gallery Upload — Compressed, Retried, Reliable

| Improvement | Detail |
|-------------|--------|
| **Client-side compression** | JPEG/PNG/WebP are re-encoded at ≤ 1920 px, 87 % quality before upload. A 6.4 MB DSLR photo typically becomes 300–800 KB. HEIC/GIF sent as-is. |
| **Compression indicator** | File list shows ~~6.4~~ → 0.7 MB during upload |
| **Auto-retry** | Network errors (not 4xx/5xx) retry up to 2 times with 2 s / 4 s backoff |
| **Stream race condition fix** | Replaced the faulty `req.on("close")` → resolve() with a settled-flag pattern; aborted uploads now correctly 499 |
| **Size limits** | Raised to 25 MB on both server and client to allow raw HEIC/AVIF from iPhone cameras |
| **Error messages** | Specific messages for 413 (too large), 499 (aborted), network errors, invalid image, and server errors |

### Blog Frontend (`/blog`, `/blog/:slug`)
- `Blog.tsx` — full list view with topic filters, search, pagination (12/page)
- `BlogPost.tsx` — full article view with markdown renderer, share button, related posts, and CTA
- Routes added to `App.tsx`, "Ministry Blog" added to Navbar Resources dropdown

### Member Profile Editing
- `PUT /auth/profile` backend endpoint with name, phone, and optional password change
- `Join.tsx` dashboard shows "Edit Profile" button → slide to edit form (name, phone, password)
- Proper current-password verification before new password is accepted

### Admin Content Moderation (`/admin/broadcast`)
- New **Testimonies** tab: view all testimonies (pending/published), approve/unapprove, delete
- New **Platform** tab: real-time analytics (members, sermons, conversations, blogs, AI stats), AI blog generator with topic selector
- Backend: `PATCH /testimonies/:id/approve`, `DELETE /testimonies/:id` (admin-protected)

### Push Notification Bell (Navbar)
- `usePushNotifications` hook manages VAPID subscribe/unsubscribe lifecycle
- Bell/BellOff icon in desktop nav shows subscription state; triggers browser permission flow

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
| `ADMIN_TOKEN_SECRET` | Admin JWT signing secret (independent of SESSION_SECRET) | ✅ Yes (prod) |
| `ADMIN_PASSPHRASE_GALLERY` | Plaintext passphrase for gallery admin role | ✅ Yes (prod) |
| `ADMIN_PASSPHRASE_SERMON` | Plaintext passphrase for sermon admin role | ✅ Yes (prod) |
| `ADMIN_PASSPHRASE_LIVESTREAM` | Plaintext passphrase for livestream admin role | ✅ Yes (prod) |
| `PORT` | Server port (8080 dev, 10000 Render) | Auto-set |
| `NODE_ENV` | `development` or `production` | Auto-set |
| `BASE_PATH` | Vite base URL (`/`) | Auto-set |
| `VITE_ADSENSE_CLIENT_ID` | Google AdSense publisher client ID (`ca-pub-...`) | Required for ads |
| `VITE_ADSENSE_SLOT_HOME_HERO` | Homepage hero banner ad slot ID | Required for that placement |
| `VITE_ADSENSE_SLOT_HOME_MID` | Homepage mid-page ad slot ID | Required for that placement |
| `VITE_ADSENSE_SLOT_SERMON_FEED` | Sermon listing in-feed ad slot ID | Required for that placement |
| `VITE_ADSENSE_SLOT_SERMON_SIDEBAR` | Sermon detail desktop sidebar ad slot ID | Required for that placement |
| `VITE_ADSENSE_SLOT_INTRO_FEED` | Intro videos between-card ad slot ID | Required for that placement |
| `VITE_ADSENSE_SLOT_LIVE_BELOW_PLAYER` | Video/live player below-player ad slot ID | Required for that placement |
| `VITE_ADSENSE_ENABLE` | Allows AdSense rendering during development when set to `true`; production builds enable automatically when IDs are valid | Optional |

## AdSense Monetization

- **Script injection**: The AdSense script (`ca-pub-6817509745706083`) is hardcoded in `index.html` `<head>` so it loads unconditionally and before any ad slot renders. No duplicate injection via Helmet.
- **Component**: `artifacts/jctm-platform/src/components/ads/AdSense.tsx` — exports `AdSlot` (lazy IntersectionObserver loading, duplicate-push protection, error suppression, ad-blocker/no-fill graceful hiding) and `ADSENSE_SLOTS` (keyed slot IDs from env vars).
- **Env vars set** (shared): `VITE_ADSENSE_CLIENT_ID` (secret), `VITE_ADSENSE_SLOT_HOME_HERO`, `VITE_ADSENSE_SLOT_HOME_MID`, `VITE_ADSENSE_SLOT_SERMON_FEED`, `VITE_ADSENSE_SLOT_SERMON_SIDEBAR`, `VITE_ADSENSE_SLOT_LIVE_BELOW_PLAYER`, `VITE_ADSENSE_ENABLE=true`.
- **Placements**: Home hero (slot 7433409715, eager), Home mid (slot 6447631104, lazy), Sermon feed inline (slot 2094061938, every ~6 cards), SermonDetail below-player (slot 2069402391, eager) + desktop sidebar (slot 2609067251), IntroVideos feed (introFeed slot).
- **Compliance**: Privacy Policy (`/privacy`) accurately discloses AdSense cookie use with opt-out link. `CookieNotice` component (`artifacts/jctm-platform/src/components/ads/CookieNotice.tsx`) shows a dismissible banner on first visit (localStorage flag `jctm_cookie_notice_dismissed`).
- **Policy safety**: No ads inside iframes, live players, or chat. Slots have fixed `minHeight` to prevent CLS. `data-full-width-responsive="true"` on all ins elements.

## Replit Migration Status

- Dependencies installed with `pnpm install`.
- Active Replit services verified running: web, API, and Expo mobile preview.
- Web preview verified at `/` with API health returning OK.
- Client/server secret separation checked: sensitive keys are referenced from the API server, not the browser client.

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

## Recent Enhancements (April 2026)

### Sermon Detail Page (`/sermons/:id`) — Complete Rebuild
- **Two-column layout** — Main player + sidebar on desktop; single column on mobile
- **Related sermons sidebar** — Auto-fetches 6 related sermons by keyword from current sermon title
- **Share functionality** — WhatsApp, X (Twitter), Copy Link (dropdown + sidebar quick buttons)
- **"Ask AI about this sermon"** — Contextual card linking to SermonAssistant with pre-filled query
- **"Watch on YouTube" card** — Quick CTA in sidebar
- **Improved meta** — Cleaner title, date, and view count display with Temple TV badge

### Community Prayer Wall (`/prayer` + API)
- **New database table**: `prayer_requests` (id, name, category, request, pray_count, is_public, visitor_id, created_at)
- **GET /api/prayer/requests** — Fetch 30 most recent public prayer requests
- **POST /api/prayer/requests** — Submit a new prayer request (500-char limit)
- **POST /api/prayer/requests/:id/pray** — Increment pray count (anonymous, persisted in localStorage)
- **UI**: Full community prayer wall below the AI generator with animated cards, category badges, pray button with optimistic update

### BroadcastStatusIndicator
- Persistent floating badge (top-right, always on top) replacing the old LiveBanner
- Idle: subtle "Temple TV" ghost pill; Live: pulsing red badge; Rebroadcast: amber badge with countdown

---

## Broadcast Automation Engine (April 2026)

### Critical Bug Fixes
- **Channel ID corrected**: `UCkiRQ9lHdRZ2_p3hRe0UQBQ` → `UCPFFvkE-KGpR37qJgvYriJg` (livestream.ts now matches youtube-sync.ts & WebSub)
- **Timezone corrected**: Sunday service window now uses WAT (UTC+1, Africa/Lagos) instead of EST — 7:45–10:30 AM WAT 5-second polling

### New: Broadcast Intelligence Layer (`artifacts/api-server/src/lib/broadcast-engine.ts`)
- **AI-powered rebroadcast curation** — When live stream ends, `buildSmartRebroadcastQueue()` uses GPT-4o-mini to select the best sermon for rebroadcast from top-20 algorithmically-ranked candidates
- **Algorithmic scoring** — Ranks 60 sermons by recency (max 30pts), view count (max 25pts), featured flag (15pts), keyword relevance (max 20pts), Sunday service boost (10pts)
- **Auto-metadata generation** — `generateSermonMetadata()` generates tags, 2-sentence summary, and category for any sermon title using AI
- **Broadcast statistics** — `getBroadcastStats()` for library health metrics

### Extended Rebroadcast Window
- Changed from 3 days to **4 days** (Sunday → Thursday coverage)

### New: Broadcast Admin API
- `GET /api/broadcast/status` — Full automation status, next Sunday countdown, library stats
- `GET /api/broadcast/queue` — AI-curated rebroadcast queue (8 candidates + primary)
- `GET /api/broadcast/schedule` — Next 4 Sundays' service schedule in WAT
- `GET /api/broadcast/metrics` — Library metrics (total views, avg, top sermons)

### Enhanced SSE Events (`sse-broadcaster.ts`)
Added `broadcast_started`, `broadcast_ended`, `rebroadcast_started`, `rebroadcast_ended` event types for lifecycle tracking

### PWA — Progressive Web App
- **Service Worker** (`/sw.js`) — Cache-first static, network-first API (30s TTL), offline fallback, Push notification handler
- **Enhanced manifest** — Shortcuts (Live, Sermons, TempleBot, Give), screenshots, `display_override`
- **SW registration** in `main.tsx` with update detection

### Admin Dashboard
- **`/admin/broadcast`** — Broadcast Control dashboard with Overview/Queue/Schedule/Metrics tabs
- Shows real-time live status, automation engine config, AI curation queue, Sunday schedule, and library metrics

---

## Real-time Features

- **YouTube WebSub** — Push subscriptions for instant new sermon notifications (no polling)
- **YouTube sync cron** — Full resync every 30 minutes (2,030+ sermons as of April 2026)
- **Global altar counter** — Real-time SSE stream of worldwide worshippers
- **Livestream status** — SSE stream for live service indicator (5s poll during Sunday window, 30s otherwise)
- **Smart rebroadcast** — AI-curated content automatically selected when live stream ends

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
