# JCTM Digital Sanctuary

**The official digital platform of Jesus Christ Temple Ministry (JCTM) — Warri, Delta State, Nigeria.**

Led by Prophet Amos Evomobor, JCTM carries the Correction Mandate: restoring Primitive Christianity and exposing doctrinal error in the modern church. This platform is a living expression of that mandate — bringing the Land of Good News to the digital world.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Features](#features)
- [API Reference](#api-reference)
- [Design System](#design-system)
- [Environment Variables](#environment-variables)
- [Database](#database)
- [Deployment](#deployment)

---

## Overview

The JCTM Digital Sanctuary is a full-stack monorepo web application consisting of:

| Package | Description |
|---|---|
| `artifacts/jctm-platform` | React + Vite frontend — the public-facing Digital Sanctuary |
| `artifacts/api-server` | Express 5 REST API — sermons, testimonies, events, members, chat |
| `lib/db` | Drizzle ORM schema and PostgreSQL client |
| `lib/api-spec` | OpenAPI 3.0 specification (single source of truth) |
| `lib/api-zod` | Auto-generated Zod schemas from the OpenAPI spec |
| `lib/api-client-react` | Auto-generated TanStack Query React hooks from the OpenAPI spec |

---

## Architecture

```
Browser
  └── jctm-platform (React + Vite, PORT env var)
        └── /api/* → api-server (Express 5, port 8080)
                        └── PostgreSQL (Drizzle ORM)
                        └── OpenAI GPT-4o (TempleBots AI)
                        └── YouTube Data API v3 (Sermon sync)
```

**Frontend → Backend communication** flows through a Vite dev proxy (`/api` → `localhost:8080`). In production, both are served through the same Replit deployment.

**API code generation** is handled by Orval — edit `lib/api-spec/openapi.yaml`, then run `pnpm --filter @workspace/api-spec run codegen` to regenerate Zod schemas and React Query hooks.

---

## Getting Started

### Prerequisites

- Node.js 24+
- pnpm 10+
- PostgreSQL (provided automatically in the Replit environment via `DATABASE_URL`)

### Development

```bash
# Install all dependencies
pnpm install

# Start the API server (port 8080)
pnpm --filter @workspace/api-server run dev

# Start the frontend (PORT env var)
pnpm --filter @workspace/jctm-platform run dev

# Push database schema changes
pnpm --filter @workspace/db run push

# Regenerate API client from OpenAPI spec
pnpm --filter @workspace/api-spec run codegen

# Full typecheck
pnpm run typecheck
```

In the Replit environment, use the **Start Backend** and **Start application** workflows to run both services.

---

## Project Structure

```
/
├── artifacts/
│   ├── jctm-platform/          # React + Vite frontend
│   │   ├── src/
│   │   │   ├── pages/          # Route-level components
│   │   │   ├── components/     # Shared UI components
│   │   │   │   ├── GlobalAltar.tsx     # Live SSE worshipper counter
│   │   │   │   ├── MandateMap.tsx      # Interactive world map
│   │   │   │   ├── TempleBots.tsx      # AI chat widget + whisper tooltips
│   │   │   │   ├── LiveBanner.tsx      # Livestream alert banner
│   │   │   │   └── layout/             # Header, Footer, Layout wrapper
│   │   │   ├── hooks/          # Custom React hooks
│   │   │   ├── lib/            # Utility functions
│   │   │   └── index.css       # Tailwind + custom animations + glassmorphism
│   │   └── public/             # Static assets (logo, manifest, OG image)
│   │
│   └── api-server/             # Express 5 API
│       └── src/
│           ├── routes/
│           │   ├── altar.ts        # Global Altar SSE counter
│           │   ├── sermons.ts      # Sermon CRUD + YouTube sync + SSE
│           │   ├── testimonies.ts  # Testimony CRUD + like endpoint
│           │   ├── events.ts       # Ministry events
│           │   ├── giving.ts       # Giving/donation portal
│           │   ├── members.ts      # Member directory
│           │   ├── auth.ts         # Member auth (register, login, me)
│           │   ├── chat.ts         # TempleBots AI (OpenAI GPT-4o)
│           │   └── livestream.ts   # Livestream status
│           └── lib/
│               ├── youtube-sync.ts # YouTube API sermon harvesting
│               └── sse-broadcaster.ts # SSE client registry
│
├── lib/
│   ├── db/                     # Drizzle ORM — schema + client
│   ├── api-spec/               # openapi.yaml — single source of truth
│   ├── api-zod/                # Auto-generated Zod schemas
│   └── api-client-react/       # Auto-generated TanStack Query hooks
│
└── replit.md                   # Agent memory / project notes
```

---

## Features

### Sermon Hub
- Live YouTube sermon sync via the YouTube Data API
- Filters out YouTube Shorts automatically
- Search, browse, and watch sermons inline
- Featured sermon pinned to the homepage

### Global Altar (Live Worshipper Counter)
- **Backend:** `/api/altar/stream` — Server-Sent Events (SSE) endpoint. Each open connection represents one worshipper; a ghost-client simulator adds realistic fluctuation.
- **Frontend:** `GlobalAltar.tsx` — Spring-animated counter, pulsing rings, regional flag avatars (Nigeria, UK, USA, Canada), live trend arrows (↑/↓).
- The counter updates automatically as people arrive and leave.

### Interactive Mandate Map
- `MandateMap.tsx` — SVG world map with **11 glow points** marking JCTM's global reach.
- Warri, Nigeria (HQ) is highlighted with a star and a stronger pulse.
- Hovering a city reveals its flag, ministry role, and audience reach.
- Animated connection lines and travelling light pulses run from HQ to each hub.

### TempleBots AI Chat
- Floating widget powered by **OpenAI GPT-4o** via the Replit AI integration.
- **Contextual greetings** — the opening message changes based on which page the user is on (sermon advice on `/sermons`, giving guidance on `/give`, etc.).
- **Smart scroll notifications** — when a user scrolls into the Giving or Testimonies sections, a toast prompt appears.
- **Predictive hover whispers** — when a user hovers over the Giving Band or Global Altar section, a whisper tooltip surfaces after 800 ms with a contextual suggestion and a 7-second auto-dismiss timer bar.
- **Quick-link theological bubbles** — pre-set questions users can tap to ask instantly.
- **Reach Us links** — Facebook, Temple TV (YouTube), and Email embedded directly in the chat panel.

### Testimony Vault
- 3-step submission form (identity → testimony → review).
- **Grid view** — masonry layout with category filters and Amen (flame) buttons.
- **Reel view** — TikTok-style vertical snap-scroll feed. Each card has a gradient dark background, category badge, quote icon, and an animated Amen counter.
- Category colours and emoji indicators (Healing, Deliverance, Financial Breakthrough, Marriage Restoration, Salvation).

### Giving Portal
- Currency toggle: Nigerian Naira (NGN) / US Dollar (USD).
- Paystack integration for NGN; Stripe for USD.
- Preset gift amounts, freewill input, and bank transfer instructions.
- Three giving types: Tithe, Offerings, Missions.

### Events Calendar
- Upcoming events fetched from `/api/events/upcoming`.
- Countdown timers for each event.
- Embedded YouTube Live toggle for broadcast events.

### Member Portal
- Registration and login at `/join`.
- SHA-256 password hashing with per-user salt.
- Bearer-token session stored in localStorage.
- Member dashboard with profile and resources.

### Correction Timeline
- Five doctrinal corrections (1994–2016) in a scroll-driven animated timeline.
- Each node includes: the Error, the Correction, and the supporting Scripture.

### Live Broadcast Banner
- Auto-shows a sticky alert when a livestream is active.
- One-click link to Temple TV (YouTube).

### Additional Pages
- **About** — Prophet bio, ministry doctrines, Vision & Mission, Ebrumede Temple history.
- **Privacy Policy** (`/privacy`) — GDPR and NDPR compliant, 10 sections.
- **Terms of Service** (`/terms`) — Rules covering testimonies, giving, TempleBots, and membership.
- **Custom 404** — Psalm 119:105 themed, with Return Home and Sermon Hub buttons.
- **Error Boundary** — Romans 8:28 themed global error fallback.

### PWA & SEO
- `public/manifest.json` — app ID `com.onomelabs.jctm`, theme colour, icons.
- OpenGraph meta tags, apple-mobile-web-app, theme-color in `index.html`.
- All routes lazy-loaded with React Suspense for fast initial load.

---

## API Reference

### Altar
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/altar/stream` | SSE stream — live worshipper count |
| `GET` | `/api/altar/count` | Current worshipper count (JSON) |

### Sermons
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/sermons` | List sermons (paginated, searchable) |
| `GET` | `/api/sermons/featured` | Featured sermon |
| `GET` | `/api/sermons/stats` | Aggregate stats |
| `GET` | `/api/sermons/:id` | Single sermon |
| `POST` | `/api/sermons/sync` | Trigger incremental YouTube sync |
| `POST` | `/api/sermons/harvest` | Full YouTube harvest |
| `GET` | `/api/sermons/stream` | SSE stream for real-time sermon updates |

### Testimonies
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/testimonies` | List approved testimonies |
| `POST` | `/api/testimonies` | Submit a new testimony |
| `POST` | `/api/testimonies/:id/like` | Increment Amen count |

### Events
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/events/upcoming` | Upcoming ministry events |

### Members & Auth
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register a new member |
| `POST` | `/api/auth/login` | Login (returns token) |
| `GET` | `/api/auth/me` | Get profile from Bearer token |
| `GET` | `/api/members` | Member directory |

### Chat (TempleBots)
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/chat` | Send message to TempleBots AI |

### Giving
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/giving/initiate` | Initiate a payment session |

---

## Design System

### Colour Palette
| Token | Hex | Usage |
|---|---|---|
| Temple Blue | `#003366` | Primary text, navbar, buttons |
| Sky Blue | `#38BDF8` | Accent, CTA highlights, glow effects |
| Warm Ivory | `#FFFEF8` | Page background |
| Near-black | `#020b18` | Dark section backgrounds |

### Typography
- **Headings** — Georgia, serif (`font-serif` in Tailwind)
- **Body** — Inter, sans-serif (`font-sans`)

### Key CSS Utilities (index.css)
| Class | Purpose |
|---|---|
| `.glass-panel` | Frosted-glass card (light sections) |
| `.glass-dark` | Frosted-glass card (dark sections) |
| `.altar-glow` | Pulsing cyan glow animation for altar elements |
| `.animate-marquee` | Infinite left-scroll for testimony marquee |
| `.animate-gradient-text` | Shifting gradient text shimmer |
| `.scrollbar-hide` | Hidden scrollbar for reel containers |
| `.bento-card-hover` | Smooth lift-and-scale on hover |
| `.reel-card-enter` | Spring entrance for testimony reel cards |
| `.glow-dot` | Pulsing dot for mandate map glow points |

### Custom Events (Cross-component Communication)
| Event | Payload | Fired By | Listened By |
|---|---|---|---|
| `jctm:section-enter` | `detail: string` (section name) | GivingBand, NewcomerSection, GlobalAltarSection | TempleBots (smart notifications) |
| `jctm:hover-enter` | `detail: string` (section name) | GivingBand, GlobalAltarSection | TempleBots (hover whispers) |
| `jctm:hover-leave` | — | GivingBand, GlobalAltarSection | TempleBots (clears whisper timer) |

### Reusable Components
| Component | Description |
|---|---|
| `MagneticButton` | Spring-based cursor-pull magnetic wrapper |
| `TiltCard` | 3D perspective tilt on mouse move |
| `AnimatedCounter` | Scroll-triggered odometer counter |
| `RippleButton` | Click-ripple effect on buttons |
| `ScriptureTicker` | Cycling scripture display |
| `useTypewriter` | Hook for animated typewriter effect |

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string (auto-set by Replit) |
| `OPENAI_API_KEY` | Yes | OpenAI API key for TempleBots (auto-set via Replit AI integration) |
| `YOUTUBE_API_KEY` | Optional | Enables YouTube sermon sync via Data API v3 |
| `PAYSTACK_SECRET_KEY` | Optional | Live Paystack payments (NGN) |
| `STRIPE_SECRET_KEY` | Optional | Live Stripe payments (USD) |
| `PORT` | Auto | Port for each service (set by Replit workflow config) |

---

## Database

PostgreSQL managed by Drizzle ORM. Schema lives in `lib/db/src/schema.ts`.

### Tables
| Table | Key Columns |
|---|---|
| `sermons` | `id`, `youtubeId`, `title`, `description`, `publishedAt`, `views`, `thumbnailUrl`, `isFeatured` |
| `testimonies` | `id`, `name`, `email`, `title`, `content`, `category`, `videoUrl`, `likeCount`, `approved`, `createdAt` |
| `events` | `id`, `title`, `description`, `eventDate`, `eventType`, `location`, `youtubeStreamId` |
| `giving_logs` | `id`, `amount`, `currency`, `givingType`, `paymentRef`, `status`, `createdAt` |
| `members` | `id`, `fullName`, `email`, `phone`, `location`, `role`, `joinedAt` |
| `member_auth` | `id`, `memberId`, `passwordHash`, `salt`, `token` |

### Migrations / Schema Push
```bash
# Push schema changes to dev database (non-destructive)
pnpm --filter @workspace/db run push
```

> **Important:** Drizzle returns `Date` objects from PostgreSQL. All API routes convert date fields to ISO strings (`.toISOString()`) before Zod validation.

---

## Deployment

This project is built for deployment on Replit.

1. Click **Deploy** in the Replit workspace.
2. Replit builds both the API server and the Vite frontend.
3. The `DATABASE_URL` and `OPENAI_API_KEY` are automatically available in the production environment.
4. The app is served under a `.replit.app` domain (or a custom domain if configured).

Optional payment and YouTube integrations require additional environment variables to be set in the Replit Secrets panel before deploying.

---

## Ministry

**Jesus Christ Temple Ministry (JCTM)**
Ebrumede, Warri, Delta State, Nigeria
Sunday Services · 9:00 AM WAT

- **YouTube (Temple TV):** [youtube.com/templetvjctm](https://www.youtube.com/templetvjctm)
- **Facebook:** [facebook.com/templetvjctm](https://www.facebook.com/templetvjctm)
- **Email:** jesuschristtempleministryng@gmail.com

*"The Bible Is Our Standard."*
