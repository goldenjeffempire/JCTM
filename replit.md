# JCTM Digital Sanctuary

## Overview

The JCTM Digital Sanctuary is a full-stack pnpm monorepo designed to serve as a comprehensive, production-grade digital platform for the Jesus Christ Temple Ministry. Its primary purpose is to expand the ministry's global outreach and provide spiritual resources through technology. Key capabilities include delivering sermons, offering AI-powered assistance via TempleBots, facilitating donations through a giving portal, and engaging the community with features like a real-time global altar counter. The project aims to establish a robust online presence that supports JCTM's mission and fosters spiritual growth worldwide.

## User Preferences

I want iterative development and detailed explanations of changes.

## System Architecture

The project is built as a pnpm monorepo, separating concerns into distinct packages:

-   **Frontend (`@workspace/jctm-platform`):** A Single Page Application (SPA) utilizing React 18, Vite 7, and Tailwind CSS v4.
-   **Backend (`@workspace/api-server`):** Powered by Express 5, Drizzle ORM, and Pino for logging.
-   **Database Client (`@workspace/db`):** Manages Drizzle schema definitions and interfaces with Neon PostgreSQL.
-   **API Types (`@workspace/api-zod`):** Contains shared Zod schemas for API request and response validation.
-   **API Hooks (`@workspace/api-client-react`):** Provides TanStack Query wrappers for efficient data fetching in the frontend.

**Key Architectural Decisions & Features:**

-   **Event Promotion Engine:** A time-driven system managing event lifecycles, promotions, and multi-channel notifications (web push, Expo, email, SSE). It includes API routes for public access and admin management, featuring an admin tile for event statistics and broadcast control with a 5-minute cooldown for manual sends. A generic campaign promotion broadcast mode allows admins to configure recurring multi-channel broadcasts without code changes.
-   **Event Notification Scheduler:** A robust scheduler that runs every 30 minutes, handling multi-channel event reminders with idempotency, supporting email, web push, Expo push, and SSE. It tracks subscribers and dispatch logs and offers public subscription and admin management APIs.
-   **Production-grade Live Location Maps:** Implemented using Leaflet 1.9, react-leaflet 5, and OpenStreetMap tiles. Maps are lazy-loaded via `React.lazy` and `IntersectionObserver` for performance, feature branded pins, interactive popups, deep-linking, and a robust venue registry for easy event location management.
-   **UI/UX and Design:** Employs consistent JCTM branding with a purple gradient theme, responsive design via Tailwind CSS, and dynamic, interactive elements. Accessibility is a core consideration, with semantic HTML and clear navigation.
-   **Technical Implementations:**
    -   **Database Schema:** Comprehensive schema supporting sermons, events, giving, members, conversations, crusades, knowledge bases, daily devotions, and more.
    -   **Role-Based Admin System:** Granular access control using HMAC-signed JWTs for `gallery`, `sermon`, and `livestream` roles.
    -   **YouTube Sync Pipeline:** A three-layered system combining WebSub, RSS polling, and YouTube Data API v3 for near real-time sermon synchronization.
    -   **Featured Sermon Pinning:** Admins can pin sermons, influencing display priority and YouTube auto-promotion.
    -   **Home Page Video Overrides:** Admins with the `sermon` role can independently set the YouTube video IDs shown in the "Today's Highlights" (BentoGrid) and "Latest Broadcast" (SermonSpotlight) sections via a dedicated card in the Admin → Sermons panel. Settings are stored in `app_settings` with keys `home_highlight_video_id` and `home_broadcast_video_id`. A public `GET /api/home-videos` endpoint returns both values to the frontend; admin endpoints at `POST/DELETE /api/admin/home-videos/{highlight,broadcast}` manage them. Clearing an override falls back to the auto-featured sermon.
    -   **Gallery Feature:** Enterprise-grade bulk media management with multi-select/bulk-delete (up to 200 IDs), 100-image batch uploads, drag-and-drop, 8-parallel upload processing with auto-retry (3 attempts, exponential backoff), client-side image compression (Canvas API → JPEG at 1920px / 0.87q), fingerprint-based duplicate detection, queue management (retry failed, clear done), upload stats summary, SSE-based real-time thumbnail updates, and a `POST /gallery/bulk` endpoint for single-round-trip batch creation. A floating `BulkActionsBar` appears in selection mode; `BulkDeleteModal` confirms before permanent removal.
    -   **Live Stream Stability:** Adaptive quality, robust error handling, and real-time viewer counts via SSE.
    -   **Monetized YouTube Embeds:** A canonical `YouTubeEmbed` component supporting `facade` (lazy load for monetization) and `eager` modes, with standardized URL parameters and analytics tracking.
    -   **Broadcast Automation Engine:** AI-powered sermon rebroadcast curation using algorithmic scoring and GPT-4o-mini for metadata generation.
    -   **PWA Implementation:** Service worker for offline capabilities and push notifications.
    -   **SEO Architecture:** Extensive SEO features including Schema.org JSON-LD, canonical URLs, Open Graph, Twitter Cards, geo meta tags, and dynamic sitemaps.
    -   **AI Features:** Includes a custom JCTM Local AI Engine for specific intents, and OpenAI (GPT-4o) integration for daily devotions, TempleBots, sermon assistance, scripture study, voice chat, and translation. Daily devotions are rendered as plain text, with a fallback pool for generator unavailability.
    -   **Unified Contact FAB:** A collapsible Floating Action Button providing access to TempleBots, voice assistant, WhatsApp, phone, and Zoom, with state persistence and live service indicators.
    -   **Security:** Implements Helmet, rate limiting, Gzip compression, scrypt hashing, CORS, and JSON body limits.
    -   **Performance:** Achieved through code splitting, lazy loading, TanStack Query, Vite optimization, and production-specific builds.
    -   **Monetization:** AdSense integration with Google Consent Mode v2 for compliant ad rendering.

