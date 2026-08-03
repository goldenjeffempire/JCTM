---
name: Render health-check crash root causes and permanent fixes
description: All five root causes of Render health-check failures and restart loops, plus the permanent fixes applied.
---

# Render Health-Check Crash: Root Causes & Fixes

**Why:** Server was crashing with `uncaughtException: RangeError: Invalid string length` from yt-dlp stderr accumulation, causing Render restart loops. Health check also made live DB queries causing timeout failures.

## Root Cause 1 (CRITICAL) — yt-dlp stderr crash
- `stderr += line + "\n"` in `media-processor.ts` audio and video sections had NO size limit
- Long YouTube downloads produce megabytes of stderr → V8 max string length hit → `RangeError`
- Raw Socket event handler has no Express error boundary → `uncaughtException` → server killed → Render restart loop
- **Fix**: Cap `stderr` at 128KB and `stderrBuf` at 1MB using `if (string.length < MAX)` guard
- Also cap `fetchYtMeta` stdout at 512KB

**How to apply:** Whenever adding `+=` string accumulation from external process stdout/stderr, always add a size cap constant and guard.

## Root Cause 2 (HIGH) — Health check made live DB queries
- `checkDatabase()` called `pool.connect()` + `SELECT 1` on every health probe
- `getSermonLibraryStats()` called `SELECT COUNT(*)` on sermon_data
- `getSubscriberCount()` called `SELECT COUNT(*)` on push_subscriptions
- During heavy background work all 10 pool slots busy → `pool.connect()` waits 10s → Render probe timeout
- **Fix**: Background probe every 30s with 2s timeout per query; handler reads from cache (<1ms)

## Root Cause 3 (HIGH) — No query timeout on health probe
- `connectionTimeoutMillis: 10_000` but Render timeout is shorter
- **Fix**: `withTimeout()` wrapper on all probe queries (2s hard limit)

## Root Cause 4 (MEDIUM) — Health endpoints behind all middleware
- `/api/ping` went through 9 middleware layers including rate limiter
- **Fix**: Mount `/api/ping` BEFORE `pinoHttp` in app.ts using `HEALTH_PATHS` set
- Also excluded health paths from compression and rate limiter

## Root Cause 5 (MEDIUM) — No readiness gate
- Server returned 200 before migrations complete, then could return 503
- **Fix**: `setReadyState(true)` called after `runMigrations()` in index.ts; handler returns `status: "starting"` until then

## Key Design Decisions
- Health handler always returns HTTP 200 (never 503) — prevents restart loops. DB outages don't benefit from restarts.
- Background probe fires immediately on `initHealthCache()` then every 30s, unref'd
- `stopHealthCache()` called first in graceful shutdown
- `HEALTH_PATHS = Set(["/api/ping", "/api/healthz", "/api/health"])` defined in app.ts, shared across compression filter, rate limiter skip, and pinoHttp `customLogLevel`

## Files Changed
- `artifacts/api-server/src/lib/media-processor.ts` — stderr/stdout caps (4 locations)
- `artifacts/api-server/src/routes/health.ts` — complete rewrite with background cache
- `artifacts/api-server/src/app.ts` — pre-middleware ping, HEALTH_PATHS exclusions
- `artifacts/api-server/src/index.ts` — health cache lifecycle + readiness gate
