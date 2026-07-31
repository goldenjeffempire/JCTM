import { pool } from "@workspace/db";
import type { Logger } from "pino";

export type NeonQuotaStatus = "healthy" | "quota-exceeded" | "unknown";

interface MonitorState {
  status: NeonQuotaStatus;
  since: string | null;
  lastCheckAt: string | null;
  lastErrorMessage: string | null;
  consecutiveQuotaErrors: number;
  totalQuotaErrors: number;
  totalChecks: number;
  lastRecoveryAt: string | null;
}

const state: MonitorState = {
  status: "unknown",
  since: null,
  lastCheckAt: null,
  lastErrorMessage: null,
  consecutiveQuotaErrors: 0,
  totalQuotaErrors: 0,
  totalChecks: 0,
  lastRecoveryAt: null,
};

const QUOTA_PATTERNS = [
  /exceeded the compute time quota/i,
  /compute time quota/i,
  /upgrade your plan to increase limits/i,
];

export function isQuotaError(err: unknown): boolean {
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "";
  if (!msg) return false;
  return QUOTA_PATTERNS.some((p) => p.test(msg));
}

let monitorLogger: Logger | null = null;

function transition(next: NeonQuotaStatus, errorMessage: string | null) {
  const prev = state.status;
  state.lastCheckAt = new Date().toISOString();
  state.totalChecks += 1;

  if (next === "quota-exceeded") {
    state.lastErrorMessage = errorMessage;
    state.consecutiveQuotaErrors += 1;
    state.totalQuotaErrors += 1;
    if (prev !== "quota-exceeded") {
      state.since = state.lastCheckAt;
      monitorLogger?.error(
        {
          alert: "neon-quota-exceeded",
          message: errorMessage,
          since: state.since,
        },
        "🚨 NEON QUOTA EXCEEDED — database is rejecting queries. Upgrade Neon plan or wait for quota reset.",
      );
    }
  } else if (next === "healthy") {
    state.lastErrorMessage = null;
    state.consecutiveQuotaErrors = 0;
    if (prev === "quota-exceeded") {
      state.lastRecoveryAt = state.lastCheckAt;
      const wasDownSince = state.since;
      state.since = state.lastCheckAt;
      monitorLogger?.info(
        {
          alert: "neon-quota-recovered",
          wasDownSince,
          recoveredAt: state.lastRecoveryAt,
        },
        "✅ Neon quota recovered — database is responding again.",
      );
    } else if (prev === "unknown") {
      state.since = state.lastCheckAt;
    }
  }

  state.status = next;
}

export function recordDbError(err: unknown): boolean {
  if (!isQuotaError(err)) return false;
  const msg = err instanceof Error ? err.message : String(err);
  transition("quota-exceeded", msg);
  return true;
}

export function recordDbSuccess(): void {
  if (state.status !== "healthy") {
    transition("healthy", null);
  } else {
    state.lastCheckAt = new Date().toISOString();
    state.totalChecks += 1;
  }
}

async function probeOnce(): Promise<void> {
  try {
    await pool.query("SELECT 1");
    recordDbSuccess();
  } catch (err) {
    if (isQuotaError(err)) {
      recordDbError(err);
    } else {
      // Non-quota DB error — note it but don't flip the quota state
      state.lastCheckAt = new Date().toISOString();
      state.totalChecks += 1;
      monitorLogger?.warn(
        { err },
        "Neon quota probe failed with non-quota error",
      );
    }
  }
}

let intervalHandle: NodeJS.Timeout | null = null;

export function startNeonQuotaMonitor(
  log: Logger,
  intervalMs = 60_000,
): void {
  if (intervalHandle) return;
  monitorLogger = log;

  // ── Pool-level error boundary ──────────────────────────────────────────────
  // pg emits 'error' on the Pool when an idle client encounters a connectivity
  // problem (ECONNABORTED, ECONNRESET, etc.).  The lib/db pool already has a
  // catch-all 'error' listener that logs and prevents crashes, but we add a
  // second listener here to additionally record quota-exceeded transitions so
  // the monitor state stays accurate.
  //
  // NOTE: EventEmitter listeners are additive — both fire.  We must NOT
  // re-throw here; pg removes the dead client automatically and the pool
  // recovers on the next query.
  pool.on("error", (err) => {
    if (isQuotaError(err)) {
      recordDbError(err);
    }
    // Non-quota transient errors (ECONNABORTED etc.) are already logged by the
    // pool's own catch-all handler in lib/db/src/index.ts — no action needed.
  });

  // Initial probe shortly after startup
  setTimeout(probeOnce, 2_000);

  intervalHandle = setInterval(probeOnce, intervalMs);
  if (intervalHandle.unref) intervalHandle.unref();

  log.info(
    { intervalMs },
    "Neon quota monitor started — pinging DB on a schedule",
  );
}

export function stopNeonQuotaMonitor(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

export function getNeonQuotaStatus(): MonitorState {
  return { ...state };
}