## Email Infrastructure (SMTP)

The platform uses a production-grade outbound SMTP email system via **mail.jctm.org.ng** (port 587, STARTTLS).

**Configuration (all stored as Replit Secrets / shared env vars):**
- `SMTP_HOST` = `mail.jctm.org.ng`
- `SMTP_PORT` = `587`
- `SMTP_SECURE` = `false` (STARTTLS on 587, not implicit TLS)
- `SMTP_USER` = `info@jctm.org.ng`
- `SMTP_PASS` = *(secret)*
- `SMTP_FROM` = `Jesus Christ Temple Ministry <info@jctm.org.ng>`
- `SMTP_REPLY_TO` = `info@jctm.org.ng`
- `SMTP_POOL_MAX` = `3`
- `SMTP_RATE_LIMIT` = `5`

**Core module:** `artifacts/api-server/src/lib/email-engine.ts`
- nodemailer with connection pooling, STARTTLS enforcement, TLS 1.2+ minimum
- Retry-with-backoff on transient errors (4xx SMTP codes, network errors) — up to 4 attempts
- Health state tracking (`getEmailHealth()`) exposed to admin dashboard
- Startup `verify()` call logs `"SMTP transport verified — email delivery ready"` on success
- No-op graceful fallback when `SMTP_PASS` is missing (subscribers still saved, warns in logs)

**Email flows implemented:**
| Flow | Trigger | Template function |
|---|---|---|
| Daily devotion | Cron (daily) | `sendDevotionEmail` |
| Devotion welcome | `POST /api/devotion/subscribe` | `sendWelcomeEmail` |
| Member registration welcome | `POST /api/auth/register` | `sendMemberWelcomeEmail` |
| Password reset | `POST /api/auth/forgot-password` | `sendPasswordResetEmail` |
| Event reminder | Event notification scheduler | `sendEventNotificationEmail` |
| Admin SMTP test | `POST /api/admin/email/test` (admin auth) | `sendTestEmail` |

**Password reset flow:**
- `POST /api/auth/forgot-password` — accepts `{email}`, generates a 1-hour token, stores in `password_reset_tokens` table, sends branded reset email. Always returns generic 200 (no user-enumeration).
- `POST /api/auth/reset-password` — accepts `{token, password}`, validates token (expiry + used_at), updates password hash, rotates session token, marks reset token consumed.
- DB table: `password_reset_tokens` (id, member_id FK, token UNIQUE, expires_at, used_at, created_at)

**SPF / DKIM / DMARC recommendations for jctm.org.ng:**
- **SPF:** `v=spf1 mx a:mail.jctm.org.ng ~all` — authorises the mail server to send on behalf of the domain
- **DKIM:** Configure in your cPanel/Plesk mail server; ensure the selector is published as `mail._domainkey.jctm.org.ng`
- **DMARC:** `v=DMARC1; p=quarantine; rua=mailto:info@jctm.org.ng; adkim=r; aspf=r` — starts in quarantine mode for monitoring

## External Dependencies

-   **PostgreSQL:** Main relational database, hosted on Neon.
-   **Google Cloud Storage (GCS):** For object storage, integrated via Replit App Storage.
-   **YouTube Data API v3:** Used for syncing and managing YouTube content.
-   **OpenAI API:** Powers various AI functionalities across the platform.
-   **Paystack:** Payment gateway for the giving portal.
-   **Google AdSense:** For website monetization.
-   **Vite:** Frontend build tool.
-   **Tailwind CSS:** Utility-first CSS framework.
-   **Drizzle ORM:** TypeScript ORM.
-   **Express:** Backend web framework.
-   **TanStack Query:** Data fetching library.
-   **Sharp:** Image processing for thumbnails.
-   **Uppy:** File upload library.
-   **Framer Motion:** Animation library.
-   **Three.js:** Used for 3D elements like the Global Altar.
-   **Leaflet, React-Leaflet, OpenStreetMap:** Mapping libraries for venue maps.
-   **Lucide, Radix UI, date-fns:** General utility and UI component libraries.