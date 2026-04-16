import { Router, type IRouter } from "express";
import { db, sermonsTable } from "@workspace/db";
import { syncSingleVideo, QuotaExceededError, CHANNEL_ID, classifyTitle } from "../lib/youtube-sync.js";
import { syncFromRSS } from "../lib/rss-sync.js";
import { isQuotaPaused, getQuotaResetTime, setQuotaPaused } from "../lib/cron.js";
import { sseBroadcaster } from "../lib/sse-broadcaster.js";
import { desc, eq, sql } from "drizzle-orm";
import type { Logger } from "pino";

const router: IRouter = Router();

/**
 * GET /api/sermons/websub
 * PubSubHubbub hub verification. The hub sends a challenge query param
 * that must be echoed back with a 200 status to confirm the subscription.
 */
router.get("/sermons/websub", (req, res): void => {
  const challenge = req.query["hub.challenge"];
  const mode  = req.query["hub.mode"];
  const topic = req.query["hub.topic"];

  req.log.info({ mode, topic, hasChallenge: typeof challenge === "string" }, "WebSub verification request received");

  if (typeof challenge === "string" && challenge.length > 0) {
    req.log.info({ mode }, "WebSub hub verification passed");
    res.status(200).send(challenge);
    return;
  }

  req.log.warn({ query: req.query }, "WebSub verification missing hub.challenge");
  res.status(400).json({ error: "Missing hub.challenge parameter" });
});

/**
 * POST /api/sermons/websub
 * Receives Atom feed push notifications from YouTube when a new video
 * is published or a live stream starts on the JCTM channel.
 *
 * Strategy:
 *  1. Acknowledge receipt immediately (hub expects 2xx before timeout).
 *  2. If the YouTube API quota is available, call syncSingleVideo for rich metadata.
 *  3. If quota is paused, run an RSS sync as a fallback — the new video will be
 *     picked up from the feed within minutes anyway, and an immediate RSS run
 *     ensures it enters the DB without waiting for the next 5-min cron tick.
 *  4. Handle deletion notifications by removing the video from the DB.
 */
