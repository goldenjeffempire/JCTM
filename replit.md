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

Core tables are created or upgraded by startup migrations:

`sermon_data`, `testimonies`, `event_calendar`, `giving_logs`, `member_directory`, `member_auth`, `conversations`, `messages`, `crusade_registrations`, `knowledge_chunks`, `site_stats`, `daily_devotions`, `moment_comments`, `moment_engagements`, `moment_likes`, `broadcast_events`, `livestream_override_state`, gallery/admin/push/blog/livechat support tables

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
- **Real-time homepage slideshow sync**: `GET /api/gallery/featured` now returns all published gallery images, ordered with highlighted images first, so every uploaded/published image automatically appears in “Ministry in Pictures.” Gallery create/update/delete/thumbnail events broadcast through `/api/gallery/stream`, and the homepage slideshow refreshes immediately without manual intervention while retaining 3-minute polling and focus refresh as fallbacks.
- **Sermon-aligned teaching rotation**: “Ministry in Pictures” also loads `GET /api/sermons/teaching-points`, which derives rotating teaching points and Bible verses from current YouTube-synced sermon metadata. The slideshow merges those dynamic sermon points with its curated fallback library, spreads themes to avoid repetition, listens to sermon sync SSE events, and polls every 3 minutes.
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

### Production Hardening Pass — April 2026
- Added a backend `POST /api/client-errors` ingestion endpoint and wired frontend error boundaries plus global `error` / `unhandledrejection` listeners to report sanitized runtime failures through existing structured logs.
- Hardened API error handling with request ID, method, path, and severity-aware structured logging; 4xx rejections now log as warnings while 5xx errors log as server errors.
- Tightened production CORS behavior so broad Replit/Render wildcard origins are development-only unless explicitly configured through allowed origins.
- Improved shutdown reliability by stopping cron jobs, clearing delayed automation timers, and closing the PostgreSQL pool before process exit; added process-level unhandled rejection and uncaught exception logging.
- Fortified SSE cleanup and broadcast writes against closed sockets to reduce leaked intervals and stale connections under real-time load.
- Added a strict WebSub payload size/timeout guard before XML processing to prevent oversized push payloads from consuming memory.
- Reduced idle frontend resource usage by pausing visitor heartbeats while the tab is hidden, and made service worker registration base-path safe.
- Made live chat and upcoming-service popup storage access resilient when browser storage is blocked or unavailable.
- Added persistent `livestream_override_state` storage so manually activated live mode survives API restarts and deployment rollovers.
- Centralized safe browser storage helpers and applied them to core visitor, language, geo, live viewer, admin auth, prayer, moments, intro video, crusade notification, push prompt, stream quality, and cookie-consent flows.

### Sunday 8:00 AM WAT Service Hero Notification
- Homepage hero now shows a pinned “Service Soon” notification every Sunday from 6:00 AM to 8:00 AM WAT with a live countdown badge to 8:00 AM.
- The notification is separate from live/rebroadcast states: it disappears at 8:00 AM WAT unless YouTube live detection reports an active service, at which point the hero switches to the live-service prompt.
- Live-service and Temple TV hero actions now open the embedded in-site player modal instead of redirecting viewers to YouTube.
- A global in-app upcoming-service pop-up now invites visitors to the Holy Spirit Sunday Service and links them back to the website; a protected push endpoint can send the same alert to active browser push subscribers.
- Backend livestream scanning now runs an accelerated YouTube live check every 5 seconds during the Sunday 8:00 AM–10:30 AM WAT service window, alongside the standard polling fallback.
- Livestream player presence now has its own real-time SSE channel (`GET /api/livestream/viewers/stream`) with a REST snapshot (`GET /api/livestream/viewers`), so active player viewer counts update live in the web player header and embedded chat independently of chat-only connections. Player sessions are tagged as `live` or `rebroadcast`, and cumulative totals are stored in `site_stats` as `live_stream_total_viewers` and `rebroadcast_total_viewers`.

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
- **Intro Teachings automation**: `/sermons/intro` automatically surfaces synced videos whose YouTube duration is 50–70 minutes. The ministry-required sermon “The generation of the Evil One and the generation of the saint” is pinned into the intro feed even while YouTube duration metadata is still pending.
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
- Enterprise blog expansion seeds 24 structured sermon-inspired articles on startup through `artifacts/api-server/src/lib/ministry-blog-seed.ts`. Articles include Scripture Foundation, Introduction, 3 teaching sections, Key Spiritual Lessons, Prayer/Reflection, and Conclusion/CTA.
- Blog storage now includes `author`, `read_time_minutes`, and `featured`; startup migrations add optimized indexes for published posts, categories, topics, featured posts, and full-text search.
- Public discovery endpoints: `GET /api/blog`, `GET /api/blog/categories`, `GET /api/blog/search`, `GET /api/blog/topics`, and `GET /api/blog/:slug`, all with cache headers for fast delivery.

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
- **CORS** — configured production origins plus optional Replit/Render wildcard support only when explicitly enabled
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

