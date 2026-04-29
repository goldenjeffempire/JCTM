/**
 * Video play-event ingestion.
 *
 * Receives batched analytics events from the canonical <YouTubeEmbed/>
 * component and persists per-video aggregate counters (impressions, plays,
 * quartile completions, completes) into the `video_event_counts` table.
 *
 * Events are sent via fetch keepalive or navigator.sendBeacon (no Content-Type
 * negotiation), so the route accepts text/plain bodies as well and parses
 * defensively.
 */

import { Router, type IRouter, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { requireAdminRole } from "../lib/adminAuth.js";

const router: IRouter = Router();

const KIND_COLUMN: Record<string, string> = {
  impression: "impressions",
  play:       "plays",
  pause:      "pauses",
  q25:        "q25",
  q50:        "q50",
  q75:        "q75",
  complete:   "completes",
};

const ingestLimiter = rateLimit({
  windowMs: 60_000,
  max: 240,            // 240 batches/min/IP — generous; one user usually < 10
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

interface IncomingEvent {
  videoId?: unknown;
  kind?: unknown;
  page?: unknown;
}

function parseBody(req: Request): IncomingEvent[] {
  let body = req.body as unknown;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { return []; }
  }
  if (!body || typeof body !== "object") return [];
  const events = (body as { events?: unknown }).events;
  if (!Array.isArray(events)) return [];
  return events as IncomingEvent[];
}

function sanitiseId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  // YouTube IDs are 11 chars [-_A-Za-z0-9]; allow up to 32 to be tolerant of
  // playlist IDs used in some embeds.
  if (!/^[-_A-Za-z0-9]{6,32}$/.test(value)) return null;
  return value;
}

function sanitisePage(value: unknown): string {
  if (typeof value !== "string") return "/";
  const trimmed = value.slice(0, 200);
  return trimmed.startsWith("/") ? trimmed : "/";
}

router.post("/video-events", ingestLimiter, async (req: Request, res: Response): Promise<void> => {
  const events = parseBody(req);
  if (events.length === 0) {
    res.status(202).json({ ok: true, accepted: 0 });
    return;
  }

  // Aggregate the batch in memory first → one INSERT per (videoId,page) pair.
  type Bucket = Record<string, number> & { videoId: string; page: string };
  const buckets = new Map<string, Bucket>();

  for (const ev of events.slice(0, 200)) {
    const videoId = sanitiseId(ev.videoId);
    const kind = typeof ev.kind === "string" ? ev.kind : "";
    const column = KIND_COLUMN[kind];
    if (!videoId || !column) continue;
    const page = sanitisePage(ev.page);
    const key = `${videoId}::${page}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { videoId, page, impressions: 0, plays: 0, pauses: 0, q25: 0, q50: 0, q75: 0, completes: 0 } as Bucket;
      buckets.set(key, bucket);
    }
    bucket[column] = (bucket[column] ?? 0) + 1;
  }

  if (buckets.size === 0) {
    res.status(202).json({ ok: true, accepted: 0 });
    return;
  }

  // 'YYYY-MM' in UTC — stable across server timezones.
  const now = new Date();
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  let stored = 0;
  for (const b of buckets.values()) {
    try {
      await db.execute(sql`
        INSERT INTO video_event_counts (
          video_id, page, impressions, plays, pauses, q25, q50, q75, completes, updated_at
        )
        VALUES (
          ${b.videoId}, ${b.page},
          ${b.impressions}, ${b.plays}, ${b.pauses},
          ${b.q25}, ${b.q50}, ${b.q75},
          ${b.completes},
          NOW()
        )
        ON CONFLICT (video_id, page) DO UPDATE SET
          impressions = video_event_counts.impressions + EXCLUDED.impressions,
          plays       = video_event_counts.plays       + EXCLUDED.plays,
          pauses      = video_event_counts.pauses      + EXCLUDED.pauses,
          q25         = video_event_counts.q25         + EXCLUDED.q25,
          q50         = video_event_counts.q50         + EXCLUDED.q50,
          q75         = video_event_counts.q75         + EXCLUDED.q75,
          completes   = video_event_counts.completes   + EXCLUDED.completes,
          updated_at  = NOW();
      `);
      // Mirror into the monthly bucket so /export.csv?month=YYYY-MM works.
      await db.execute(sql`
        INSERT INTO video_event_counts_monthly (
          month, video_id, page, impressions, plays, pauses, q25, q50, q75, completes, updated_at
        )
        VALUES (
          ${month}, ${b.videoId}, ${b.page},
          ${b.impressions}, ${b.plays}, ${b.pauses},
          ${b.q25}, ${b.q50}, ${b.q75},
          ${b.completes},
          NOW()
        )
        ON CONFLICT (month, video_id, page) DO UPDATE SET
          impressions = video_event_counts_monthly.impressions + EXCLUDED.impressions,
          plays       = video_event_counts_monthly.plays       + EXCLUDED.plays,
          pauses      = video_event_counts_monthly.pauses      + EXCLUDED.pauses,
          q25         = video_event_counts_monthly.q25         + EXCLUDED.q25,
          q50         = video_event_counts_monthly.q50         + EXCLUDED.q50,
          q75         = video_event_counts_monthly.q75         + EXCLUDED.q75,
          completes   = video_event_counts_monthly.completes   + EXCLUDED.completes,
          updated_at  = NOW();
      `);
      stored++;
    } catch (err) {
      req.log.warn({ err, videoId: b.videoId }, "Failed to persist video event batch");
    }
  }

  res.status(202).json({ ok: true, accepted: stored });
});

// Admin-only — exposes per-video aggregate analytics for the dashboard.
router.get(
  "/video-events/top",
  requireAdminRole(["sermon", "livestream"]),
  async (req: Request, res: Response): Promise<void> => {
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "25"), 10) || 25, 1), 100);
    try {
      const rows = await db.execute(sql`
        SELECT
          v.video_id,
          SUM(v.impressions)::bigint AS impressions,
          SUM(v.plays)::bigint       AS plays,
          SUM(v.pauses)::bigint      AS pauses,
          SUM(v.q25)::bigint         AS q25,
          SUM(v.q50)::bigint         AS q50,
          SUM(v.q75)::bigint         AS q75,
          SUM(v.completes)::bigint   AS completes,
          MAX(v.updated_at)          AS last_seen,
          MAX(s.title)               AS title,
          MAX(s.thumbnail_url)       AS thumbnail_url,
          MAX(s.published_at)        AS published_at
        FROM video_event_counts v
        LEFT JOIN sermon_data s ON s.video_id = v.video_id
        GROUP BY v.video_id
        ORDER BY plays DESC NULLS LAST, impressions DESC NULLS LAST
        LIMIT ${limit};
      `);

      const totals = await db.execute(sql`
        SELECT
          SUM(impressions)::bigint AS impressions,
          SUM(plays)::bigint       AS plays,
          SUM(completes)::bigint   AS completes
        FROM video_event_counts;
      `);

      const pages = await db.execute(sql`
        SELECT
          page,
          SUM(impressions)::bigint AS impressions,
          SUM(plays)::bigint       AS plays
        FROM video_event_counts
        GROUP BY page
        ORDER BY plays DESC NULLS LAST
        LIMIT 10;
      `);

      const totalsRow = (totals.rows ?? totals)[0] as Record<string, unknown> | undefined;

      res.json({
        items: rows.rows ?? rows,
        totals: {
          impressions: Number(totalsRow?.impressions ?? 0),
          plays:       Number(totalsRow?.plays ?? 0),
          completes:   Number(totalsRow?.completes ?? 0),
        },
        pages: pages.rows ?? pages,
      });
    } catch (err) {
      req.log?.warn?.({ err }, "video-events/top query failed");
      res.json({ items: [], totals: { impressions: 0, plays: 0, completes: 0 }, pages: [] });
    }
  },
);

// Admin-only — list of months that actually have data, newest first.
router.get(
  "/video-events/months",
  requireAdminRole(["sermon", "livestream"]),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const rows = await db.execute(sql`
        SELECT month, SUM(plays)::bigint AS plays
        FROM video_event_counts_monthly
        GROUP BY month
        ORDER BY month DESC
        LIMIT 36;
      `);
      res.json({ months: rows.rows ?? rows });
    } catch {
      res.json({ months: [] });
    }
  },
);

// Admin-only — CSV export of per-video performance for a given month.
function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

router.get(
  "/video-events/export.csv",
  requireAdminRole(["sermon", "livestream"]),
  async (req: Request, res: Response): Promise<void> => {
    const monthRaw = String(req.query.month ?? "");
    const month = /^\d{4}-\d{2}$/.test(monthRaw)
      ? monthRaw
      : (() => {
          const d = new Date();
          return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
        })();

    try {
      const rows = await db.execute(sql`
        SELECT
          v.video_id,
          MAX(s.title)               AS title,
          STRING_AGG(DISTINCT v.page, ' | ' ORDER BY v.page) AS pages,
          SUM(v.impressions)::bigint AS impressions,
          SUM(v.plays)::bigint       AS plays,
          SUM(v.q25)::bigint         AS q25,
          SUM(v.q50)::bigint         AS q50,
          SUM(v.q75)::bigint         AS q75,
          SUM(v.completes)::bigint   AS completes,
          MAX(v.updated_at)          AS last_seen
        FROM video_event_counts_monthly v
        LEFT JOIN sermon_data s ON s.video_id = v.video_id
        WHERE v.month = ${month}
        GROUP BY v.video_id
        ORDER BY plays DESC NULLS LAST, impressions DESC NULLS LAST;
      `);

      const data = (rows.rows ?? rows) as Array<Record<string, unknown>>;

      const header = [
        "month", "video_id", "title", "pages",
        "impressions", "plays", "play_rate_pct",
        "q25", "q50", "q75",
        "completes", "completion_rate_pct",
        "youtube_url", "last_seen_utc",
      ];
      const lines: string[] = [header.join(",")];

      for (const r of data) {
        const impressions = Number(r.impressions ?? 0);
        const plays       = Number(r.plays       ?? 0);
        const completes   = Number(r.completes   ?? 0);
        const playRate    = impressions > 0 ? ((plays / impressions) * 100).toFixed(2) : "";
        const completeRate = plays > 0 ? ((completes / plays) * 100).toFixed(2) : "";
        const lastSeen = r.last_seen ? new Date(String(r.last_seen)).toISOString() : "";
        lines.push([
          month,
          csvEscape(r.video_id),
          csvEscape(r.title ?? ""),
          csvEscape(r.pages ?? ""),
          impressions,
          plays,
          playRate,
          Number(r.q25 ?? 0),
          Number(r.q50 ?? 0),
          Number(r.q75 ?? 0),
          completes,
          completeRate,
          `https://www.youtube.com/watch?v=${csvEscape(r.video_id)}`,
          lastSeen,
        ].join(","));
      }

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="jctm-video-analytics-${month}.csv"`);
      res.setHeader("Cache-Control", "no-store");
      res.send(lines.join("\n") + "\n");
    } catch (err) {
      req.log?.warn?.({ err, month }, "video-events/export.csv failed");
      res.status(500).type("text/plain").send("Failed to generate CSV export.");
    }
  },
);

export default router;
