import { Router, type IRouter, type Request, type Response } from "express";
import { db, eventPromotionsTable } from "@workspace/db";
import { and, eq, gte, sql } from "drizzle-orm";
import { requireAdminRole } from "../lib/adminAuth.js";

// ──────────────────────────────────────────────────────────────────────────────
// Lightweight validation (avoids adding zod as a direct dep of api-server)
// ──────────────────────────────────────────────────────────────────────────────
interface PromotionInput {
  slug: string;
  title: string;
  subtitle?: string | null;
  artworkUrl?: string | null;
  location?: string | null;
  ctaText?: string;
  ctaUrl?: string;
  startAt: string;
  endAt: string;
  status?: "draft" | "active" | "archived";
  showBanner?: boolean;
  showPopup?: boolean;
  showStickyBar?: boolean;
  // ── Generic recurring broadcast (campaign promotion mode) ───────────────────
  broadcastEnabled?: boolean;
  broadcastCadence?: "half_hourly" | "hourly" | "daily" | "custom";
  broadcastIntervalMinutes?: number | null;
  broadcastMessages?: string[];
  broadcastTitleOverride?: string | null;
  broadcastImageUrl?: string | null;
}

const STATUSES = new Set(["draft", "active", "archived"]);
const CADENCES = new Set(["half_hourly", "hourly", "daily", "custom"]);

function isIsoDateString(v: unknown): v is string {
  if (typeof v !== "string") return false;
  const t = Date.parse(v);
  return Number.isFinite(t);
}

function validatePromotion(body: unknown, partial = false): { ok: true; data: Partial<PromotionInput> } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Body must be an object" };
  const b = body as Record<string, unknown>;
  const out: Partial<PromotionInput> = {};

  const requireStr = (k: keyof PromotionInput, max: number) => {
    const v = b[k];
    if (v === undefined || v === null || v === "") {
      if (partial) return null;
      return `Missing field: ${String(k)}`;
    }
    if (typeof v !== "string" || v.length > max) return `Invalid field: ${String(k)}`;
    (out as Record<string, unknown>)[k] = v;
    return null;
  };
  const optStr = (k: keyof PromotionInput, max: number) => {
    const v = b[k];
    if (v === undefined) return null;
    if (v === null) { (out as Record<string, unknown>)[k] = null; return null; }
    if (typeof v !== "string" || v.length > max) return `Invalid field: ${String(k)}`;
    (out as Record<string, unknown>)[k] = v;
    return null;
  };
  const optBool = (k: keyof PromotionInput) => {
    const v = b[k];
    if (v === undefined) return null;
    if (typeof v !== "boolean") return `Invalid field: ${String(k)}`;
    (out as Record<string, unknown>)[k] = v;
    return null;
  };

  for (const err of [
    requireStr("slug", 120),
    requireStr("title", 200),
    optStr("subtitle", 500),
    optStr("artworkUrl", 2000),
    optStr("location", 500),
    optStr("ctaText", 80),
    optStr("ctaUrl", 500),
    optBool("showBanner"),
    optBool("showPopup"),
    optBool("showStickyBar"),
    optBool("broadcastEnabled"),
    optStr("broadcastTitleOverride", 200),
    optStr("broadcastImageUrl", 2000),
  ]) {
    if (err) return { ok: false, error: err };
  }

  // ── Broadcast cadence & interval ───────────────────────────────────────────
  if (b.broadcastCadence !== undefined) {
    if (typeof b.broadcastCadence !== "string" || !CADENCES.has(b.broadcastCadence)) {
      return { ok: false, error: "Invalid broadcastCadence — must be half_hourly|hourly|daily|custom" };
    }
    out.broadcastCadence = b.broadcastCadence as PromotionInput["broadcastCadence"];
  }
  if (b.broadcastIntervalMinutes !== undefined && b.broadcastIntervalMinutes !== null) {
    const n = Number(b.broadcastIntervalMinutes);
    if (!Number.isFinite(n) || n < 5 || n > 1440) {
      return { ok: false, error: "broadcastIntervalMinutes must be between 5 and 1440" };
    }
    out.broadcastIntervalMinutes = Math.round(n);
  } else if (b.broadcastIntervalMinutes === null) {
    out.broadcastIntervalMinutes = null;
  }
  // Cross-field rule: cadence='custom' requires broadcastIntervalMinutes (when
  // either is being set — full validation happens at insert time).
  if (out.broadcastCadence === "custom" && out.broadcastIntervalMinutes === undefined) {
    // tolerated on partial updates; the row's existing value stays in place
  }

  // ── Broadcast messages: array of non-empty strings, max 24 entries ─────────
  if (b.broadcastMessages !== undefined) {
    if (b.broadcastMessages === null) {
      out.broadcastMessages = [];
    } else if (!Array.isArray(b.broadcastMessages)) {
      return { ok: false, error: "broadcastMessages must be an array of strings" };
    } else {
      const arr = b.broadcastMessages as unknown[];
      if (arr.length > 24) return { ok: false, error: "broadcastMessages may contain at most 24 entries" };
      const cleaned: string[] = [];
      for (const item of arr) {
        if (typeof item !== "string") {
          return { ok: false, error: "broadcastMessages entries must be strings" };
        }
        const trimmed = item.trim();
        if (trimmed.length === 0) continue;
        if (trimmed.length > 240) {
          return { ok: false, error: "Each broadcastMessages entry must be 240 characters or fewer" };
        }
        cleaned.push(trimmed);
      }
      out.broadcastMessages = cleaned;
    }
  }

  if (b.startAt !== undefined) {
    if (!isIsoDateString(b.startAt)) return { ok: false, error: "Invalid startAt — must be ISO 8601" };
    out.startAt = b.startAt;
  } else if (!partial) return { ok: false, error: "Missing field: startAt" };

  if (b.endAt !== undefined) {
    if (!isIsoDateString(b.endAt)) return { ok: false, error: "Invalid endAt — must be ISO 8601" };
    out.endAt = b.endAt;
  } else if (!partial) return { ok: false, error: "Missing field: endAt" };

  if (b.status !== undefined) {
    if (typeof b.status !== "string" || !STATUSES.has(b.status)) {
      return { ok: false, error: "Invalid status — must be draft|active|archived" };
    }
    out.status = b.status as PromotionInput["status"];
  }

  return { ok: true, data: out };
}

