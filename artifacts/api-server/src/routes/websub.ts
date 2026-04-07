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
  const topic = req.query["hub.topic"];

  req.log.info({ mode, topic, hasChallenge: typeof challenge === "string" }, "WebSub verification request received");

  // Per the WebSub spec the only requirement is to echo back hub.challenge.
  // Accept it regardless of whether hub.mode is present — some hubs omit it.
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
 */
router.post("/sermons/websub", async (req, res): Promise<void> => {
  const apiKey = process.env.YOUTUBE_API_KEY;

  // Read the raw XML body first. express.json/urlencoded skip non-matching
  // content types, so the stream is still in paused mode and safe to consume here.
  const rawBody = await new Promise<string>((resolve, reject) => {
    let data = "";
    req.on("data", (chunk: Buffer) => { data += chunk.toString(); });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });

  // Acknowledge receipt — hub expects 2xx before timing out
  res.status(200).send("OK");

  if (!apiKey) {
    req.log.warn("YOUTUBE_API_KEY not set, cannot process WebSub notification");
    return;
  }

  try {
    const videoIdMatch = rawBody.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
    if (!videoIdMatch) {
      req.log.warn({ body: rawBody.slice(0, 300) }, "WebSub: no videoId found in payload");
      return;
    }

    const videoId = videoIdMatch[1];
    req.log.info({ videoId }, "WebSub: received push notification, syncing");

    await syncSingleVideo(apiKey, videoId, req.log);

    // Broadcast the new sermon to any connected SSE clients
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

export default router;
