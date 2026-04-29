# JCTM Digital Sanctuary

## Overview

This project is a full-stack pnpm monorepo for the Jesus Christ Temple Ministry (JCTM) in Warri, Nigeria. It aims to be a production-grade church platform offering a comprehensive digital experience, including sermons, AI-powered TempleBots, a giving portal, a real-time global altar counter, and various community engagement features. The vision is to provide a robust online presence that supports the ministry's global outreach and spiritual nourishment through technology.

## User Preferences

I want iterative development and detailed explanations of changes.

## System Architecture

The project is structured as a pnpm monorepo with distinct packages for frontend, backend, database client, API types, and API hooks.

**Core Architectural Components:**

-   **Frontend (`@workspace/jctm-platform`):** Built with React 18, Vite 7, and Tailwind CSS v4, operating as a Single Page Application (SPA).
-   **Backend (`@workspace/api-server`):** Uses Express 5, Drizzle ORM, and Pino for logging.
-   **Database Client (`@workspace/db`):** Handles Drizzle schema definitions and connects to Neon PostgreSQL.
-   **API Types (`@workspace/api-zod`):** Shared Zod schemas for API validation.
-   **API Hooks (`@workspace/api-client-react`):** TanStack Query wrappers for data fetching.

**Event Promotion Engine (Time-Driven Lifecycle):**

-   **DB Table:** `event_promotions` — schema in `lib/db/src/schema/eventPromotions.ts`. Stores slug, title, subtitle, artwork, location, CTA, `start_at`/`end_at`, channel toggles (`show_banner`, `show_popup`, `show_sticky_bar`), and a `push_sent_at` lock that guarantees the LIVE-transition push fires exactly once.
-   **API Routes:** `artifacts/api-server/src/routes/eventPromotions.ts`
    -   `GET /api/event-promotions/active` — public, returns the highest-priority active promotion with computed `phase` (upcoming|live|ended), `msUntilStart`/`msUntilEnd`, plus `serverTime` for client clock-skew correction. Cache: 15s s-maxage + SWR.
    -   `GET|POST|PUT|DELETE /api/admin/event-promotions[/:id]` — protected by `requireAdminRole("livestream")`.
-   **Backend Lifecycle:** `checkEventPromotionTransitions` in `artifacts/api-server/src/lib/cron.ts` runs every minute. Fires a "Now Live" web-push + logs to `broadcast_events` when an active promotion crosses its `start_at` (with `push_sent_at` as the idempotency lock). Also fires a one-shot 30-min "starting soon" reminder via `broadcast_events` de-dup.
-   **Recurring 6-hour Reminder Cron:** `checkAndSendEventReminders` (same per-minute tick) walks every active upcoming event and fires across all enabled channels at each crossed boundary in `[6, 12, 18, 24, 30, 36, 42, 48, 60, 72, 96, 120, 144, 168] h` before `start_at`. Catch-up window = 6 h (covers brief outages without resurrecting day-old reminders). Per-boundary idempotency = exact-match `(type='event_reminder', title, message)` row in `broadcast_events`, so a restart never duplicates. Stops at `start_at` (handed off to the LIVE-transition push). Capped at 168 h to avoid spamming for far-future events.
-   **Multi-channel fan-out:** Each reminder fires (a) web-push via `dispatchPushNotification` with `broadcastType: "event_reminder"`, (b) an in-app sonner toast (yellow "Coming Soon" variant) via the SW `BROADCAST_PUSH` relay in `BroadcastEngagementSystem`, (c) a 4-second yellow ring pulse on `EventBanner` triggered by a `jctm:event-reminder` `CustomEvent` the relay dispatches on `window`, plus (d) a fresh `broadcast_events` row that powers the missed-broadcast re-engagement card and SSE banner refresh.
-   **Frontend Hook:** `useActiveEventPromotion` polls `/api/event-promotions/active` every 30s and re-derives `livePhase` + countdown every second on the client clock so the LIVE flip is precise.
-   **Frontend Components** (`artifacts/jctm-platform/src/components/event-promo/`):
    -   `EventStickyBar` — top-of-page minimal countdown bar mounted in `Layout`, dismissible per session, auto-resurrects on phase flip.
    -   `EventBanner` — hero-grade card mounted on `Home` between `HeroSection` and the AdSlot. Royal-blue when upcoming, red glow + pulsing chip when live.
    -   `EventPopupModal` — session-aware (sessionStorage) + 24h cooldown (localStorage) modal mounted on `Home`. Shows independent popups for the upcoming and live phases.
    -   `EventLiveToast` — sonner toast fired exactly once when the client crosses the LIVE boundary (covers users on the site at the moment of transition; web-push covers users with the tab closed).
    -   `GlobalEventAdBanner` — top-center floating ad-style overlay mounted globally at `Layout` root. Renders on every page (load, refresh, and every route navigation), shows the Warri Crusade artwork, title, subtitle, location, live countdown, and a CTA linking to `/crusade`. The `×` close button hides it for the current tab/session only via `sessionStorage["warri_banner_hidden"]`, so it re-initializes on hard refresh and on any new tab/session. Animates in with a fade + slide-down (framer-motion) and is fully reusable for future events through the `EVENT_CONFIG` constant. Replaces the previous inline `CrusadeInviteSection` block on the Home page.

