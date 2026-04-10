# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Project: JCTM Digital Sanctuary

### New Features Added (April 2026 — Vision 2030 Sprint 3 — Major Upgrade)
- **3D Global Altar** (`GlobalAltar3D.tsx`) — React Three Fiber animated sphere with distort material, particle worshippers, 3 orbiting rings, light beams, and stars. `WebGLErrorBoundary` + CSS-based `AltarFallback` for environments where WebGL fails. Integrated into `GlobalAltarSection` on homepage.
- **AI Sermon Assistant** (`/sermon-assistant`) — Full RAG chat interface; backend at `GET /api/sermon-assistant` (SSE streaming), sidebar with suggested questions, conversation history. System prompt grounded in JCTM doctrine.
- **Netflix-Style Sermon Hub** (`/sermons`) — Dark gradient hero header with "TEMPLE TV LIBRARY" badge, DualStreamToggle in header, 10 animated category tabs (All Sermons, Correction Mandate, Holiness, Primitive Christianity, Prophecy, Water Baptism, Prayer, End Times, Family, Healing), 4-column responsive grid with `AnimatePresence` transitions, category section headers with sermon count, animated empty state messages.
- **Live Chat** (`LiveChat.tsx`) — SSE-based real-time moderated chat with reactions. Visible on sermon detail pages when `isLive=true`.
- **Multi-Language Engine** — `LanguageContext.tsx` + `LanguageSelector.tsx` with 17 languages displayed (50+ via AI translation), backend at `POST /api/translate` using OpenAI. `LanguageProvider` wraps entire app in `App.tsx`.
- **Dual-Stream Mode Toggle** (`DualStreamToggle.tsx`) — `useStreamQuality` hook + `buildYouTubeUrl` quality-aware URL builder. Shown on Sermons hub header and individual sermon pages.
- **Leadership & Transparency Page** (`/leadership`) — Prophet Amos Evomobor bio, 5 Corrections the church preaches, ministry values card grid, transparency statement. Route in `App.tsx`.
- **Navbar Updated** — Added 🤖 Ask AI (purple), Leadership, Language Selector, all cross-device.

### New Features Added (April 2026 — Vision 2030 Sprint 2)
- **Temple Moments** (`/moments`) — TikTok/Reels-style vertical video feed pulling from the sermon library. Swipe/arrow-key navigation, progress dots, share button with native Web Share API, gradient dark themes per card. 25 messages loaded on init.
- **Spiritual Growth Tracker** (`/growth`) — Gamified dashboard tracking sermons watched, devotions completed, prayers generated. XP system with 7 levels (New Believer → Mandate Bearer), week heatmap, active streak counter, 13 achievement badges (unlockable), XP progress bar with animated fill. All data persisted in localStorage.
- **Geo-Targeting Service Times** (`GeoServiceTimes.tsx`) — Detects browser timezone and converts JCTM WAT service schedule into local time for every visitor globally. Shows "Service Starting Soon" live alert when within 3 hours of a service. Added to homepage ConnectSection.
- **YouTube API Live Auto-Detection** — `/api/livestream/status` now automatically polls YouTube Data API v3 (using `YOUTUBE_API_KEY`) for active broadcasts on @TEMPLETVJCTM channel. 60-second in-memory cache. Falls back to manual in-memory state when no API key is set. Hero "Join Live" button responds automatically.
- **Navbar Updated** — Added 🎬 Moments (red) and 📈 Growth (green) links with distinct color-coded pill styling, both desktop and mobile.

### New Features Added (April 2026 — Vision 2030 Upgrade)
- **Dark/Light Theme Toggle ("Midnight Mandate" / "Ivory Sanctuary")** — `ThemeContext.tsx` manages theme state with localStorage persistence + OS preference detection. Navbar shows moon/sun toggle. `.dark` class applied to `<html>` element, CSS vars fully defined in `index.css`.
- **AI Prayer Generator** — `/prayer` page with SSE streaming, 10 prayer categories (healing, deliverance, guidance, peace, provision, family, protection, salvation, strength, general), real-time prayer text reveal, copy-to-clipboard. Backend: `routes/prayer.ts` with dedicated system prompt grounded in JCTM doctrine.
- **Daily Devotion AI Feed** — `GET /api/devotion/daily` generates a scripture-based devotion each morning (in-memory cache, refreshes daily). Homepage `DailyDevotionSection` shows title, scripture, 2-3 paragraphs of reflection, prayer focus, and bold faith declaration. Backend: `routes/devotion.ts`.
- **Enhanced TempleBots Emotional Intelligence** — System prompt now has explicit EI protocols for: anxiety/fear/worry → scripture + personalized prayer; grief/depression/suicidal ideation → compassion-first + comfort scriptures; anger/injustice → validation + biblical perspective; spiritual crisis/doubt → non-preachy, Correction Mandate story, gentle guidance.