## Comprehensive Audit & Hardening (April 2026)

### Critical Bug Fixes
- **`health.ts` cronState type mismatch** — `/api/healthz` was accessing flat `cronState.quotaPausedUntil`, `cronState.lastAPISync`, `cronState.lastWebSubRenewal` etc., but `getCronState()` returns a nested structure (`cronState.youtube.*`, `cronState.websub.*`). Fixed to use correct nested property paths. Health endpoint now correctly reports YouTube quota state, sync timestamps, and WebSub renewal data.

### TypeScript Hygiene — Zero-Error Build
- Built all shared lib packages (`@workspace/db`, `@workspace/api-zod`, `@workspace/api-client-react`, `@workspace/integrations-openai-ai-server`, `@workspace/integrations-openai-ai-react`) which resolved 109 TS6305 errors across the API server and 27+ errors across the frontend.
- All remaining `TS7006 implicit any` parameters confirmed clean with both `tsc --noEmit` and `tsc --noEmit --skipLibCheck`.

### Post-Merge Script Hardened
- `scripts/post-merge.sh` now builds all 5 lib packages in dependency order after `pnpm install`.
- Post-merge timeout raised from 20s → 180s (3 minutes) to accommodate full lib build cycle.

### UX Improvement — Give Page Copy-to-Clipboard
- All NGN bank account numbers (UBA, FCMB, GTBank, Zenith Bank), USD account number, and Swift code on `/give` now have a click-to-copy button with a checkmark confirmation and toast notification. No clipboard icon shown until hover to keep the layout clean.

### Error Visibility Improvement
- `Prayer.tsx` fetch failure (loading prayer requests) now logs the error to the console with `console.warn` instead of silently swallowing it — making it easier to debug network issues without surfacing errors to users.

---

## AdSense Monetization — Production-Ready Implementation (April 2026)

### Google Consent Mode v2 — Fully Integrated
- Added Consent Mode v2 script block in `index.html` BEFORE the AdSense `<script>` tag.
- Defaults all consent signals to `denied` on every page load: `ad_storage`, `analytics_storage`, `ad_user_data`, `ad_personalization`.
- `wait_for_update: 2000` gives the React app 2 seconds to update signals before Google makes bidding decisions.
- On page load: if user has a saved consent choice, `CookieConsent.tsx` immediately re-fires `gtag('consent','update',{...})` to restore their signals.
- When user makes a new choice: `accept()` in `CookieConsent.tsx` calls `signalConsentToGoogle()` before dispatching the local event.
- Benefit: Google can serve non-personalized ads even to non-consenting users (contextual targeting), while full personalization is enabled for consenting users. No policy violations.