**UI/UX and Design Patterns:**

-   **Consistent Branding:** Adheres to JCTM's visual identity with a purple gradient theme and a focus on clean, accessible interfaces.
-   **Responsive Design:** Implemented with Tailwind CSS for optimal viewing across various devices.
-   **Dynamic Content:** Features like the "Ministry in Pictures" slideshow and "Ministry Blog" dynamically load and refresh content.
-   **Interactive Elements:** Includes click-to-copy functionalities, animated badges, and interactive forms for an engaging user experience.
-   **Accessibility:** Semantic HTML, alt text for images, and clear navigation are prioritized.

**Technical Implementations & Feature Specifications:**

-   **Database Schema:** Core tables include `sermon_data`, `testimonies`, `event_calendar`, `giving_logs`, `member_directory`, `member_auth`, `conversations`, `messages`, `crusade_registrations`, `knowledge_chunks`, `site_stats`, `daily_devotions`, `moment_comments`, `moment_engagements`, `moment_likes`, `broadcast_events`, `livestream_override_state`, and gallery/admin/push/blog/livechat support tables.
-   **Role-Based Admin System:** Three independent admin roles (`gallery`, `sermon`, `livestream`) secured with passphrase-based HMAC-signed JWTs, providing granular access control to protected routes.
-   **YouTube Sync Pipeline:** A three-layered system utilizing WebSub (instant push), RSS (5-min polling with immediate API enrichment), and YouTube Data API v3 (30-min full metadata refresh) for near real-time sermon synchronization and metadata management.
-   **Featured Sermon Pinning:** Admins can manually pin a sermon as the Latest Broadcast / Featured video via `POST /api/admin/sermons/:videoId/pin` (and `/unpin`). The `sermon_data.pinned_at` column drives priority ordering in `/api/sermons/featured`, and pinned videos suppress the daily YouTube auto-promotion for 30 days — solving cases where YouTube uploads multiple copies of the same broadcast with slightly different publish times.
-   **Gallery Feature:** Supports image uploads with client-side compression, server-side thumbnail generation, and GCS object storage. It includes dedicated API endpoints for managing gallery content and integrates with the homepage slideshow.
-   **Live Stream Stability:** Adaptive quality, network-aware playback, robust error handling with self-recovery for YouTube embeds, and real-time viewer count tracking via SSE.
-   **Broadcast Automation Engine:** Features an AI-powered rebroadcast curation system that selects the best sermon for rebroadcast based on algorithmic scoring (recency, view count, featured status, keyword relevance) and generates metadata using GPT-4o-mini.
-   **PWA Implementation:** Includes a service worker for offline capabilities, enhanced manifest with shortcuts, and push notification handling.
-   **SEO Architecture:** Comprehensive SEO with Schema.org JSON-LD (ReligiousOrganization, WebSite, BroadcastService, FAQPage, Event, Person, ImageGallery/CollectionPage), per-page canonical URLs, Open Graph, Twitter Cards, geo meta tags, and dynamic sitemaps for sermons and gallery.
-   **AI Features:**
    -   **JCTM Local AI Engine:** A custom, low-latency inference system for 18 specific JCTM intent types, using TF-IDF keyword scoring and confidence-gated routing.
    -   **OpenAI Integration (gpt-4o):** Used for daily devotions, prayer ministry, TempleBots (for complex queries), Sermon Assistant (RAG over JCTM sermons), Scripture Study, Spiritual Insight, Voice Chat, Translation, and Testimony Reflection.
    -   **Daily Devotion (plain text):** The Devotion page (`/devotion`) and the Home page's daily devotion section render as plain text only — no gradient cards, icons, image-share artwork, or animations. Visual-share generation (`html-to-image` / `toPng`) and per-day card themes have been removed. The fallback pool in `devotion-engine.ts` carries 40 hand-written devotions (40-day rotation) used whenever the AI generator (GPT-4o) is unavailable, ensuring users always receive a fresh daily entry.