### New Features Added (April 2026 Enhancement Sprint)
- **Global Altar SSE Counter** — `/api/altar/stream` SSE endpoint tracks live worshippers; `GlobalAltar.tsx` component with animated spring counter, region flags, pulsing rings, trend arrows
- **Ministry Slideshow** — `MinistrySlideshow.tsx` automated crossfade slideshow cycling all 163 images from `attached_assets/` in random order; storytelling captions (Truth / Holiness / Salvation themes) with matching accent colours, progress dots, pause-on-hover, and image counter
- **TikTok-style Testimony Reel** — `Testimonies.tsx` now has Grid/Reel toggle; Reel view shows snap-scroll vertical cards with gradient backgrounds, Amen fire buttons, category badges
- **Predictive TempleBots Hover Whispers** — listens to `jctm:hover-enter` custom events dispatched on section hover (giving, altar, sermons, testimony); shows whisper tooltip with auto-dismiss timer bar
- **Enhanced Glassmorphism** — `index.css` new `.glass-dark`, `.glass-panel` enhanced, `.altar-glow`, `.scrollbar-hide`, `.bento-card-hover`, `.reel-card-enter`, `.glow-dot` animations
- Custom events architecture: `jctm:section-enter` (scroll-based), `jctm:hover-enter` / `jctm:hover-leave` (hover-based) for cross-component communication

### Homepage Structure (Home.tsx — 17 sections)
1. **HeroSection** — Layered parallax, typewriter subtitle cycling ministry themes, floating metric pills (479+ sermons, 40+ nations, 25 years), floating orb particles, magnetic CTA buttons
2. **PlatformBar** — Social proof strip: Temple TV (YouTube), Facebook, Temple TV Broadcast, Global Nations
3. **BentoGrid** — 5-card asymmetric layout: Featured Sermon (large), Live Countdown, Testimony of Day, Impact Numbers mini-card
4. **TestimoniesMarquee** — Two infinite-scroll rows (opposite directions) of testimony cards fetched from /api/testimonies with fallback data; pauses on hover
5. **ProphetSection** — Split layout: stylized bio card with spinning gradient ring avatar, rotating credential badges, pull quote; bio text on right with credentials grid
6. **MandateReveal** — Scroll-linked parallax reveal of "The Bible Is Our Standard" / "Restoring Primitive Christianity" on dark background
7. **SermonSpotlight** — Featured sermon with inline YouTube player, ministry pillars info-cards with tilt physics
8. **RecentSermonsCarousel** — Horizontal scroll-snap carousel fetching live from /api/sermons
9. **MinistryPillars** — 6-card grid with accordion expand on click, scripture reference revealed, gradient accent top-bar on hover
10. **ScriptureFeature** — Full-width Jeremiah 6:16 typographic display on deep navy background with parallax dot grid
11. **EventsSection** — Upcoming events from /api/events/upcoming with date badge cards, hover reveal, skeleton loaders
12. **GlobalReach** — Dark impact section: animated counters (sermons, views, nations, years), **MinistrySlideshow** (163-image crossfade replacing former MandateMap), region chips with emoji flags
13. **GivingBand** — Tithe / Offerings / Missions cards on navy gradient with diagonal line texture; magnetic CTA
14. **NewcomerSection** — 3-step onboarding: Beliefs, Find a Branch, Join a Unit with tilt cards
15. **ConnectSection** — Social channels (YouTube, Facebook, Email) + headquarters location card
16. **TimelineTeaser** — Dark parallax section with CTA to /correction-timeline

### Design System
- **Palette**: Ivory `#FFFEF8`, Temple Blue `#003366`, Sky Blue `#38BDF8`, Near-black `#020b18`
- **Typography**: Georgia/serif for headlines, Inter/sans for body
- **Components**: MagneticButton (spring cursor pull), TiltCard (3D hover physics), AnimatedCounter (scroll-triggered odometer), ScriptureTicker (cycling verses), useTypewriter hook
- **Animations**: Framer Motion throughout; marquee CSS keyframes in index.css; scroll-linked useScroll/useTransform parallax
- **TempleBots**: Smart contextual toasts triggered via CustomEvents "jctm:section-enter" from GivingBand and NewcomerSection

