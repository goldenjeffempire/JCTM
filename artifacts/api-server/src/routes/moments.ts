import { Router, type IRouter } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import { db, momentLikesTable, momentCommentsTable, momentEngagementsTable } from "@workspace/db";
import { postYouTubeComment, syncEngagementComment } from "../lib/youtube-oauth.js";

const router: IRouter = Router();

function isValidVideoId(v: unknown): v is string {
  return typeof v === "string" && v.length >= 1;
}

function isValidVisitorId(v: unknown): v is string {
  return typeof v === "string" && v.length >= 1 && v.length <= 128;
}

// ── Shared helper: read counts + engagement record for a video ─────────────
async function getVideoEngagement(videoId: string) {
  const [[likeRow], [engagement]] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` })
      .from(momentLikesTable)
      .where(eq(momentLikesTable.videoId, videoId)),
    db.select()
      .from(momentEngagementsTable)
      .where(eq(momentEngagementsTable.videoId, videoId))
      .limit(1),
  ]);
  return {
    likeCount:   likeRow?.count ?? 0,
    shareCount:  engagement?.shareCount ?? 0,
    commentId:   engagement?.ytEngagementCommentId ?? null,
  };
}

// ── Upsert engagement row with a new YouTube comment ID ───────────────────
async function storeEngagementCommentId(videoId: string, commentId: string) {
  await db.insert(momentEngagementsTable)
    .values({ videoId, ytEngagementCommentId: commentId, shareCount: 0 })
    .onConflictDoUpdate({
      target: momentEngagementsTable.videoId,
      set:    { ytEngagementCommentId: commentId, updatedAt: new Date() },
    });
}

// ── Fire-and-forget YouTube engagement sync ───────────────────────────────
function fireEngagementSync(videoId: string, likeCount: number, shareCount: number, commentId: string | null) {
  syncEngagementComment(videoId, commentId, likeCount, shareCount)
    .then(async (returnedId) => {
      if (returnedId && !commentId) {
        await storeEngagementCommentId(videoId, returnedId);
      }
    })
    .catch(() => {});
}

// ──────────────────────────────────────────────────────
// GET /moments/:videoId/likes?visitorId=xxx
// Returns like count, liked status, and share count.
// ──────────────────────────────────────────────────────
router.get("/moments/:videoId/likes", async (req, res): Promise<void> => {
  const { videoId } = req.params;
  if (!isValidVideoId(videoId)) { res.status(400).json({ error: "Invalid videoId" }); return; }

  const visitorId = req.query["visitorId"];

  const [[countRow], [engagement]] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` })
      .from(momentLikesTable)
      .where(eq(momentLikesTable.videoId, videoId)),
    db.select({ shareCount: momentEngagementsTable.shareCount })
      .from(momentEngagementsTable)
      .where(eq(momentEngagementsTable.videoId, videoId))
      .limit(1),
  ]);

  let liked = false;
  if (isValidVisitorId(visitorId)) {
    const [row] = await db
      .select({ id: momentLikesTable.id })
      .from(momentLikesTable)
      .where(and(eq(momentLikesTable.videoId, videoId), eq(momentLikesTable.visitorId, visitorId)))
      .limit(1);
    liked = !!row;
  }

  res.json({
    count:      countRow?.count ?? 0,
    liked,
    shareCount: engagement?.shareCount ?? 0,
  });
});

// ──────────────────────────────────────────────────────
// POST /moments/:videoId/like
// Body: { visitorId: string }
// Toggles like locally and syncs engagement comment to YouTube.
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

  const { likeCount, shareCount, commentId } = await getVideoEngagement(videoId);

  // Mirror updated counts to YouTube (fire-and-forget)
  fireEngagementSync(videoId, likeCount, shareCount, commentId);

  res.json({
    count:      likeCount,
    liked:      !existing,
    shareCount,
  });
});

// ──────────────────────────────────────────────────────
// POST /moments/:videoId/share
// Body: { visitorId: string }
// Increments share count and syncs engagement comment to YouTube.
// ──────────────────────────────────────────────────────
router.post("/moments/:videoId/share", async (req, res): Promise<void> => {
  const { videoId } = req.params;
  if (!isValidVideoId(videoId)) { res.status(400).json({ error: "Invalid videoId" }); return; }

  const { visitorId } = req.body as { visitorId?: unknown };
  if (!isValidVisitorId(visitorId)) { res.status(400).json({ error: "visitorId is required" }); return; }

  // Upsert engagement row — increment share_count
  await db.insert(momentEngagementsTable)
    .values({ videoId, shareCount: 1 })
    .onConflictDoUpdate({
      target: momentEngagementsTable.videoId,
      set: {
        shareCount: sql`${momentEngagementsTable.shareCount} + 1`,
        updatedAt:  new Date(),
      },
    });

  const { likeCount, shareCount, commentId } = await getVideoEngagement(videoId);

  // Mirror updated counts to YouTube (fire-and-forget)
  fireEngagementSync(videoId, likeCount, shareCount, commentId);

  res.json({ shareCount });
});

// ──────────────────────────────────────────────────────
// GET /moments/:videoId/comments
// ──────────────────────────────────────────────────────
router.get("/moments/:videoId/comments", async (req, res): Promise<void> => {
  const { videoId } = req.params;
  if (!isValidVideoId(videoId)) { res.status(400).json({ error: "Invalid videoId" }); return; }

  const comments = await db
    .select({
      id:          momentCommentsTable.id,
      name:        momentCommentsTable.name,
      body:        momentCommentsTable.body,
      createdAt:   momentCommentsTable.createdAt,
      ytCommentId: momentCommentsTable.ytCommentId,
    })
    .from(momentCommentsTable)
    .where(eq(momentCommentsTable.videoId, videoId))
    .orderBy(desc(momentCommentsTable.createdAt))
    .limit(100);

  res.json(comments.map(c => ({
    ...c,
    createdAt:  c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
    ytMirrored: !!c.ytCommentId,
  })));
});

// ──────────────────────────────────────────────────────
// POST /moments/:videoId/comments
// Body: { visitorId, name, body }
// Saves to platform DB and mirrors to YouTube if OAuth is configured.
// ──────────────────────────────────────────────────────
router.post("/moments/:videoId/comments", async (req, res): Promise<void> => {
  const { videoId } = req.params;
  if (!isValidVideoId(videoId)) { res.status(400).json({ error: "Invalid videoId" }); return; }

  const body = req.body as { visitorId?: unknown; name?: unknown; body?: unknown };
  if (!isValidVisitorId(body.visitorId)) { res.status(400).json({ error: "visitorId is required" }); return; }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const text = typeof body.body === "string" ? body.body.trim() : "";

  if (!name || name.length > 80)    { res.status(400).json({ error: "name is required (max 80 chars)" });   return; }
  if (!text || text.length > 1000)  { res.status(400).json({ error: "body is required (max 1000 chars)" }); return; }

  // Mirror to YouTube (fire-and-forget with result)
  const ytCommentId = await postYouTubeComment(videoId, name, text);

  const [comment] = await db
    .insert(momentCommentsTable)
    .values({
      videoId,
      visitorId: body.visitorId as string,
      name,
      body: text,
      ytCommentId: ytCommentId ?? undefined,
    })
    .returning();

  res.status(201).json({
    ...comment,
    createdAt:  comment!.createdAt instanceof Date ? comment!.createdAt.toISOString() : comment!.createdAt,
    ytMirrored: !!ytCommentId,
  });
});

export default router;