-   **Unified Contact FAB (`VoiceTempleBots.tsx`):** A single collapsible floating action button in the bottom-right corner reveals a 5-icon stack: Chat with TempleBot (sky-blue, bottom-24), Voice Assistant (violet, bottom-40), WhatsApp (green, bottom-56), Phone (blue, bottom-72), and Zoom (Zoom-blue, bottom-[22rem]). Expand/collapse state is persisted in `localStorage` (`jctm:contactsExpanded`). A pulsing LIVE badge appears over the master FAB whenever a service is broadcasting (driven by `useLivestreamStatus()`). The "Chat with TempleBot" entry dispatches a `jctm:open-templebots` window event consumed by the standalone `<TempleBots />` widget in `Layout.tsx`, which has had its own floating launcher and scroll-aware search pill removed to avoid duplicate UI; smart notifications and predictive whispers continue to surface as standalone toasts that open the chat on tap.
-   **Security:** Implements Helmet for HTTP security headers, rate limiting, Gzip compression, scrypt password hashing, production-configured CORS, and 1MB JSON body limits.
-   **Performance:** Utilizes code splitting, lazy loading, TanStack Query for optimized data fetching, Vite asset optimization, and production-specific build configurations.
-   **Monetization:** Integrated AdSense with Google Consent Mode v2 for compliant, consent-gated ad rendering and specific placements across various pages.

## External Dependencies

-   **PostgreSQL:** Primary database, hosted on Neon.
-   **Google Cloud Storage (GCS):** Used for object storage of gallery images and other assets via Replit App Storage.
-   **YouTube Data API v3:** For sermon synchronization, metadata fetching, and live stream management.
-   **OpenAI API:** Powers AI features like TempleBots, daily devotions, prayer responses, and sermon assistance.
-   **Paystack:** Integrated for the donation and giving portal.
-   **Google AdSense:** For website monetization, integrated with Google Consent Mode v2.
-   **Vite:** Frontend build tool.
-   **Tailwind CSS:** Utility-first CSS framework.
-   **Drizzle ORM:** TypeScript ORM for database interactions.
-   **Express:** Backend web framework.
-   **TanStack Query:** Data fetching library for React.
-   **Sharp:** Image processing library for thumbnail generation.
-   **Uppy:** File upload library.
-   **Framer Motion:** For animations.
-   **Three.js:** For 3D elements like the Global Altar.
-   **Lucide, Radix UI, date-fns:** Various utility and UI component libraries.