**Ministry**: Jesus Christ Temple Ministry (JCTM), Warri, Delta State, Nigeria
**Leader**: Prophet Amos Evomobor
**Mission**: Primitive Christianity, Holiness, and the Correction Mandate

### Warri City Crusade 2026 (`/crusade`)
Full dedicated event landing page for the Prophet Amos Global Crusade (April 30 – May 1, 2026).
- **Live Countdown Timer** — Animated flip-card countdown to April 30th 6PM WAT; auto-shows "Live Now" when crusade starts
- **RSVP Registration** — "I Will Attend" magnetic form storing data in `crusade_registrations` DB table; live attendee counter
- **Add to Calendar** — One-click Google, Apple (.ics), and Outlook links
- **Interactive Map** — Google Maps iframe embed for Ighogbadu Primary School, Okumagba Avenue, Warri
- **Automated Ad Copy Generator** — 3 platform-specific versions (Short/Medium/Long) for Instagram, Facebook, YouTube with copy-to-clipboard
- **Shareable Invite Card** — HTML5 Canvas generator; user types their name, downloads/shares a branded 1080×1080 PNG invite
- **YouTube Ad Banner** — `CrusadeAdBanner` component embedded on sermon detail pages (dismissable overlay)
- **Browser Push Notifications** — Permission-based scheduling: 7 days, 24 hours, 1 hour before crusade start
- **Social Share Buttons** — WhatsApp, Facebook, X/Twitter one-click deep-link sharing
- **SEO** — Page title, meta description targeting Prophet Amos, Rapture Crusade 2026, JCTM keywords
- **Navbar** — Gold-highlighted `🔥 Crusade` link in main navigation
- **DB Table**: `crusade_registrations` (full_name, email, phone, city, will_attend)
- **API Routes**: `POST /api/crusade/register`, `GET /api/crusade/count`

### Features
- **Sermon Hub** — 20 latest YouTube sermons (Uploads Playlist API), filters Shorts, hqdefault thumbnails, Watch on YouTube links
- **TempleBots AI** — Floating chat widget powered by OpenAI via Replit integration
- **Giving Portal** — Currency toggle (NGN/USD), giving type selector, Paystack (NGN) / Stripe (USD), preset amounts, bank transfer details
- **Testimony Vault** — Masonry grid with category filters, 3-step submission form, Amen/like button (flame icon, optimistic UI), title + likeCount fields
- **Events Calendar** — Countdown timers per event, YouTube Live embed toggle, upcoming/past sections
- **Member Join** — `/join` page with registration, login, member dashboard (localStorage token), links to resources
- **Member Directory** — Searchable grid with role badges (existing `/members` page)
- **Correction Timeline** — 5 core corrections (1994–2016) with animated scroll-driven timeline, error/correction/scripture for each
- **About Page** — Enhanced: Prophet bio, doctrines, Vision & Mission section, Ebrumede Temple history timeline
- **Privacy Policy** (`/privacy`) — GDPR + NDPR compliant, 10 sections covering data collection, member data security, giving records, and user rights
- **Terms of Service** (`/terms`) — Rules of Engagement for testimony submissions, giving, TempleBots usage, and membership
- **Custom 404 Page** — Light Sanctuary themed with Psalm 119:105 scripture, Compass icon, Return Home + Visit Sermon Hub buttons
- **Error Boundary** — React ErrorBoundary wrapping entire app; Romans 8:28 themed error UI with Try Again / Return Home buttons
- **TempleBots Contextual Intelligence** — Bot greeting changes based on current page (e.g., giving advice on /give, mandate questions on /correction-timeline)
- **Sonner Toast Notifications** — Global toast system replacing old Toaster; fires on testimony submission and payment processing
- **Lazy-loaded Routes** — All pages use React.lazy() + Suspense with skeleton fallback for faster initial bundle load
- **PWA Manifest** — `/public/manifest.json` with app ID `com.onomelabs.jctm`, theme color, and permissions
- **Full SEO Optimization** — `react-helmet-async` installed; `HelmetProvider` wraps app; reusable `SEO` component (`src/components/SEO.tsx`) with title, description, canonical, OpenGraph, Twitter Card, keywords, JSON-LD structured data, and og:image support. Applied to ALL 19 pages including Home, Sermons, SermonDetail (dynamic VideoObject schema), Leadership (Person schema), About (AboutPage schema), Events (EventSeries schema), and all other routes. `index.html` has base keyword-rich meta tags, `public/robots.txt`, `public/sitemap.xml` (17 URLs). Target keywords: "Jesus Christ Temple Ministry," "JCTM," "Temple TV," "Prophet Amos Evomobor," "Correction Mandate."
- **Live Banner** — Auto-shown when livestream is active (in-memory state)

