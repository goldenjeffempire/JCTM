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
- **Sermon Hub** — Sermons listing with YouTube sync, Audio Only mode, search
- **TempleBots AI** — Floating chat widget powered by OpenAI via Replit integration
- **Giving Portal** — Paystack integration + preset NGN amounts (NGN currency)
- **Testimony Vault** — Submit & display testimonies with category filtering
- **Events Calendar** — Upcoming events with "Next Up" section
- **Member Directory** — Searchable grid with role badges
- **Correction Timeline** — Horizontal scroll ministry history from 1990s to 2026
- **About Page** — Prophet bio, doctrines, contact info
- **Live Banner** — Auto-shown when livestream is active (in-memory state)

### Architecture
- **Frontend**: `artifacts/jctm-platform` — React + Vite, port from `PORT` env var
- **Backend**: `artifacts/api-server` — Express 5 + Drizzle ORM, port 8080
- **DB**: PostgreSQL with 5 tables: sermons, testimonies, events, giving_logs, members
- **AI**: OpenAI (gpt-4o) via Replit AI integration, chat route in `api-server/src/routes/chat.ts`
- **API codegen**: Orval generates hooks in `lib/api-client-react` from `lib/api-spec/openapi.yaml`

### Design
- Light Glassmorphism — `.glass-panel` CSS class throughout
- Temple Blue: `#003366` (--primary), Sky Blue: `#38BDF8` (--accent)
- Background: `#FFFFFF`, Serif font for headings, Inter for body

### Environment Variables (Optional)
- `YOUTUBE_API_KEY` — Enables YouTube sync for sermons
- `PAYSTACK_SECRET_KEY` — Enables live Paystack payment gateway

### Important: Date Serialization
Drizzle returns `Date` objects from PostgreSQL. All API routes must convert date fields to ISO strings before Zod validation (`.toISOString()`). See `sermons.ts`, `events.ts`, `testimonies.ts`, `members.ts`.
