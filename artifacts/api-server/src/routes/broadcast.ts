/**
 * Broadcast Admin API
 *
 * Endpoints for administering the automated broadcast system:
 *  - View current broadcast automation status
 *  - Manually trigger AI rebroadcast curation
 *  - Override rebroadcast content
 *  - Fetch system health & statistics
 *  - Get upcoming Sunday service schedule
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { buildSmartRebroadcastQueue, getBroadcastStats } from "../lib/broadcast-engine.js";
import { db, sermonsTable } from "@workspace/db";
import { desc, sql } from "drizzle-orm";
import { pool } from "@workspace/db";

const router: IRouter = Router();

// ─── GET /api/broadcast/status ────────────────────────────────────────────────
// Current automation system status

router.get("/broadcast/status", async (_req: Request, res: Response): Promise<void> => {
  try {
    const stats = await getBroadcastStats();
    const now = new Date();

    // Next Sunday 8:00 AM WAT calculation
    const watNow = new Date(now.getTime() + 60 * 60 * 1000); // WAT = UTC+1
    const dayOfWeek = watNow.getUTCDay(); // 0 = Sunday
    const daysUntilSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek;
    const nextSunday = new Date(watNow);
    nextSunday.setUTCDate(nextSunday.getUTCDate() + daysUntilSunday);
    nextSunday.setUTCHours(7, 0, 0, 0); // 8:00 WAT = 07:00 UTC
    const nextSundayWAT = new Date(nextSunday.getTime() - 60 * 60 * 1000); // convert back to UTC

    const isSundayServiceWindow = (() => {
      const watMs = now.getTime() + 60 * 60 * 1000;
      const wat = new Date(watMs);
      const d = wat.getUTCDay();
      const mins = wat.getUTCHours() * 60 + wat.getUTCMinutes();
      return d === 0 && mins >= 465 && mins <= 630;
    })();

    res.json({
      automation: {
        enabled: true,
        pollingInterval: isSundayServiceWindow ? "5s (Sunday service window)" : "30s (standard)",
        sundayServiceWindowActive: isSundayServiceWindow,
        rebroadcastDurationDays: 4,
        smartCurationEnabled: !!process.env.OPENAI_API_KEY,
        timezone: "WAT (UTC+1, Africa/Lagos)",
        channelId: "UCPFFvkE-KGpR37qJgvYriJg",
        youtubeApiConfigured: !!process.env.YOUTUBE_API_KEY,
      },
      nextScheduled: {
        sunday8amWAT: nextSundayWAT.toISOString(),
        description: "Next Sunday 8:00 AM WAT service window opens",
      },
      library: stats,
      serverTime: now.toISOString(),
      serverTimeWAT: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch broadcast status" });
  }
});

// ─── GET /api/broadcast/queue ─────────────────────────────────────────────────
// AI-curated rebroadcast queue

router.get("/broadcast/queue", async (req: Request, res: Response): Promise<void> => {
  try {
    const excludeVideoId = typeof req.query.exclude === "string" ? req.query.exclude : null;
    const selection = await buildSmartRebroadcastQueue(excludeVideoId, req.log);

    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=60");
    res.json({
      strategy: selection.strategy,
      curatedAt: selection.curatedAt,
      primary: selection.primary,
      queue: selection.queue,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to build rebroadcast queue");
    res.status(500).json({ error: "Failed to build rebroadcast queue" });
  }
});

// ─── GET /api/broadcast/schedule ─────────────────────────────────────────────
// Next 4 weeks of Sunday service schedule

router.get("/broadcast/schedule", (_req: Request, res: Response): void => {
  const now = new Date();
  const schedule: { date: string; timeWAT: string; timeUTC: string; label: string }[] = [];

  const watNow = new Date(now.getTime() + 60 * 60 * 1000);
  const dayOfWeek = watNow.getUTCDay();
  const daysUntilSunday = dayOfWeek === 0
    ? (watNow.getUTCHours() * 60 + watNow.getUTCMinutes() < 630 ? 0 : 7)
    : 7 - dayOfWeek;

  for (let week = 0; week < 4; week++) {
    const sunday = new Date(watNow);
    sunday.setUTCDate(sunday.getUTCDate() + daysUntilSunday + week * 7);
    sunday.setUTCHours(8, 0, 0, 0); // 8:00 WAT

    const utcTime = new Date(sunday.getTime() - 60 * 60 * 1000);

    schedule.push({
      date: sunday.toISOString().split("T")[0]!,
      timeWAT: `${sunday.toISOString().split("T")[0]} 08:00 WAT`,
      timeUTC: utcTime.toISOString(),
      label: week === 0 ? "Next Service" : `In ${week + 1} weeks`,
    });
  }

  res.setHeader("Cache-Control", "public, s-maxage=3600");
  res.json({ schedule, timezone: "WAT (UTC+1)" });
});

// ─── GET /api/broadcast/metrics ──────────────────────────────────────────────
// Broadcast system metrics for admin dashboard

router.get("/broadcast/metrics", async (_req: Request, res: Response): Promise<void> => {
  try {
    // View count distribution
    const [viewStats] = await db
      .select({
        totalViews: sql<number>`cast(coalesce(sum(view_count), 0) as int)`,
        maxViews: sql<number>`cast(coalesce(max(view_count), 0) as int)`,
        avgViews: sql<number>`cast(coalesce(avg(view_count), 0) as int)`,
        totalSermons: sql<number>`cast(count(*) as int)`,
        liveCount: sql<number>`cast(sum(case when is_live = true then 1 else 0 end) as int)`,
        featuredCount: sql<number>`cast(sum(case when is_featured = true then 1 else 0 end) as int)`,
      })
      .from(sermonsTable);

    // Most recent 5 sermons
    const recentSermons = await db
      .select({
        videoId: sermonsTable.videoId,
        title: sermonsTable.title,
        publishedAt: sermonsTable.publishedAt,
        viewCount: sermonsTable.viewCount,
        isFeatured: sermonsTable.isFeatured,
        isLive: sermonsTable.isLive,
      })
      .from(sermonsTable)
      .orderBy(desc(sermonsTable.publishedAt))
      .limit(5);

    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=30");
    res.json({
      overview: viewStats,
      recentSermons: recentSermons.map(s => ({
        ...s,
        publishedAt: s.publishedAt instanceof Date ? s.publishedAt.toISOString() : s.publishedAt,
      })),
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch broadcast metrics" });
  }
});

// ─── GET /api/broadcast/history/latest ───────────────────────────────────────
// Returns the most recent broadcast event (live start or rebroadcast start).
// Used by the frontend re-engagement system: on revisit, if the visitor hasn't
// seen this broadcast yet, show a non-intrusive in-app notification.

router.get("/broadcast/history/latest", async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query<{
      id: number;
      type: string;
      title: string | null;
      video_id: string | null;
      message: string;
      url: string;
      push_sent: number;
      fired_at: string;
    }>(`
      SELECT id, type, title, video_id, message, url, push_sent, fired_at
      FROM broadcast_events
      ORDER BY fired_at DESC
      LIMIT 1
    `);

    if (!result.rows.length) {
      res.json(null);
      return;
    }

    const row = result.rows[0]!;
    res.setHeader("Cache-Control", "no-store");
    res.json({
      id: row.id,
      type: row.type,
      title: row.title,
      videoId: row.video_id,
      message: row.message,
      url: row.url,
      firedAt: row.fired_at,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch broadcast history" });
  }
});

// ─── GET /api/broadcast/history ───────────────────────────────────────────────
// Last 20 broadcast events — for admin dashboard visibility

router.get("/broadcast/history", async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(`
      SELECT id, type, title, video_id, message, url, push_sent, fired_at
      FROM broadcast_events
      ORDER BY fired_at DESC
      LIMIT 20
    `);

    res.setHeader("Cache-Control", "no-store");
    res.json(result.rows.map(r => ({
      id: r.id,
      type: r.type,
      title: r.title,
      videoId: r.video_id,
      message: r.message,
      url: r.url,
      pushSent: r.push_sent,
      firedAt: r.fired_at,
    })));
  } catch {
    res.status(500).json({ error: "Failed to fetch broadcast history" });
  }
});

export default router;