router.post("/sermons/websub", async (req, res): Promise<void> => {
  const apiKey = process.env.YOUTUBE_API_KEY;

  // Consume the raw XML body — express.json/urlencoded skip non-matching
  // content types so the stream is still in paused mode here.
  const rawBody = await new Promise<string>((resolve, reject) => {
    let data = "";
    req.on("data", (chunk: Buffer) => { data += chunk.toString(); });
    req.on("end",  () => resolve(data));
    req.on("error",   reject);
  });

  // Acknowledge receipt — the hub must get 2xx before it times out.
  res.status(200).send("OK");

  try {
    // ── Deletion notification ─────────────────────────────────────────────
    // YouTube sends <at:deleted-entry ref="yt:video:<videoId>"> when a video
    // is removed.  Remove it from our DB to stay in sync.
    const deletedMatch = rawBody.match(/<at:deleted-entry[^>]+ref="yt:video:([A-Za-z0-9_-]{11})"/);
    if (deletedMatch) {
      const deletedId = deletedMatch[1];
      req.log.info({ videoId: deletedId }, "WebSub: video deletion notification received");
      const result = await db
        .delete(sermonsTable)
        .where(eq(sermonsTable.videoId, deletedId))
        .returning({ id: sermonsTable.id });
      if (result.length > 0) {
        req.log.info({ videoId: deletedId }, "WebSub: deleted video removed from DB");
        sseBroadcaster.broadcast({ type: "sync_complete", data: { synced: 0, deleted: deletedId } });
      } else {
        req.log.info({ videoId: deletedId }, "WebSub: deletion for unknown video — no action");
      }
      return;
    }

    // ── New / updated video notification ─────────────────────────────────
    const videoIdMatch = rawBody.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
    if (!videoIdMatch) {
      req.log.warn({ body: rawBody.slice(0, 300) }, "WebSub: no videoId found in payload");
      return;
    }

    const videoId = videoIdMatch[1]!.trim();
    req.log.info({ videoId }, "WebSub: received push notification");

    // ── Branch A: API available — sync with full metadata ─────────────────
    if (apiKey && !isQuotaPaused()) {
      try {
        await syncSingleVideo(apiKey, videoId, req.log);
      } catch (err) {
        if (err instanceof QuotaExceededError) {
          // Quota just ran out — record the pause then fall back to RSS
          const midnight = new Date(Date.UTC(
            new Date().getUTCFullYear(),
            new Date().getUTCMonth(),
            new Date().getUTCDate() + 1,
          ));
          setQuotaPaused(midnight.getTime());
          req.log.warn(
            { resumesAt: midnight.toUTCString() },
            "WebSub: hit YouTube quota while syncing video — falling back to RSS",
          );
        } else {
          req.log.error({ err, videoId }, "WebSub: syncSingleVideo failed — falling back to RSS");
        }
        await _rssFallback(videoId, rawBody, req.log);
        await _broadcastLatest(req.log);
        return;
      }
    } else {
      // ── Branch B: Quota paused or no API key — use RSS fallback ──────────
      const reason = !apiKey ? "no YOUTUBE_API_KEY" : "quota paused";
      const resetTime = getQuotaResetTime();
      req.log.info(
        { videoId, reason, quotaResets: resetTime?.toUTCString() ?? "n/a" },
        "WebSub: API unavailable — using RSS fallback for new video",
      );
      await _rssFallback(videoId, rawBody, req.log);
      await _broadcastLatest(req.log);
      return;
    }

    // ── Broadcast the new/updated sermon to SSE clients (API path) ────────
    await _broadcastLatest(req.log);
  } catch (err) {
    req.log.error({ err }, "WebSub: failed to process notification");
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * RSS fallback for WebSub: pre-seeds the video from the WebSub payload body,
 * then runs an RSS sync to pick up the latest feed with full RSS-quality metadata.
 */
async function _rssFallback(videoId: string, rawBody: string, log: Logger): Promise<void> {
  try {
    // Validate the notification is for JCTM
    const channelMatch = rawBody.match(/<yt:channelId>([^<]+)<\/yt:channelId>/);
    if (channelMatch && channelMatch[1]!.trim() !== CHANNEL_ID) {
      log.warn("WebSub RSS fallback: notification is not from JCTM channel — skipping");
      return;
    }

    // Pre-seed basic metadata from the WebSub body so the video appears
    // immediately rather than waiting for the next 5-min RSS cron tick.
    const titleMatch  = rawBody.match(/<title>([^<]+)<\/title>/);
    const pubMatch    = rawBody.match(/<published>([^<]+)<\/published>/);
    const rawTitle    = titleMatch?.[1]?.trim();
    const publishedAt = pubMatch?.[1]?.trim();

    if (rawTitle && publishedAt) {
      const { isFeatured, isLive } = classifyTitle(rawTitle);

      await db
        .insert(sermonsTable)
        .values({
          videoId,
          title:        rawTitle,
          thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          description:  "",
          publishedAt:  new Date(publishedAt),
          isFeatured,
          isLive,
        })
        .onConflictDoUpdate({
          target: sermonsTable.videoId,
          set: {
            title:      sql`CASE WHEN sermon_data.title != EXCLUDED.title THEN EXCLUDED.title ELSE sermon_data.title END`,
            isFeatured: sql`sermon_data.is_featured OR ${isFeatured}`,
          },
        });

      log.info({ videoId, title: rawTitle }, "WebSub RSS fallback: pre-seeded video from WebSub body");
    }

    // Fresh RSS sync to fill in all 15 latest videos with proper RSS metadata
    const rssResult = await syncFromRSS(log);
    log.info({ rssResult }, "WebSub RSS fallback: RSS sync complete");
  } catch (err) {
    log.warn({ err }, "WebSub RSS fallback failed (non-fatal)");
  }
}

async function _broadcastLatest(log: Logger): Promise<void> {
  try {
    const [newSermon] = await db
      .select()
      .from(sermonsTable)
      .orderBy(desc(sermonsTable.createdAt))
      .limit(1);

    if (newSermon) {
      sseBroadcaster.broadcast({
        type: "new_sermon",
        data: {
          id:           newSermon.id,
          videoId:      newSermon.videoId,
          title:        newSermon.title,
          thumbnailUrl: newSermon.thumbnailUrl,
          isFeatured:   newSermon.isFeatured,
          isLive:       newSermon.isLive,
          publishedAt:  newSermon.publishedAt instanceof Date
            ? newSermon.publishedAt.toISOString()
            : newSermon.publishedAt,
        },
      });
    }
  } catch {
    /* non-fatal broadcast failure */
  }
}

export default router;
