import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

function normalizeDbUrl(url: string): string {
  const isLocal =
    url.includes("localhost") ||
    url.includes("127.0.0.1") ||
    url.includes("helium");

  if (isLocal) {
    return url.replace(/[?&]sslmode=[^&]*/g, "");
  }

  return url.replace(
    /([?&])sslmode=(prefer|require|verify-ca)(&|$)/g,
    (_m, prefix, _mode, suffix) => `${prefix}sslmode=verify-full${suffix}`,
  );
}

const normalizedUrl = normalizeDbUrl(process.env.DATABASE_URL!);

const isLocal =
  normalizedUrl.includes("localhost") ||
  normalizedUrl.includes("127.0.0.1") ||
  normalizedUrl.includes("helium");

// ─── Production-grade pool configuration ─────────────────────────────────────
//
// Root cause of "write ECONNABORTED":
//   Neon (and most managed Postgres services) close idle TCP connections after
//   300–600 s of inactivity. Without keepalives, the OS also silently drops
//   long-idle connections at load-balancer / firewall level. When `pg` tries to
//   reuse a connection that was closed on the server side, the OS write() call
//   on the dead socket returns ECONNABORTED / ECONNRESET.
//
// Fixes applied here:
//   keepAlive: true                    — enables TCP keepalive probes at the
//                                        OS level; the OS sends ACK probes on
//                                        idle connections and removes dead ones
//                                        from the pool before they're reused.
//   keepAliveInitialDelayMillis: 10000 — start probes 10 s after the connection
//                                        goes idle (well before Neon's 300 s
//                                        server-side cutoff).
//   idleTimeoutMillis: 30000           — pg evicts connections that have been
//                                        idle for 30 s, releasing them cleanly
//                                        before the server kills them. This
//                                        means the pool NEVER holds connections
//                                        long enough for Neon to close them
//                                        behind our back.
//   connectionTimeoutMillis: 10000     — fail fast if the pool is exhausted;
//                                        without this, callers block forever.
//   max: 10                            — cap concurrent connections. Neon free
//                                        tier allows 100 concurrent, but
//                                        uncapped pools under load create far
//                                        more connections than needed, racing
//                                        to exhaustion and causing ECONNABORTED
//                                        as servers start refusing new sockets.
//   pool.on('error', ...)              — CRITICAL: when an idle client is
//                                        removed because its TCP connection
//                                        died, pg emits 'error' on the Pool.
//                                        Without a listener, Node.js treats
//                                        this as an uncaught exception and
//                                        terminates the process. This handler
//                                        logs the event and lets pg remove the
//                                        dead client cleanly — the next query
//                                        will automatically get a fresh one.

export const pool = new Pool({
  connectionString: normalizedUrl,
  ssl: isLocal ? false : { rejectUnauthorized: true },

  // Connection lifecycle — keep connections healthy and evict stale ones
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,

  // TCP keepalive — prevents "write ECONNABORTED" on connections idle for >30s
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,
});

// ─── Pool-level error boundary ────────────────────────────────────────────────
// Without this listener, any error emitted by an idle client (e.g. ECONNABORTED
// when Neon closes the TCP connection) propagates to Node.js as an uncaught
// exception and crashes the process.  pg automatically removes the errored
// client from the pool and creates a fresh one on the next query — we just need
// to ensure the error is consumed so the process keeps running.
pool.on("error", (err: Error & { code?: string }) => {
  // Log transient connection errors at warn level — they are expected when the
  // server closes idle connections and are self-healing.
  const transient = ["ECONNABORTED", "ECONNRESET", "ETIMEDOUT", "57P01", "08006", "08001", "08004"];
  const isTransient = transient.some(
    (c) => err.code === c || err.message?.includes(c),
  );
  if (isTransient) {
    // Use stderr directly — logger may not be initialised yet at pool creation time
    process.stderr.write(
      `[db] Transient pool client error (self-healing): ${err.code ?? ""} ${err.message}\n`,
    );
  } else {
    process.stderr.write(
      `[db] Pool client error: ${err.code ?? ""} ${err.message}\n${err.stack ?? ""}\n`,
    );
  }
  // Do NOT rethrow — pg removes the dead client automatically; the pool
  // creates a fresh connection on the next query.
});

export const db = drizzle(pool, { schema });

export * from "./schema";
