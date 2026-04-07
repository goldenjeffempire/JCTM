# JCTM Platform — Frontend

React + Vite frontend for the JCTM Digital Sanctuary. Served on the `PORT` environment variable (default proxied through Replit at `/`).

## Stack

- **Framework:** React 19 + Vite 7
- **Styling:** Tailwind CSS 4 + custom `index.css` animations
- **Animation:** Framer Motion 12
- **Routing:** Wouter
- **Data fetching:** TanStack Query v5 + auto-generated hooks from `@workspace/api-client-react`
- **UI components:** shadcn/ui (Radix + Tailwind)
- **Date handling:** date-fns
- **Toasts:** Sonner

## Running

```bash
pnpm run dev   # starts Vite dev server on $PORT
pnpm run build # production build to dist/
```

In the Replit environment use the **Start application** workflow.

## Pages

| Route | Component | Description |
|---|---|---|
| `/` | `Home.tsx` | 17-section homepage |
| `/sermons` | `Sermons.tsx` | Full sermon archive with search |
| `/sermons/:id` | `SermonDetail.tsx` | Single sermon with YouTube player |
| `/testimonies` | `Testimonies.tsx` | Testimony vault (Grid / Reel view) |
| `/events` | `Events.tsx` | Ministry events with countdown timers |
| `/give` | `Give.tsx` | Giving portal (NGN/USD, Paystack/Stripe) |
| `/join` | `Join.tsx` | Member registration / login |
| `/members` | `Members.tsx` | Searchable member directory |
| `/about` | `About.tsx` | Prophet bio, doctrines, temple history |
| `/correction-timeline` | `Timeline.tsx` | 5 corrections scroll-driven timeline |
| `/privacy` | `Privacy.tsx` | Privacy policy (GDPR + NDPR) |
| `/terms` | `Terms.tsx` | Terms of service |
| `*` | `not-found.tsx` | Custom 404 page |

All pages are lazy-loaded via `React.lazy()` + `<Suspense>` for fast initial bundle.

## Components

### Global Components
| File | Description |
|---|---|
| `GlobalAltar.tsx` | Live worshipper counter via SSE. Animated spring number, pulsing rings, flag avatars, trend arrows. Connects to `/api/altar/stream`. |
| `MandateMap.tsx` | Interactive SVG world map. 11 glow points (Warri HQ + global hubs). Hover tooltips, travelling light pulses, animated connection lines. |
| `TempleBots.tsx` | AI chat widget. Contextual greetings per page, smart scroll notifications, predictive hover whispers, quick-link theological bubbles, Reach Us links. |
| `LiveBanner.tsx` | Sticky banner shown when a livestream is active. |
| `ErrorBoundary.tsx` | React error boundary with Romans 8:28 themed UI. |

### Layout
| File | Description |
|---|---|
| `layout/Layout.tsx` | Page wrapper — Header + main + Footer |
| `layout/Header.tsx` | Navbar with scroll-aware background, mobile drawer |
| `layout/Footer.tsx` | Ministry info, quick links, social channels |

### UI Primitives (shadcn/ui)
Located in `components/ui/`. Includes: Button, Badge, Input, Textarea, Skeleton, Dialog, Sheet, and more.

### Home.tsx Section Map

The homepage is built as 17 self-contained section components in a single file:

| Section | Description |
|---|---|
| `HeroSection` | Parallax, typewriter subtitle, floating metric pills, magnetic CTAs |
| `PlatformBar` | Social proof strip (Temple TV, Facebook, nations count) |
| `BentoGrid` | Asymmetric 5-card bento: featured sermon, live countdown, testimony of day |
| `TestimoniesMarquee` | Two infinite-scroll marquee rows of testimony cards |
| `ProphetSection` | Bio card with spinning gradient ring avatar, credential badges |
| `MandateReveal` | Scroll-linked parallax text reveal on dark background |
| `SermonSpotlight` | Featured sermon with inline YouTube player + tilt-card pillars |
| `RecentSermonsCarousel` | Horizontal scroll-snap carousel of latest sermons |
| `MinistryPillars` | 6-card accordion grid of ministry doctrine pillars |
| `ScriptureFeature` | Full-width Jeremiah 6:16 typographic display |
| `EventsSection` | Upcoming events with date badges and skeleton loaders |
| `GlobalReach` | Impact counters + **Interactive Mandate Map** |
| `GlobalAltarSection` | **Live Global Altar** worshipper counter |
| `GivingBand` | Tithe / Offerings / Missions cards with giving CTA |
| `NewcomerSection` | 3-step onboarding: Beliefs, Branch, Unit |
| `ConnectSection` | Social channels + headquarters location card |
| `TimelineTeaser` | Dark parallax CTA to the Correction Timeline |

## Custom Event Architecture

Components communicate via browser custom events — no shared state required:

```typescript
// Dispatching
window.dispatchEvent(new CustomEvent("jctm:section-enter", { detail: "giving" }));
window.dispatchEvent(new CustomEvent("jctm:hover-enter",  { detail: "altar" }));
window.dispatchEvent(new CustomEvent("jctm:hover-leave"));

// Listening (in TempleBots)
window.addEventListener("jctm:section-enter", handler);
window.addEventListener("jctm:hover-enter",   handler);
window.addEventListener("jctm:hover-leave",   handler);
```

| Event | Payload | Fired By | Effect |
|---|---|---|---|
| `jctm:section-enter` | section name | GivingBand, NewcomerSection, GlobalAltarSection | TempleBots shows a scroll notification toast |
| `jctm:hover-enter` | section name | GivingBand, GlobalAltarSection | TempleBots shows a whisper tooltip after 800 ms |
| `jctm:hover-leave` | — | Same sections | TempleBots cancels the pending whisper timer |

## Design System

### Colour Tokens (CSS variables)
```css
--primary: Temple Blue #003366
--accent:  Sky Blue   #38BDF8
--background: Warm Ivory #FFFEF8
```

### Key CSS Utilities
```css
.glass-panel       /* Light frosted-glass card */
.glass-dark        /* Dark frosted-glass card */
.altar-glow        /* Pulsing cyan glow for altar elements */
.animate-marquee   /* Infinite leftward scroll */
.scrollbar-hide    /* Hides scrollbar (reel containers) */
.bento-card-hover  /* Lift + scale on hover */
.reel-card-enter   /* Spring entrance animation */
.glow-dot          /* Pulsing dot for mandate map */
```

### Reusable Utility Components
| Component | Description |
|---|---|
| `MagneticButton` | Cursor-pull spring effect wrapper |
| `TiltCard` | 3D perspective tilt on mouse move using `useMotionValue` |
| `AnimatedCounter` | Scroll-triggered number odometer |
| `RippleButton` | Expanding ripple on click |
| `useTypewriter` | Hook — animates a string character by character |

## API Integration

Data fetching uses auto-generated TanStack Query hooks from `@workspace/api-client-react`.

```typescript
import { useListSermons, getListSermonsQueryKey } from "@workspace/api-client-react";

const { data, isLoading } = useListSermons(
  { limit: 20, offset: 0 },
  { query: { queryKey: getListSermonsQueryKey() } }
);
```

The Vite dev server proxies `/api/*` to `http://localhost:8080` (configured in `vite.config.ts`).

## Environment Variables

| Variable | Description |
|---|---|
| `PORT` | Dev server port (set by Replit workflow) |
| `BASE_PATH` | Base URL prefix (set to `/` by Replit workflow) |
| `VITE_API_BASE_URL` | API base URL (defaults to same origin via proxy) |
