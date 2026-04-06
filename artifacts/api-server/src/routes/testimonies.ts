import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, testimoniesTable } from "@workspace/db";
import {
  ListTestimoniesQueryParams,
  ListTestimoniesResponse,
  SubmitTestimonyBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/testimonies", async (req, res): Promise<void> => {
  const parsed = ListTestimoniesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { limit = 20, offset = 0 } = parsed.data;
  const category = req.query.category as string | undefined;

  const conditions = [eq(testimoniesTable.approved, true)];
  if (category) {
    conditions.push(eq(testimoniesTable.category, category));
  }

  const testimonies = await db
    .select()
    .from(testimoniesTable)
    .where(and(...conditions))
    .orderBy(desc(testimoniesTable.createdAt))
    .limit(limit)
    .offset(offset);

  const serialized = testimonies.map(t => ({
    ...t,
    createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : t.createdAt,
  }));
  res.json(ListTestimoniesResponse.parse(serialized));
});

router.post("/testimonies", async (req, res): Promise<void> => {
  const parsed = SubmitTestimonyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [testimony] = await db
    .insert(testimoniesTable)
    .values({ ...parsed.data, approved: false, likeCount: 0 })
    .returning();

  res.status(201).json({
    ...testimony,
    createdAt: testimony.createdAt instanceof Date ? testimony.createdAt.toISOString() : testimony.createdAt,
  });
});

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

export default router;
