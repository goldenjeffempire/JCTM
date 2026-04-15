import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, galleryImagesTable } from "@workspace/db";
import {
  ListGalleryImagesQueryParams,
  ListGalleryImagesResponse,
  CreateGalleryImageBody,
  UpdateGalleryImageParams,
  UpdateGalleryImageBody,
  DeleteGalleryImageParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/gallery", async (req, res): Promise<void> => {
  const parsed = ListGalleryImagesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { limit = 50, offset = 0, category } = parsed.data;

  const conditions = [eq(galleryImagesTable.isPublished, true)];
  if (category) {
    conditions.push(eq(galleryImagesTable.category, category));
  }

  const images = await db
    .select()
    .from(galleryImagesTable)
    .where(and(...conditions))
    .orderBy(desc(galleryImagesTable.sortOrder), desc(galleryImagesTable.createdAt))
    .limit(limit)
    .offset(offset);

  const serialized = images.map(img => ({
    ...img,
    createdAt: img.createdAt instanceof Date ? img.createdAt.toISOString() : img.createdAt,
  }));

  res.json(ListGalleryImagesResponse.parse(serialized));
});

router.post("/gallery", async (req, res): Promise<void> => {
  const parsed = CreateGalleryImageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [image] = await db
    .insert(galleryImagesTable)
    .values({
      objectPath: parsed.data.objectPath,
      title: parsed.data.title ?? "",
      description: parsed.data.description ?? null,
      category: parsed.data.category ?? "service",
      serviceDate: parsed.data.serviceDate ?? null,
      altText: parsed.data.altText ?? null,
      isPublished: parsed.data.isPublished ?? true,
      sortOrder: parsed.data.sortOrder ?? 0,
    })
    .returning();

  res.status(201).json({
    ...image,
    createdAt: image.createdAt instanceof Date ? image.createdAt.toISOString() : image.createdAt,
  });
});

router.patch("/gallery/:id", async (req, res): Promise<void> => {
  const paramsParsed = UpdateGalleryImageParams.safeParse(req.params);
  if (!paramsParsed.success) {
    res.status(400).json({ error: paramsParsed.error.message });
    return;
  }

  const bodyParsed = UpdateGalleryImageBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.message });
    return;
  }

  const updates: Partial<typeof galleryImagesTable.$inferInsert> = {};
  const data = bodyParsed.data;
  if (data.title != null) updates.title = data.title;
  if (data.description !== undefined) updates.description = data.description;
  if (data.category != null) updates.category = data.category;
  if (data.serviceDate !== undefined) updates.serviceDate = data.serviceDate;
  if (data.altText !== undefined) updates.altText = data.altText;
  if (data.isPublished != null) updates.isPublished = data.isPublished;
  if (data.sortOrder != null) updates.sortOrder = data.sortOrder;

  const [image] = await db
    .update(galleryImagesTable)
    .set(updates)
    .where(eq(galleryImagesTable.id, paramsParsed.data.id))
    .returning();

  if (!image) {
    res.status(404).json({ error: "Gallery image not found" });
    return;
  }

  res.json({
    ...image,
    createdAt: image.createdAt instanceof Date ? image.createdAt.toISOString() : image.createdAt,
  });
});

router.delete("/gallery/:id", async (req, res): Promise<void> => {
  const parsed = DeleteGalleryImageParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  await db
    .delete(galleryImagesTable)
    .where(eq(galleryImagesTable.id, parsed.data.id));

  res.json({ success: true });
});

export default router;
