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

**Ministry**: Jesus Christ Temple Ministry (JCTM), Warri, Delta State, Nigeria
**Leader**: Prophet Amos Evomobor
**Mission**: Primitive Christianity, Holiness, and the Correction Mandate

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
