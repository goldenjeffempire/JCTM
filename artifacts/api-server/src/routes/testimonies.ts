import { Router, type IRouter, type Request, type Response } from "express";
import { eq, desc, and, isNull } from "drizzle-orm";
import { db, testimoniesTable } from "@workspace/db";
import {
  ListTestimoniesQueryParams,
  ListTestimoniesResponse,
  SubmitTestimonyBody,
} from "@workspace/api-zod";
import { verifyAdminToken, getAdminTokenFromRequest, requireAdminRole } from "../lib/adminAuth.js";
import { moderateContent, detectAnomaly } from "../lib/local-moderation.js";

const router: IRouter = Router();

// ── GET /api/testimonies ──────────────────────────────────────────────────────
router.get("/testimonies", async (req, res): Promise<void> => {
  const parsed = ListTestimoniesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { limit = 20, offset = 0 } = parsed.data;
  const category = req.query.category as string | undefined;

  // `all=true` returns unapproved testimonies — requires a valid admin JWT.
  // Without one the flag is silently ignored so the public endpoint never
  // leaks unmoderated content.
  const rawAll = req.query.all === "true";
  const isAdmin = rawAll && verifyAdminToken(getAdminTokenFromRequest(req)) !== null;
  const all = isAdmin;

  const conditions = all ? [] : [eq(testimoniesTable.approved, true)];
  if (category) {
    conditions.push(eq(testimoniesTable.category, category));
  }

  try {
    const testimonies = await db
      .select()
      .from(testimoniesTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(testimoniesTable.createdAt))
      .limit(limit)
      .offset(offset);

    const serialized = testimonies.map(t => ({
      ...t,
      createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : t.createdAt,
    }));
    if (!all) {
      res.setHeader("Cache-Control", "public, s-maxage=120, stale-while-revalidate=300");
    }
    res.json(ListTestimoniesResponse.parse(serialized));
  } catch {
    res.status(500).json({ error: "Failed to load testimonies" });
  }
});

// ── POST /api/testimonies ─────────────────────────────────────────────────────
router.post("/testimonies", async (req, res): Promise<void> => {
  const parsed = SubmitTestimonyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const ip = String(req.ip ?? req.socket?.remoteAddress ?? "unknown");
  const text = [parsed.data.name ?? "", parsed.data.content ?? ""].join(" ");

  const anomaly = detectAnomaly(ip, text);
  if (anomaly.riskLevel === "high") {
    res.status(429).json({ error: "Too many requests. Please wait before submitting again." });
    return;
  }

  const modResult = moderateContent(parsed.data.content ?? "", { context: "testimony", minLength: 20, maxLength: 3000 });
  if (modResult.decision === "reject") {
    res.status(422).json({ error: "Your testimony could not be submitted. " + (modResult.reasons[0] ?? "Please review your content and try again.") });
    return;
  }

  const [testimony] = await db
    .insert(testimoniesTable)
    .values({ ...parsed.data, approved: modResult.decision === "approve", likeCount: 0 })
    .returning();

  res.status(201).json({
    ...testimony,
    createdAt: testimony.createdAt instanceof Date ? testimony.createdAt.toISOString() : testimony.createdAt,
    moderated: true,
  });
});

// ── POST /api/testimonies/:id/like ────────────────────────────────────────────
router.post("/testimonies/:id/like", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid testimony ID" });
    return;
  }

  const [existing] = await db.select().from(testimoniesTable).where(eq(testimoniesTable.id, id)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Testimony not found" });
    return;
  }

  const [updated] = await db
    .update(testimoniesTable)
    .set({ likeCount: (existing.likeCount ?? 0) + 1 })
    .where(eq(testimoniesTable.id, id))
    .returning({ likeCount: testimoniesTable.likeCount });

  res.json({ likeCount: updated.likeCount });
});

// ── PATCH /api/testimonies/:id/approve — Admin: approve a testimony ───────────
router.patch(
  "/testimonies/:id/approve",
  requireAdminRole(["gallery", "sermon", "livestream"]),
  async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid testimony ID" });
      return;
    }

    const { approved } = req.body as { approved?: boolean };
    if (typeof approved !== "boolean") {
      res.status(400).json({ error: "approved (boolean) is required" });
      return;
    }

    const [updated] = await db
      .update(testimoniesTable)
      .set({ approved })
      .where(eq(testimoniesTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Testimony not found" });
      return;
    }

    res.json({
      success: true,
      id,
      approved,
      message: approved ? "Testimony approved and published." : "Testimony unapproved.",
    });
  },
);

// ── DELETE /api/testimonies/:id — Admin: delete a testimony ───────────────────
router.delete(
  "/testimonies/:id",
  requireAdminRole(["gallery", "sermon", "livestream"]),
  async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid testimony ID" });
      return;
    }

    const [deleted] = await db
      .delete(testimoniesTable)
      .where(eq(testimoniesTable.id, id))
      .returning({ id: testimoniesTable.id });

    if (!deleted) {
      res.status(404).json({ error: "Testimony not found" });
      return;
    }

    res.json({ success: true, id, message: "Testimony deleted." });
  },
);

export default router;