### Architecture
- **Frontend**: `artifacts/jctm-platform` — React + Vite, port from `PORT` env var
- **Backend**: `artifacts/api-server` — Express 5 + Drizzle ORM, port 8080
- **DB**: PostgreSQL tables: sermons, testimonies (title, likeCount), events, giving_logs, members, member_auth
- **Auth**: `member_auth` table — scrypt password hashing (N=16384, r=8, p=1, 64-byte key) with random per-user salt, timing-safe comparison, random 32-byte token per login, Bearer token auth
- **AI**: OpenAI (gpt-4o) via Replit AI integration, chat route in `api-server/src/routes/chat.ts`
- **API codegen**: Orval generates hooks in `lib/api-client-react` from `lib/api-spec/openapi.yaml`

### API Routes Added
- `POST /api/auth/register` — member registration
- `POST /api/auth/login` — member login (refreshes token)
- `GET /api/auth/me` — get profile from Bearer token
- `POST /api/testimonies/:id/like` — increment Amen count

### Design
- Light Glassmorphism — `.glass-panel` CSS class throughout
- Temple Blue: `#003366` (--primary), Sky Blue: `#38BDF8` (--accent)
- Background: `#FFFFFF`, Serif font for headings, Inter for body

### SEO Overhaul (April 2026 — Search Dominance Sprint)
Complete SEO optimization across the entire platform for dominant Google ranking.

#### Technical SEO
- **`SEO.tsx` component** — Enhanced with: geo meta tags (`geo.region`, `geo.placename`, `geo.position`, `ICBM`), `BreadcrumbList` schema support via `breadcrumbs` prop, `article:published_time` + `article:author` + `article:publisher` for article-type pages, `og:image:width/height`, `og:locale:alternate` for international, `article:modified_time`, `speakable-selector` meta for voice search
- **`index.html`** — Expanded with: DNS prefetch + preconnect for YouTube/fonts, geo meta tags, `BroadcastService` JSON-LD for Temple TV, `FAQPage` JSON-LD (7 JCTM-specific Q&As), `SpeakableSpecification` JSON-LD, richer `ReligiousOrganization` schema (OpeningHours, ContactPoint, hasOfferCatalog, founder details, logo ImageObject), expanded `WebSite` schema with `inLanguage`
- **`robots.txt`** — Expanded with per-bot directives: Googlebot (no delay), Googlebot-Video (sermons), Googlebot-Image, Bingbot (crawl-delay 2), DuckDuckBot, social preview bots (Facebook, Twitter, LinkedIn, WhatsApp); both sitemap URLs listed
- **`sitemap.xml`** — Upgraded with `<lastmod>` dates, `<image:image>` entries for all major pages, image namespace, added /growth page, /crusade elevated to 0.95 priority
- **`sitemap-images.xml`** — New dedicated image sitemap for homepage, about, leadership, sermons, crusade pages

#### Structured Data (JSON-LD) — All 19 Pages
Every page now has rich, valid Schema.org markup:
- **Home**: `WebPage` with speakable + breadcrumb + mainEntity + inLanguage
- **About**: `AboutPage` + `FAQPage` (3 JCTM Q&As) + `BreadcrumbList`
- **Leadership**: Rich `Person` schema (givenName, familyName, honorificPrefix, description, image, knowsAbout[], affiliation) + `FAQPage` (3 Prophet Amos Q&As)
- **Sermons**: `CollectionPage` (speakable) + `ItemList` (9 sermon categories with URLs)
- **SermonDetail**: `VideoObject` (duration, contentUrl, inLanguage, genre, keywords, logo) + dynamic `BreadcrumbList` per sermon
- **Prayer**: `WebApplication` (applicationCategory, featureList) + `FAQPage`
- **Give**: `DonateAction` (recipient with address) + `FAQPage`
- **Events**: `EventSeries` (location, organizer) + `BreadcrumbList`
- **Crusade**: Full `Event` schema (startDate, endDate, eventStatus, location with GeoCoordinates, organizer, performer, Offer with price:0) + `BreadcrumbList`
- **Testimonies**: `CollectionPage` (inLanguage, about) + `BreadcrumbList`
- **Timeline**: `Article` (datePublished, dateModified, publisher with logo, about) + `FAQPage` (five corrections Q&A) + `BreadcrumbList`
- **ViewingCentres**: `ItemList` (15 state centres) + `ReligiousOrganization` HQ with GeoCoordinates + `BreadcrumbList`
- **SermonAssistant**: `WebApplication` (featureList) + `BreadcrumbList`
- **Moments**: `CollectionPage` (inLanguage, author) + `BreadcrumbList`
- **Join**: `WebPage` (about ReligiousOrganization) + `BreadcrumbList`

