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

### New Features Added (April 2026 — Vision 2030 Upgrade)
- **Dark/Light Theme Toggle ("Midnight Mandate" / "Ivory Sanctuary")** — `ThemeContext.tsx` manages theme state with localStorage persistence + OS preference detection. Navbar shows moon/sun toggle. `.dark` class applied to `<html>` element, CSS vars fully defined in `index.css`.
- **AI Prayer Generator** — `/prayer` page with SSE streaming, 10 prayer categories (healing, deliverance, guidance, peace, provision, family, protection, salvation, strength, general), real-time prayer text reveal, copy-to-clipboard. Backend: `routes/prayer.ts` with dedicated system prompt grounded in JCTM doctrine.
- **Daily Devotion AI Feed** — `GET /api/devotion/daily` generates a scripture-based devotion each morning (in-memory cache, refreshes daily). Homepage `DailyDevotionSection` shows title, scripture, 2-3 paragraphs of reflection, prayer focus, and bold faith declaration. Backend: `routes/devotion.ts`.
- **Enhanced TempleBots Emotional Intelligence** — System prompt now has explicit EI protocols for: anxiety/fear/worry → scripture + personalized prayer; grief/depression/suicidal ideation → compassion-first + comfort scriptures; anger/injustice → validation + biblical perspective; spiritual crisis/doubt → non-preachy, Correction Mandate story, gentle guidance.

### New Features Added (April 2026 Enhancement Sprint)
- **Global Altar SSE Counter** — `/api/altar/stream` SSE endpoint tracks live worshippers; `GlobalAltar.tsx` component with animated spring counter, region flags, pulsing rings, trend arrows
- **Interactive Mandate Map** — `MandateMap.tsx` SVG-based world map with 11 glow points (Warri HQ + global hubs), travelling pulse animations, connection lines, hover tooltips showing flag + reach stats
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
12. **GlobalReach** — Dark impact section: animated counters (sermons, views, nations, years), region chips with emoji flags
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
- **SEO Meta Tags** — OpenGraph tags, description, apple-mobile-web-app, theme-color in `index.html`
- **Live Banner** — Auto-shown when livestream is active (in-memory state)

### Architecture
- **Frontend**: `artifacts/jctm-platform` — React + Vite, port from `PORT` env var
- **Backend**: `artifacts/api-server` — Express 5 + Drizzle ORM, port 8080
- **DB**: PostgreSQL tables: sermons, testimonies (title, likeCount), events, giving_logs, members, member_auth
- **Auth**: `member_auth` table — SHA-256 password hashing with salt, random token per login, Bearer token auth
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

### Environment Variables (Optional)
- `YOUTUBE_API_KEY` — Enables YouTube sync for sermons
- `PAYSTACK_SECRET_KEY` — Enables live Paystack payment gateway (NGN)
- `STRIPE_SECRET_KEY` — Enables Stripe for USD payments

### Important: Date Serialization
Drizzle returns `Date` objects from PostgreSQL. All API routes must convert date fields to ISO strings before Zod validation (`.toISOString()`). See `sermons.ts`, `events.ts`, `testimonies.ts`, `members.ts`, `auth.ts`.
