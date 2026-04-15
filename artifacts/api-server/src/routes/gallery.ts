import { Router, type IRouter } from "express";
import { eq, desc, and, or, ilike, sql } from "drizzle-orm";
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
} from "../lib/adminAuth.js";
import { ObjectStorageService } from "../lib/objectStorage.js";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

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

  const { limit = 50, offset = 0, category, search } = parsed.data;

  const conditions = [eq(galleryImagesTable.isPublished, true)];

  if (category) {
    conditions.push(eq(galleryImagesTable.category, category));
  }

  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    conditions.push(
      or(
        ilike(galleryImagesTable.title, term),
        ilike(galleryImagesTable.description, term),
        ilike(galleryImagesTable.altText, term),
        ilike(galleryImagesTable.serviceDate, term),
      )!,
    );
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

  // Fire-and-forget: generate a WebP thumbnail in the background.
  // Capture the logger reference before the async block so it remains valid
  // after the HTTP response has been flushed.
  const log = req.log;
  const imageId = image.id;
  const objectPath = parsed.data.objectPath;
  (async () => {
    try {
      const thumbnailPath = await objectStorageService.generateAndStoreThumbnail(objectPath);
      await db
        .update(galleryImagesTable)
        .set({ thumbnailPath })
        .where(eq(galleryImagesTable.id, imageId));
    } catch (err) {
      log.warn({ err, imageId }, "Thumbnail generation failed — original image will be used");
    }
  })();
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

router.post("/gallery/:id/regenerate-thumbnail", requireGalleryAdmin, async (req, res): Promise<void> => {
  const paramsParsed = UpdateGalleryImageParams.safeParse(req.params);
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid image ID" });
    return;
  }

  const [existing] = await db
    .select()
    .from(galleryImagesTable)
    .where(eq(galleryImagesTable.id, paramsParsed.data.id));

  if (!existing) {
    res.status(404).json({ error: "Gallery image not found" });
    return;
  }

  try {
    const thumbnailPath = await objectStorageService.generateAndStoreThumbnail(existing.objectPath);
    const [updated] = await db
      .update(galleryImagesTable)
      .set({ thumbnailPath })
      .where(eq(galleryImagesTable.id, existing.id))
      .returning();
    res.json(serializeImage(updated));
  } catch (err) {
    req.log.error({ err, imageId: existing.id }, "Thumbnail regeneration failed");
    res.status(500).json({ error: "Failed to generate thumbnail. The original image may not be in storage yet." });
  }
});

router.delete("/gallery/:id", requireGalleryAdmin, async (req, res): Promise<void> => {
  const parsed = DeleteGalleryImageParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Fetch the record first so we know which storage objects to clean up
  const [existing] = await db
    .select()
    .from(galleryImagesTable)
    .where(eq(galleryImagesTable.id, parsed.data.id));

  if (!existing) {
    res.status(404).json({ error: "Gallery image not found" });
    return;
  }

  await db
    .delete(galleryImagesTable)
    .where(eq(galleryImagesTable.id, parsed.data.id));

  res.json({ success: true });

  // Clean up GCS objects in the background after responding
  const log = req.log;
  (async () => {
    const paths = [existing.objectPath, existing.thumbnailPath].filter(Boolean) as string[];
    await Promise.allSettled(
      paths.map(p =>
        objectStorageService.deleteObjectEntity(p).catch(err =>
          log.warn({ err, path: p }, "Could not delete storage object during gallery image removal")
        )
      )
    );
  })();
});

export default router;
