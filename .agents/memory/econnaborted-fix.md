---
name: ECONNABORTED permanent fix
description: Root causes and permanent fixes for the "write ECONNABORTED" PostgreSQL crash that killed the Node.js process.
---

# ECONNABORTED Permanent Fix

## Root causes (all fixed)

1. **Pool emitting uncaught error events** — `pg.Pool` emits `'error'` on idle clients when their TCP connection dies (ECONNABORTED, ECONNRESET). Without a listener, Node.js treats this as an uncaught exception → process crash. Fixed by adding `pool.on('error', ...)` in `lib/db/src/index.ts` immediately at pool creation.

2. **No TCP keepalive** — Neon (and most managed Postgres) kills idle TCP connections after 300-600 s. Without OS-level keepalive probes, `pg` tries to reuse the dead socket and gets ECONNABORTED. Fixed via `keepAlive: true, keepAliveInitialDelayMillis: 10_000`.

3. **No `idleTimeoutMillis`** — Without this, the pool holds connections indefinitely. Neon closes them server-side, causing ECONNABORTED on next use. Fixed via `idleTimeoutMillis: 30_000` (pool evicts before Neon kills).

4. **No connection limits or timeout** — Uncapped pool + no `connectionTimeoutMillis` causes exhaustion under load and hangs. Fixed via `max: 10, connectionTimeoutMillis: 10_000`.

5. **neon-quota-monitor pool listener only handled quota errors** — Non-quota transient errors slipped through. Fixed: the catch-all listener in `lib/db/src/index.ts` is now always present; the quota monitor's listener handles only quota state transitions.

6. **Startup thundering herd** — 10+ DB-heavy startup tasks fired simultaneously on a cold Neon compute → overwhelmed pool → ECONNABORTED on some connections. Fixed by staggering tasks 1-10 s apart in `artifacts/api-server/src/index.ts`.

**Why:** `pool.on('error')` must be added at the point of pool creation (before any listeners are attached elsewhere). This makes the error handling unconditional.

**How to apply:** Any new background task that uses `pool.query()` or `db.*` should wrap calls in `withDbRetry()` from `artifacts/api-server/src/lib/db-retry.ts` for automatic exponential-backoff retry on transient errors.

## Files changed
- `lib/db/src/index.ts` — pool config + catch-all error listener
- `artifacts/api-server/src/lib/db-retry.ts` — new retry utility
- `artifacts/api-server/src/lib/neon-quota-monitor.ts` — comment clarifying listener purpose
- `artifacts/api-server/src/lib/uptime-monitor.ts` — heartbeat uses withDbRetry
- `artifacts/api-server/src/index.ts` — startNeonQuotaMonitor moved earlier; staggered startup tasks