#### Keywords Expanded
All 19 pages have extended keyword sets targeting: long-tail queries, local SEO (Warri, Delta State, Nigeria), topic-specific terms (each sermon category, each correction), and intent-based searches.

### SEO Sprint #2 (April 2026 — Google Rank #1 Initiatives)

#### 1. Topic Cluster Pillar Pages (8 new SEO content hubs)
New routes `/topics` and `/topics/:slug` with 8 in-depth topic pages:
- **Files**: `src/pages/Topics.tsx`, `src/pages/TopicDetail.tsx`
- **Topics**: holiness, correction-mandate, primitive-christianity, healing-miracles, end-times, water-baptism, prayer-intercession, family-marriage
- Each page has: 400-600 words original content, 3-4 content sections, 3-4 key scriptures, related sermons from API (live search), FAQ section, `Article` + `FAQPage` + `BreadcrumbList` JSON-LD schema
- Added to navbar Resources dropdown and sitemap.xml at 0.85-0.90 priority
- Target queries: "What does JCTM teach about [topic]", "[topic] sermons Nigeria", "JCTM [topic] teaching"

#### 2. AI Sermon Summaries
- **Backend**: `GET /api/sermons/:id/summary` — OpenAI gpt-4o generates 200-250 word summary + 5 key points, in-memory cached
- **Frontend**: `SermonAISummary` component on every sermon detail page — user clicks "Generate" → AI summary appears as indexable text
- Gives Google real text content to crawl on each sermon page (previously just YouTube embed + title)

#### 3. Core Web Vitals Optimization
- **Vite `manualChunks`**: React Core, framer-motion, lucide-react, Radix UI, wouter, tanstack-query, vendor — all split into separate chunks for optimal HTTP/2 loading
- **Font strategy**: Non-blocking font loading (`media="print" onload="this.media='all'"`) with `<noscript>` fallback, `<link rel="preload">` for font CSS
- **Resource hints**: Complete set of `preconnect` + `dns-prefetch` for YouTube, YouTube nocookie, Google Fonts (both domains)

#### 4. Sitemap Expansion
- 9 new entries in `sitemap.xml`: `/topics` hub (0.90) + 8 individual topic pages (0.85-0.88)
- All with `lastmod: 2026-04-09` and `changefreq: monthly`

### Production Hardening (April 2026 — Environment Migration)
Applied when migrating to the Replit environment:
- **Database**: Created all 15 PostgreSQL tables via raw SQL (`sermon_data`, `testimonies`, `event_calendar`, `giving_logs`, `member_directory`, `member_auth`, `conversations`, `messages`, `crusade_registrations`, `knowledge_chunks`, `site_stats` + 4 pre-existing). Note: `knowledge_chunks.embedding` is stored as `text` since pgvector is not available on Replit PostgreSQL.
- **Vite Dev Proxy**: Added `server.proxy` in `vite.config.ts` — all `/api/*` requests from the frontend (port 3000) are proxied to the backend (port 8080). This was the critical missing piece preventing the platform from loading in dev mode.
- **Security Headers**: Added `helmet` middleware — sets `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, `Referrer-Policy` and other headers automatically.
- **Rate Limiting**: Added `express-rate-limit` — 300 req/15min globally, 20 req/min for AI endpoints, 30 req/15min for auth endpoints.
- **Password Hashing**: Upgraded from SHA-256 to Node.js native `scrypt` (N=16384, r=8, p=1) with random per-user salt and `timingSafeEqual` comparison.
- **CORS**: Added `.replit.app` pattern to allow deployed Replit apps to reach the API.
- **JSON body limit**: Reduced from 50 MB to 1 MB for security.

### Environment Variables (Optional)
- `YOUTUBE_API_KEY` — Enables YouTube sync for sermons
- `PAYSTACK_SECRET_KEY` — Enables live Paystack payment gateway (NGN)
- `STRIPE_SECRET_KEY` — Enables Stripe for USD payments

### Important: Date Serialization
Drizzle returns `Date` objects from PostgreSQL. All API routes must convert date fields to ISO strings before Zod validation (`.toISOString()`). See `sermons.ts`, `events.ts`, `testimonies.ts`, `members.ts`, `auth.ts`.