### AdSlot — Consent-Gated Rendering
- `AdSlot` now imports and reads `useCookieConsent()`. 
- If `consent` is `null` (user hasn't decided yet), the slot returns `null` — no ad placeholder shown while the consent modal is open.
- If `consent.advertising === false` (user chose Essential Only), slot returns `null` — respects user's explicit choice.
- If `consent.advertising === true` (user accepted advertising), slot loads normally via `IntersectionObserver` lazy loading.

### Dead Code Removed
- `AdSenseHead()` component returned `null` and did nothing. Removed from `AdSense.tsx` and cleaned up its import and usage from `App.tsx`.

### New Ad Placements — Blog Pages
- `Blog.tsx`: `AdSlot` (blogFeed, minHeight=120, eager) placed between featured posts and the article library grid — maximum visibility before the primary content area.
- `BlogPost.tsx`: Two placements — (1) `blogPost` slot (eager, minHeight=120) above the article content, after the header card; (2) `blogFeed` slot (lazy, minHeight=120) after the content, before the "Continue Growing" CTA.
- Both blog slots fall back to existing configured slot IDs: `blogFeed` → `VITE_ADSENSE_SLOT_SERMON_FEED` (2094061938), `blogPost` → `VITE_ADSENSE_SLOT_HOME_MID` (6447631104). Add `VITE_ADSENSE_SLOT_BLOG_FEED` and `VITE_ADSENSE_SLOT_BLOG_POST` secrets to use dedicated slots when created in the AdSense dashboard.

### app-ads.txt Created
- `public/app-ads.txt` created with the same publisher line as `ads.txt`: `google.com, pub-6817509745706083, DIRECT, f08c47fec0942fa0`. Required for app-based monetization compliance.

### Complete Ad Placement Inventory (Production)
| Page | Slot Env Var | Slot ID | Format | Loading |
|------|-------------|---------|--------|---------|
| Home (hero) | VITE_ADSENSE_SLOT_HOME_HERO | 7433409715 | auto | Eager |
| Home (mid) | VITE_ADSENSE_SLOT_HOME_MID | 6447631104 | auto | Lazy |
| Sermons (feed) | VITE_ADSENSE_SLOT_SERMON_FEED | 2094061938 | auto | Lazy |
| SermonDetail (below player) | VITE_ADSENSE_SLOT_LIVE_BELOW_PLAYER | 2069402391 | auto | Eager |
| SermonDetail (sidebar) | VITE_ADSENSE_SLOT_SERMON_SIDEBAR | 2609067251 | rectangle | Lazy |
| IntroVideos (feed) | VITE_ADSENSE_SLOT_INTRO_FEED | — (not set) | auto | Lazy |
| Blog (feed header) | VITE_ADSENSE_SLOT_BLOG_FEED | fallback: 2094061938 | auto | Eager |
| BlogPost (above content) | VITE_ADSENSE_SLOT_BLOG_POST | fallback: 6447631104 | auto | Eager |
| BlogPost (below content) | VITE_ADSENSE_SLOT_BLOG_FEED | fallback: 2094061938 | auto | Lazy |

### Outstanding — To Do in AdSense Dashboard
- Create dedicated ad units for Blog Feed and Blog Post placements, then set `VITE_ADSENSE_SLOT_BLOG_FEED` and `VITE_ADSENSE_SLOT_BLOG_POST` secrets with those IDs.
- Create and set `VITE_ADSENSE_SLOT_INTRO_FEED` — the IntroVideos page placement will silently skip rendering until a valid slot ID is configured.

---

## Replit Migration Status

- Dependencies installed with `pnpm install`.
- Active Replit services verified running: web, API, and Expo mobile preview.
- Web preview verified at `/` with API health returning OK.
- Client/server secret separation checked: sensitive keys are referenced from the API server, not the browser client.
- Google Cloud Storage credentials are configured server-side via the `GCS_SERVICE_ACCOUNT_KEY` secret. The backend accepts either full service-account JSON/base64 JSON or a private-key-only secret paired with `GCS_PROJECT_ID` and `GCS_CLIENT_EMAIL`.
- Intended Google Cloud Storage bucket configuration is set to `jctm-uploads` (`PUBLIC_OBJECT_SEARCH_PATHS=/jctm-uploads/public`, `PRIVATE_OBJECT_DIR=/jctm-uploads/.private`). Bucket creation is blocked until billing is enabled on Google Cloud project `jctm-492511`, or an existing accessible bucket is provided.
- Gallery uploads now default to database-backed local object storage (`OBJECT_STORAGE_DRIVER=database`). Uploaded image bytes and generated thumbnails are stored in the `local_objects` PostgreSQL table and served through the existing `/api/storage/objects/...` URLs, while gallery metadata remains in `gallery_images`.

## Admin Real-Time Operations Dashboard

- Dashboard overview now consumes `GET /api/admin/realtime` and `GET /api/admin/realtime/stream` for a unified operational snapshot.
- The stream combines active website visitor sessions from `/api/visitors/*`, active live-player viewer sessions from `/api/livestream/viewers/*`, and 24-hour engagement counts from messages, prayers, testimonies, moments, broadcast events, members, and push subscribers.
- Admin overview includes a real-time audience command panel with active audience, active live viewers, active rebroadcast viewers, cumulative live/rebroadcast viewer totals, active website visitors, 24-hour engagement, device presence, and a 5-second trend chart.

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
- **`GET /sitemap.xml`** — static pages (including `/gallery`) + all dynamic sermon URLs with image extensions
- **`GET /sitemap-sermons.xml`** — Sermon-specific sitemap for Googlebot-Video with VideoObject-compatible data
- **`GET /sitemap-gallery.xml`** — Gallery image sitemap with up to 1,000 published gallery thumbnails/images attached to `/gallery`

### Gallery SEO (`artifacts/jctm-platform/src/pages/Gallery.tsx`)
- `/gallery` now emits ImageGallery/CollectionPage JSON-LD, ImageObject entries for visible published photos, gallery FAQ schema, strong Open Graph/Twitter metadata, Nigerian local SEO context, and accessible semantic `figure` cards.
- `robots.txt` allows Google Image crawler access to `/gallery` and `/api/storage/`, and advertises the gallery image sitemap.

### `robots.txt` (`artifacts/jctm-platform/public/robots.txt`)
- Points to both `sitemap.xml` and `sitemap-sermons.xml`
- Allows Googlebot, Bingbot, Twitterbot, WhatsApp, Facebook crawlers
- Blocks development paths, AI scrapers, bad bots

---

## Conference Registration Page — Full Structural Alignment (April 2026)

`/conference-registration` now matches the Warri Crusade page's structure, layout, and UX exactly:

- **Unified background** — Single `min-h-screen` div with purple gradient replacing the old split hero/main-content sections.
- **SEO structured data** — Full JSON-LD Event schema + breadcrumbs added (matching Crusade).
- **Hero** — `text-5xl md:text-7xl` title with animated badge (`scale` entrance), `y:40 → y:0` at `0.8s` duration; theme quote card below; event meta as simple inline flex (no pill backgrounds).
- **Countdown timer** — Now rendered in the hero between header and registration card, using the existing `useCountdown(CONF_START)` hook; shows "The Conference Is Happening NOW!" when started.
- **`ConferenceFlyerShowcase`** — Now rendered in the page (was defined but never called).
- **Two-column grid** — Registration card (left) + Google Maps embed (right); matching Crusade's layout.
- **`invitedBy` banner** — Moved inside the registration card (matching Crusade), not outside.
- **`ConferenceInviteCardGenerator`** — Now lives below the two-column grid, pre-filled with `rsvpName`/`rsvpPhoto` after successful registration (matching Crusade's pattern).
- **"Spread the Word" section** — Added at the bottom with WhatsApp, Facebook, and X share buttons and phone number.
- **Unused imports removed** — `ArrowLeft`, `Link` (from wouter) cleaned up.

---

## Recent Enhancements (April 2026)

### Ministers Conference Flyer Sharing
- Home page Ministers Conference 2026 section now uses the uploaded official flyer image from `attached_assets` via Vite asset import.
- Added visitor-facing flyer actions: direct JPEG download, native mobile share/copy fallback, and quick links for WhatsApp, Facebook, X, Telegram, LinkedIn, and Instagram.
- Conference location text updated to Church Auditorium, Km1 East West Rd., Ebrumede Roundabout, Effurun Uvwie L.G.A., Delta State.
- Added a production-ready audience invite-card generator to the homepage Ministers Conference section: name input, local photo upload/cropping, private browser-side 1080×1440 PNG canvas generation, download, native file sharing, and fallback download/copy behavior.
- The same audience invite-card generator is also available on `/events` so visitors can create cards after opening the conference details page.

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

---

## Comprehensive System Optimization — April 2026

### Security Hardening
- **`GET /api/giving`** (donor logs) now requires a valid admin JWT (`X-Admin-Token` header). The public-facing stats endpoint (`/api/giving/stats`) remains open. Prevents leaking donor names, emails, and amounts.
- **`GET /api/testimonies?all=true`** now silently ignores `all=true` unless the request carries a valid admin JWT. Without auth, only approved testimonies are returned — prevents moderation bypass.
- **Prayer input validation** (`POST /api/prayer/generate`): `need` field capped at 2000 characters, `name` at 80 characters, `category` validated against an allowlist of 11 values. Prevents unbounded OpenAI prompt injection.
- **Reference collision fix** (`POST /api/giving`): replaced `Math.random().toString(36)` with `randomUUID()` — cryptographically unique, no collision risk under load.
- **Members endpoint** (`GET /api/members`): added server-side max limit cap of 100 rows and bounds enforcement (offset ≥ 0) — prevents full-table dumps.

### Reliability Improvements
- **Blog error logging** — all catch blocks in `/api/blog`, `/api/blog/search`, `/api/blog/categories`, and `/api/blog/:slug` now call `logger.error()` with the full error object, making production failures immediately visible in structured logs.
- **Altar simulation interval** — `setInterval` handle is exported as `altarSimInterval` and cleared in the shutdown sequence alongside `stopCron()`. Prevents the ghost-client simulation from running after `SIGTERM`.

### Performance Improvements
- **Blog list parallelism** — `GET /api/blog` and `GET /api/blog/search` now fire the paginated list query, the count query, and (for offset=0) the featured posts query via `Promise.all()`, halving round-trip time.
- **Blog bounds validation** — `limit` clamped to 1–50, `offset` to ≥0 on all blog and search endpoints.
- **DB performance indexes** added at startup (idempotent `CREATE INDEX IF NOT EXISTS`):
  - `member_directory` — `first_name`, `last_name` ILIKE search
  - `sermon_data` — `published_at DESC`, `video_id`, `is_live` partial
  - `prayer_requests` — public-wall query (is_public = true, created_at DESC)
  - `testimonies` — approved feed (approved = true, created_at DESC)
  - `giving_logs` — `reference` lookup, `status` + `created_at` admin report
  - `push_subscriptions` — active subscriber visitor_id lookup

### Code Quality
- **`App.tsx` provider nesting** — fixed inconsistent indentation in `LanguageProvider` → `GeoProvider` → `QueryClientProvider` tree.
- **Giving reference generator** — refactored from `Date.now() + Math.random().toString(36)` to `Date.now() + randomUUID()` for guaranteed uniqueness.

---

## YouTube Live Streaming Pipeline Optimization — April 2026

### Adaptive Quality & Network-Aware Playback
- **`buildYouTubeUrl` upgraded** (`DualStreamToggle.tsx`): now accepts an options object `{ autoplay, isLive, enableJsApi }`. Live streams omit the `vq` quality hint (YouTube's ABR engine handles adaptive bitrate internally); VOD streams pass `vq=small` or `vq=hd1080` as a preference hint.
- **`enablejsapi=1`** added to all embed URLs by default, enabling postMessage-based error detection without requiring the YouTube IFrame API script.
- **`fs=1`** (fullscreen enabled) added to all embed URLs.
- **`useAdaptiveStreamQuality` hook** added: auto-detects network quality via `navigator.connection.effectiveType` on mount (slow-2g/2g → Low Data mode; 3g/4g → HD). Re-evaluates on `connection.change` events. Stored user preference in localStorage always takes precedence.

### Live Player — Quality Toggle + Error Failover
- **`DualStreamToggle` integrated** into the live player modal header in `Home.tsx`. Changing quality forces an iframe remount via `playerKey` state to immediately switch streams without stale buffering.
- **`NetworkQualityBadge`** component added: compact dark-mode badge shown inside player overlays indicating current quality mode.
- **YouTube postMessage error detection**: `window.addEventListener('message', ...)` listens for `onError` events from the YouTube iframe origin. On error, a full-screen "Stream Interrupted" overlay replaces the loading spinner with two recovery actions:
  - **Retry Stream** — resets error state, increments `playerKey` (remounts iframe fresh)
  - **Watch on YouTube** — opens the direct YouTube watch URL in a new tab as fallback
- **`onStateChange` info=1 (Playing)**: clears both loading and error states when the stream confirms it started playing.

### All Iframes Hardened (Home.tsx + SermonDetail.tsx)
Every YouTube embed across the platform now has:
- `referrerPolicy="strict-origin-when-cross-origin"` — correct privacy-enhanced referrer policy
- `allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"` — full permission set
- `enablejsapi=1` — postMessage error detection
- `fs=1` — explicit fullscreen permission
- `modestbranding=1` + `rel=0` — consistent branding suppression across all players
- Quality-aware URLs via `buildYouTubeUrl()` with appropriate options

Affected players: live broadcast overlay, rebroadcast widget overlay (HeroSection), rebroadcast banner overlay (RebroadcastBanner), sermon detail player (SermonDetail).

### Viewer Count SSE Reconnect
- **`useLiveViewerCount.ts`**: the viewer-presence SSE previously called `es.close()` on error and never reconnected. Now uses the same exponential-backoff reconnect pattern as `useLivestreamStatus` (1s → 2 → 4 → 8 → 16 → 30s cap). The 15-second REST polling fallback remains active as a secondary floor.
- SSE is correctly torn down (close + timer clear) when `countThisViewer` becomes false (player closed), preventing ghost sessions.

### Health Check Endpoint
- **`GET /api/livestream/health`** (public, no auth): returns a real-time snapshot of the streaming pipeline — `status` (ok/degraded), `isLive`, `isUpcoming`, `videoId`, `rebroadcastActive`, `manualOverride`, `activeSseClients`, `activeViewers`, `youtubeApiReady`, `serverTime`. Used by monitoring and potential client-side failover logic.

### CDN Pre-resolution (index.html)
Three new dns-prefetch hints added to reduce initial buffering latency when the player opens:
- `https://googlevideo.com` — YouTube's primary video delivery CDN
- `https://r1---sn-h0jelnez.googlevideo.com` — a common YouTubeCDN edge node
- `https://s.ytimg.com` — YouTube's static player asset CDN
