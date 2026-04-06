import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
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

  const testimonies = await db
    .select()
    .from(testimoniesTable)
    .where(eq(testimoniesTable.approved, true))
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
    .values({ ...parsed.data, approved: false })
    .returning();

  res.status(201).json(testimony);
});

export default router;
