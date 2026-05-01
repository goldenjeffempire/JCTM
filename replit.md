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
    -   **Gallery Feature:** Supports image uploads with client-side compression, server-side thumbnail generation, and GCS storage.
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