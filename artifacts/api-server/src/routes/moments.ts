import { Router, type IRouter } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import { db, momentLikesTable, momentCommentsTable } from "@workspace/db";

const router: IRouter = Router();

function isValidVideoId(v: unknown): v is string {
  return typeof v === "string" && v.length >= 1;
}

function isValidVisitorId(v: unknown): v is string {
  return typeof v === "string" && v.length >= 1 && v.length <= 128;
}

// ──────────────────────────────────────────────────────
// GET /moments/:videoId/likes?visitorId=xxx
// ──────────────────────────────────────────────────────
router.get("/moments/:videoId/likes", async (req, res): Promise<void> => {
  const { videoId } = req.params;
  if (!isValidVideoId(videoId)) { res.status(400).json({ error: "Invalid videoId" }); return; }

  const visitorId = req.query["visitorId"];
  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(momentLikesTable)
    .where(eq(momentLikesTable.videoId, videoId));

  let liked = false;
  if (isValidVisitorId(visitorId)) {
    const [row] = await db
      .select({ id: momentLikesTable.id })
      .from(momentLikesTable)
      .where(and(eq(momentLikesTable.videoId, videoId), eq(momentLikesTable.visitorId, visitorId)))
      .limit(1);
    liked = !!row;
  }

  res.json({ count: countRow?.count ?? 0, liked });
});

// ──────────────────────────────────────────────────────
// POST /moments/:videoId/like
// Body: { visitorId: string }
// Toggles like
// ──────────────────────────────────────────────────────
router.post("/moments/:videoId/like", async (req, res): Promise<void> => {
  const { videoId } = req.params;
  if (!isValidVideoId(videoId)) { res.status(400).json({ error: "Invalid videoId" }); return; }

  const { visitorId } = req.body as { visitorId?: unknown };
  if (!isValidVisitorId(visitorId)) { res.status(400).json({ error: "visitorId is required" }); return; }

  const [existing] = await db
    .select({ id: momentLikesTable.id })
    .from(momentLikesTable)
    .where(and(eq(momentLikesTable.videoId, videoId), eq(momentLikesTable.visitorId, visitorId)))
    .limit(1);

  if (existing) {
    await db.delete(momentLikesTable).where(eq(momentLikesTable.id, existing.id));
  } else {
    await db.insert(momentLikesTable).values({ videoId, visitorId });
  }

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(momentLikesTable)
    .where(eq(momentLikesTable.videoId, videoId));

  res.json({ count: countRow?.count ?? 0, liked: !existing });
});

// ──────────────────────────────────────────────────────
// GET /moments/:videoId/comments
// ──────────────────────────────────────────────────────
router.get("/moments/:videoId/comments", async (req, res): Promise<void> => {
  const { videoId } = req.params;
  if (!isValidVideoId(videoId)) { res.status(400).json({ error: "Invalid videoId" }); return; }

  const comments = await db
    .select({
      id: momentCommentsTable.id,
      name: momentCommentsTable.name,
      body: momentCommentsTable.body,
      createdAt: momentCommentsTable.createdAt,
    })
    .from(momentCommentsTable)
    .where(eq(momentCommentsTable.videoId, videoId))
    .orderBy(desc(momentCommentsTable.createdAt))
    .limit(100);

  res.json(comments.map(c => ({
    ...c,
    createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
  })));
});

// ──────────────────────────────────────────────────────
// POST /moments/:videoId/comments
// Body: { visitorId, name, body }
// ──────────────────────────────────────────────────────
router.post("/moments/:videoId/comments", async (req, res): Promise<void> => {
  const { videoId } = req.params;
  if (!isValidVideoId(videoId)) { res.status(400).json({ error: "Invalid videoId" }); return; }

  const body = req.body as { visitorId?: unknown; name?: unknown; body?: unknown };
  if (!isValidVisitorId(body.visitorId)) { res.status(400).json({ error: "visitorId is required" }); return; }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const text = typeof body.body === "string" ? body.body.trim() : "";

  if (!name || name.length > 80) { res.status(400).json({ error: "name is required (max 80 chars)" }); return; }
  if (!text || text.length > 1000) { res.status(400).json({ error: "body is required (max 1000 chars)" }); return; }

  const [comment] = await db
    .insert(momentCommentsTable)
    .values({ videoId, visitorId: body.visitorId as string, name, body: text })
    .returning();

  res.status(201).json({
    ...comment,
    createdAt: comment!.createdAt instanceof Date ? comment!.createdAt.toISOString() : comment!.createdAt,
  });
});

export default router;