const router: IRouter = Router();

// ──────────────────────────────────────────────────────────────────────────────
// Phase computation helpers
// ──────────────────────────────────────────────────────────────────────────────
type Phase = "upcoming" | "live" | "ended";

function computePhase(startAt: Date, endAt: Date, now = new Date()): Phase {
  const t = now.getTime();
  if (t < startAt.getTime()) return "upcoming";
  if (t < endAt.getTime()) return "live";
  return "ended";
}

function serialize(row: typeof eventPromotionsTable.$inferSelect) {
  const phase = computePhase(row.startAt, row.endAt);
  const now = Date.now();
  const msUntilStart = row.startAt.getTime() - now;
  const msUntilEnd = row.endAt.getTime() - now;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    artworkUrl: row.artworkUrl,
    location: row.location,
    ctaText: row.ctaText,
    ctaUrl: row.ctaUrl,
    startAt: row.startAt.toISOString(),
    endAt: row.endAt.toISOString(),
    status: row.status,
    showBanner: row.showBanner,
    showPopup: row.showPopup,
    showStickyBar: row.showStickyBar,
    broadcastEnabled: row.broadcastEnabled,
    broadcastCadence: row.broadcastCadence,
    broadcastIntervalMinutes: row.broadcastIntervalMinutes,
    broadcastMessages: Array.isArray(row.broadcastMessages) ? row.broadcastMessages : [],
    broadcastTitleOverride: row.broadcastTitleOverride,
    broadcastImageUrl: row.broadcastImageUrl,
    phase,
    msUntilStart,
    msUntilEnd,
    serverTime: new Date().toISOString(),
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/event-promotions/active
// Returns the single most-relevant active promotion, with computed phase.
//   • Promotions whose end_at is in the future and whose start_at is within the
//     next 30 days are considered "in scope" for surfacing.
//   • Tie-break: closest to start (earliest start_at first).
//   • Just-ended promotions (within 2 h of end_at) are also returned so the UI
//     can show a brief "Just Ended" / replay-CTA state.
// ──────────────────────────────────────────────────────────────────────────────
router.get("/event-promotions/active", async (_req, res): Promise<void> => {
  const POST_END_GRACE_MS = 2 * 60 * 60 * 1000; // 2h
  const PRE_START_HORIZON_MS = 30 * 24 * 60 * 60 * 1000; // 30d
  const now = new Date();
  const horizon = new Date(now.getTime() + PRE_START_HORIZON_MS);
  const grace = new Date(now.getTime() - POST_END_GRACE_MS);

  const rows = await db
    .select()
    .from(eventPromotionsTable)
    .where(
      and(
        eq(eventPromotionsTable.status, "active"),
        gte(eventPromotionsTable.endAt, grace),
        sql`${eventPromotionsTable.startAt} <= ${horizon}`,
      ),
    )
    .orderBy(sql`${eventPromotionsTable.startAt} ASC`)
    .limit(1);

  // Short cache + SWR so CDNs/proxies serve fast without holding the state stale.
  res.setHeader("Cache-Control", "public, s-maxage=15, stale-while-revalidate=30");

  if (rows.length === 0) {
    res.json({ promotion: null, serverTime: new Date().toISOString() });
    return;
  }
  res.json({ promotion: serialize(rows[0]), serverTime: new Date().toISOString() });
});

// ──────────────────────────────────────────────────────────────────────────────
// Admin endpoints (protected by livestream admin role — same role that controls
// "live" lifecycle). Allow listing, creating, updating, deleting promotions.
// ──────────────────────────────────────────────────────────────────────────────

router.get(
  "/admin/event-promotions",
  requireAdminRole("livestream"),
  async (_req: Request, res: Response): Promise<void> => {
    const rows = await db
      .select()
      .from(eventPromotionsTable)
      .orderBy(sql`${eventPromotionsTable.startAt} DESC`);
    res.json(rows.map((r) => ({
      ...serialize(r),
      pushSentAt: r.pushSentAt?.toISOString() ?? null,
      endPushSentAt: r.endPushSentAt?.toISOString() ?? null,
    })));
  },
);

router.post(
  "/admin/event-promotions",
  requireAdminRole("livestream"),
  async (req: Request, res: Response): Promise<void> => {
    const parsed = validatePromotion(req.body, false);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const data = parsed.data;
    if (new Date(data.endAt as string).getTime() <= new Date(data.startAt as string).getTime()) {
      res.status(400).json({ error: "endAt must be after startAt" });
      return;
    }
    // Cross-field rule on create: cadence='custom' requires an interval.
    if (data.broadcastCadence === "custom" && (data.broadcastIntervalMinutes == null)) {
      res.status(400).json({ error: "broadcastIntervalMinutes is required when broadcastCadence is 'custom'" });
      return;
    }
    try {
      const [row] = await db
        .insert(eventPromotionsTable)
        .values({
          slug: data.slug as string,
          title: data.title as string,
          subtitle: data.subtitle ?? null,
          artworkUrl: data.artworkUrl ?? null,
          location: data.location ?? null,
          ctaText: data.ctaText ?? "Join Us",
          ctaUrl: data.ctaUrl ?? "/",
          startAt: new Date(data.startAt as string),
          endAt: new Date(data.endAt as string),
          status: data.status ?? "active",
          showBanner: data.showBanner ?? true,
          showPopup: data.showPopup ?? true,
          showStickyBar: data.showStickyBar ?? true,
          broadcastEnabled: data.broadcastEnabled ?? false,
          broadcastCadence: data.broadcastCadence ?? "half_hourly",
          broadcastIntervalMinutes: data.broadcastIntervalMinutes ?? null,
          broadcastMessages: data.broadcastMessages ?? [],
          broadcastTitleOverride: data.broadcastTitleOverride ?? null,
          broadcastImageUrl: data.broadcastImageUrl ?? null,
        })
        .returning();
      res.status(201).json(serialize(row));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: "Failed to create promotion", details: message });
    }
  },
);

