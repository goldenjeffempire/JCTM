import { Router, type IRouter } from "express";
import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdminRole } from "../lib/adminAuth.js";

const router: IRouter = Router();

const YT_ID_RE = /^[A-Za-z0-9_-]{5,20}$/;

// GET /home-videos — public: returns current custom video IDs for the home page
router.get("/home-videos", async (_req, res): Promise<void> => {
  const [highlight, broadcast] = await Promise.all([
    db.select().from(settingsTable).where(eq(settingsTable.key, "home_highlight_video_id")).limit(1),
    db.select().from(settingsTable).where(eq(settingsTable.key, "home_broadcast_video_id")).limit(1),
  ]);
  res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");
  res.json({
    highlightVideoId: highlight[0]?.textValue ?? null,
    broadcastVideoId: broadcast[0]?.textValue ?? null,
  });
});

// POST /admin/home-videos/highlight — set today's highlight video ID (sermon or livestream admin)
router.post(
  "/admin/home-videos/highlight",
  requireAdminRole(["sermon", "livestream"]),
  async (req, res): Promise<void> => {
    const { videoId } = req.body as { videoId?: string };
    if (!videoId || !YT_ID_RE.test(videoId)) {
      res.status(400).json({ error: "Invalid YouTube video ID" });
      return;
    }
    await db
      .insert(settingsTable)
      .values({ key: "home_highlight_video_id", textValue: videoId })
      .onConflictDoUpdate({
        target: settingsTable.key,
        set: { textValue: videoId, updatedAt: new Date() },
      });
    res.json({ ok: true, videoId });
  }
);

// DELETE /admin/home-videos/highlight — clear highlight override (falls back to featured sermon)
router.delete(
  "/admin/home-videos/highlight",
  requireAdminRole(["sermon", "livestream"]),
  async (_req, res): Promise<void> => {
    await db.delete(settingsTable).where(eq(settingsTable.key, "home_highlight_video_id"));
    res.json({ ok: true });
  }
);

// POST /admin/home-videos/broadcast — set latest broadcast video ID (sermon or livestream admin)
router.post(
  "/admin/home-videos/broadcast",
  requireAdminRole(["sermon", "livestream"]),
  async (req, res): Promise<void> => {
    const { videoId } = req.body as { videoId?: string };
    if (!videoId || !YT_ID_RE.test(videoId)) {
      res.status(400).json({ error: "Invalid YouTube video ID" });
      return;
    }
    await db
      .insert(settingsTable)
      .values({ key: "home_broadcast_video_id", textValue: videoId })
      .onConflictDoUpdate({
        target: settingsTable.key,
        set: { textValue: videoId, updatedAt: new Date() },
      });
    res.json({ ok: true, videoId });
  }
);

// DELETE /admin/home-videos/broadcast — clear broadcast override
router.delete(
  "/admin/home-videos/broadcast",
  requireAdminRole(["sermon", "livestream"]),
  async (_req, res): Promise<void> => {
    await db.delete(settingsTable).where(eq(settingsTable.key, "home_broadcast_video_id"));
    res.json({ ok: true });
  }
);

export default router;
