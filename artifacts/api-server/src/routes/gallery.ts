import { Router, type IRouter } from "express";
import { eq, desc, and, sql } from "drizzle-orm";
import { db, galleryImagesTable } from "@workspace/db";
import {
  ListGalleryImagesQueryParams,
  ListGalleryImagesResponse,
  ListFeaturedGalleryImagesResponse,
  CreateGalleryImageBody,
  UpdateGalleryImageParams,
  UpdateGalleryImageBody,
  DeleteGalleryImageParams,
} from "@workspace/api-zod";
import {
  createGalleryAdminToken,
  isGalleryAdminConfigured,
  requireGalleryAdmin,
  verifyGalleryAdminPassphrase,
  verifyGalleryAdminToken,
  getGalleryAdminTokenFromRequest,
} from "../lib/galleryAdminAuth";

const router: IRouter = Router();

const DEFAULT_GALLERY_CATEGORIES = [
  "service",
  "crusade",
  "conference",
  "outreach",
  "prayer",
  "special",
];

function serializeImage(img: typeof galleryImagesTable.$inferSelect) {
  return {
    ...img,
    createdAt: img.createdAt instanceof Date ? img.createdAt.toISOString() : img.createdAt,
  };
}

router.get("/gallery/featured", async (_req, res): Promise<void> => {
  const images = await db
    .select()
    .from(galleryImagesTable)
    .where(and(
      eq(galleryImagesTable.isPublished, true),
      eq(galleryImagesTable.isFeatured, true),
    ))
    .orderBy(desc(galleryImagesTable.sortOrder), desc(galleryImagesTable.createdAt));

  res.json(ListFeaturedGalleryImagesResponse.parse(images.map(serializeImage)));
});

router.post("/gallery/admin/login", async (req, res): Promise<void> => {
  if (!isGalleryAdminConfigured()) {
    res.status(503).json({ error: "Gallery admin access is not configured." });
    return;
  }

  const passphrase = typeof req.body?.passphrase === "string" ? req.body.passphrase : "";
  if (!verifyGalleryAdminPassphrase(passphrase)) {
    req.log.warn({ ip: req.ip }, "Gallery admin login failed");
    res.status(401).json({ error: "Invalid gallery admin passphrase." });
    return;
  }

  res.json(createGalleryAdminToken());
});

router.get("/gallery/admin/session", async (req, res): Promise<void> => {
  res.json({ authenticated: verifyGalleryAdminToken(getGalleryAdminTokenFromRequest(req)) });
});

router.get("/gallery/categories", async (_req, res): Promise<void> => {
  const rows = await db
    .select({ category: galleryImagesTable.category })
    .from(galleryImagesTable)
    .where(eq(galleryImagesTable.isPublished, true))
    .groupBy(galleryImagesTable.category)
    .orderBy(sql`lower(${galleryImagesTable.category})`);

  const categories = Array.from(
    new Set([
      ...DEFAULT_GALLERY_CATEGORIES,
      ...rows.map((row) => row.category).filter(Boolean),
    ]),
  );

  res.json(categories);
});

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

  res.json(ListGalleryImagesResponse.parse(images.map(serializeImage)));
});

router.post("/gallery", requireGalleryAdmin, async (req, res): Promise<void> => {
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
      isFeatured: parsed.data.isFeatured ?? false,
      sortOrder: parsed.data.sortOrder ?? 0,
    })
    .returning();

  res.status(201).json(serializeImage(image));
});

router.patch("/gallery/:id", requireGalleryAdmin, async (req, res): Promise<void> => {
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
  if (data.isFeatured != null) updates.isFeatured = data.isFeatured;
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

  res.json(serializeImage(image));
});

router.delete("/gallery/:id", requireGalleryAdmin, async (req, res): Promise<void> => {
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