router.put(
  "/admin/event-promotions/:id",
  requireAdminRole("livestream"),
  async (req: Request, res: Response): Promise<void> => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const parsed = validatePromotion(req.body, true);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const data = parsed.data;
    const update: Record<string, unknown> = { updatedAt: new Date() };
    for (const k of Object.keys(data) as (keyof typeof data)[]) {
      const v = data[k];
      if (v === undefined) continue;
      if (k === "startAt" || k === "endAt") {
        update[k] = new Date(v as string);
      } else {
        update[k] = v;
      }
    }
    // If start_at moved into the future again, allow re-firing the "live" push.
    if (data.startAt && new Date(data.startAt).getTime() > Date.now()) {
      update.pushSentAt = null;
    }
    try {
      const [row] = await db
        .update(eventPromotionsTable)
        .set(update)
        .where(eq(eventPromotionsTable.id, id))
        .returning();
      if (!row) {
        res.status(404).json({ error: "Promotion not found" });
        return;
      }
      res.json(serialize(row));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: "Failed to update promotion", details: message });
    }
  },
);

router.delete(
  "/admin/event-promotions/:id",
  requireAdminRole("livestream"),
  async (req: Request, res: Response): Promise<void> => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const result = await db
      .delete(eventPromotionsTable)
      .where(eq(eventPromotionsTable.id, id))
      .returning();
    if (result.length === 0) {
      res.status(404).json({ error: "Promotion not found" });
      return;
    }
    res.json({ success: true });
  },
);

export default router;
