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
      stored++;
    } catch (err) {
      req.log.warn({ err, videoId: b.videoId }, "Failed to persist video event batch");
    }
  }

  res.status(202).json({ ok: true, accepted: stored });
});

router.get("/video-events/top", async (_req: Request, res: Response): Promise<void> => {
  try {
    const rows = await db.execute(sql`
      SELECT video_id, SUM(impressions)::bigint AS impressions,
             SUM(plays)::bigint AS plays,
             SUM(completes)::bigint AS completes
      FROM video_event_counts
      GROUP BY video_id
      ORDER BY plays DESC
      LIMIT 25;
    `);
    res.json({ items: rows.rows ?? rows });
  } catch (err) {
    (_req as Request).log?.warn?.({ err }, "video-events/top query failed");
    res.json({ items: [] });
  }
});

export default router;
