import { Router, type IRouter } from "express";
import { db, sermonsTable } from "@workspace/db";
import { syncSingleVideo } from "../lib/youtube-sync.js";
import { sseBroadcaster } from "../lib/sse-broadcaster.js";
import { desc } from "drizzle-orm";

const router: IRouter = Router();

/**
 * GET /api/sermons/websub
 * PubSubHubbub hub verification. The hub sends a challenge query param
 * that must be echoed back with a 200 status to confirm the subscription.
 */
router.get("/sermons/websub", (req, res): void => {
  const challenge = req.query["hub.challenge"];
  const mode = req.query["hub.mode"];

  if (mode === "subscribe" || mode === "unsubscribe") {
    if (typeof challenge === "string") {
      req.log.info({ mode }, "WebSub hub verification passed");
      res.status(200).send(challenge);
      return;
    }
  }

  res.status(400).json({ error: "Invalid WebSub verification request" });
});

/**
 * POST /api/sermons/websub
 * Receives Atom feed push notifications from YouTube when a new video
 * is published or a live stream starts on the JCTM channel.
 */
router.post("/sermons/websub", async (req, res): Promise<void> => {
  const apiKey = process.env.YOUTUBE_API_KEY;

  // Acknowledge receipt immediately (hub expects 2xx)
  res.status(200).send("OK");

  if (!apiKey) {
    req.log.warn("YOUTUBE_API_KEY not set, cannot process WebSub notification");
    return;
  }

  // Parse the Atom XML payload to extract the video ID
  let body = "";
  req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
  req.on("end", async () => {
    try {
      const videoIdMatch = body.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
      if (!videoIdMatch) {
        req.log.warn({ body: body.slice(0, 300) }, "WebSub: no videoId found in payload");
        return;
      }

      const videoId = videoIdMatch[1];
      req.log.info({ videoId }, "WebSub: received push notification");

      await syncSingleVideo(apiKey, videoId, req.log);

      // Broadcast the new sermon to all connected SSE clients
      const [newSermon] = await db
        .select()
        .from(sermonsTable)
        .orderBy(desc(sermonsTable.createdAt))
        .limit(1);

      if (newSermon) {
        sseBroadcaster.broadcast({
          type: "new_sermon",
          data: {
            id: newSermon.id,
            videoId: newSermon.videoId,
            title: newSermon.title,
            thumbnailUrl: newSermon.thumbnailUrl,
            isFeatured: newSermon.isFeatured,
            isLive: newSermon.isLive,
            publishedAt: newSermon.publishedAt instanceof Date
              ? newSermon.publishedAt.toISOString()
              : newSermon.publishedAt,
          },
        });
      }
    } catch (err) {
      req.log.error({ err }, "WebSub: failed to process notification");
    }
  });
});

export default router;
