import { Router, type IRouter } from "express";
import { eq, desc, and, or, ilike, sql, inArray } from "drizzle-orm";
import { z } from "zod";
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
import { sseBroadcaster } from "../lib/sse-broadcaster.js";
import { randomUUID } from "crypto";

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

// Inline schemas for bulk operations (not in openapi spec — admin-only endpoints)
const BulkDeleteGalleryBody = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(200),
});

const BulkCreateGalleryImageEntry = z.object({
  objectPath: z.string().min(1),
  title: z.string().optional(),
  description: z.string().nullable().optional(),
  category: z.string().optional(),
  serviceDate: z.string().nullable().optional(),
  altText: z.string().nullable().optional(),
  isPublished: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  sortOrder: z.number().optional(),
});

const BulkCreateGalleryBody = z.object({
  images: z.array(BulkCreateGalleryImageEntry).min(1).max(200),
});

function serializeImage(img: typeof galleryImagesTable.$inferSelect) {
  return {
    ...img,
    createdAt: img.createdAt instanceof Date ? img.createdAt.toISOString() : img.createdAt,
  };
}

function broadcastGalleryUpdate(
  action: "created" | "updated" | "deleted" | "thumbnail_ready" | "bulk_deleted",
  image?: Partial<typeof galleryImagesTable.$inferSelect>,
  extra?: Record<string, unknown>,
) {
  sseBroadcaster.broadcast({
    type: "gallery_updated",
    data: {
      action,
      imageId: image?.id,
      objectPath: image?.objectPath ?? null,
      thumbnailPath: image?.thumbnailPath ?? null,
      isPublished: image?.isPublished,
      isFeatured: image?.isFeatured,
      changedAt: new Date().toISOString(),
      ...extra,
    },
  });
}

router.get("/gallery/stream", (req, res): void => {
  const clientId = randomUUID();
  req.log.info({ clientId, total: sseBroadcaster.size() + 1 }, "Gallery SSE client connected");
  sseBroadcaster.add(clientId, res);

  req.on("close", () => {
    req.log.info({ clientId }, "Gallery SSE client disconnected");
  });
});

router.get("/gallery/featured", async (_req, res): Promise<void> => {
  try {
    const images = await db
      .select()
      .from(galleryImagesTable)
      .where(eq(galleryImagesTable.isPublished, true))
      .orderBy(desc(galleryImagesTable.isFeatured), desc(galleryImagesTable.sortOrder), desc(galleryImagesTable.createdAt));

    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
    res.json(ListFeaturedGalleryImagesResponse.parse(images.map(serializeImage)));
  } catch {
    res.status(500).json({ error: "Failed to load featured gallery images" });
  }
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
  try {
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

    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    res.json(categories);
  } catch {
    res.status(500).json({ error: "Failed to load gallery categories" });
  }
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

  try {
    const images = await db
      .select()
      .from(galleryImagesTable)
      .where(and(...conditions))
      .orderBy(desc(galleryImagesTable.sortOrder), desc(galleryImagesTable.createdAt))
      .limit(limit)
      .offset(offset);

    res.setHeader("Cache-Control", "public, max-age=10, stale-while-revalidate=60");
    res.json(ListGalleryImagesResponse.parse(images.map(serializeImage)));
  } catch {
    res.status(500).json({ error: "Failed to load gallery images" });
  }
});

// ─── Single image create ────────────────────────────────────────────────────
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
      isFeatured: parsed.data.isFeatured ?? true,
      sortOrder: parsed.data.sortOrder ?? 0,
    })
    .returning();

  res.status(201).json(serializeImage(image));
  broadcastGalleryUpdate("created", image);

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
      broadcastGalleryUpdate("thumbnail_ready", { ...image, thumbnailPath });
    } catch (err) {
      log.warn({ err, imageId }, "Thumbnail generation failed — original image will be used");
    }
  })();
});

// ─── Bulk image create ─────────────────────────────────────────────────────
// POST /gallery/bulk
// Accepts up to 200 image entries at once; each triggers background thumbnail generation.
router.post("/gallery/bulk", requireGalleryAdmin, async (req, res): Promise<void> => {
  const parsed = BulkCreateGalleryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const rows = parsed.data.images.map(img => ({
    objectPath: img.objectPath,
    title: img.title ?? "",
    description: img.description ?? null,
    category: img.category ?? "service",
    serviceDate: img.serviceDate ?? null,
    altText: img.altText ?? null,
    isPublished: img.isPublished ?? true,
    isFeatured: img.isFeatured ?? false,
    sortOrder: img.sortOrder ?? 0,
  }));

  const inserted = await db
    .insert(galleryImagesTable)
    .values(rows)
    .returning();

  res.status(201).json(inserted.map(serializeImage));

  // Broadcast creation for each image
  for (const image of inserted) {
    broadcastGalleryUpdate("created", image);
  }

  // Fire-and-forget thumbnail generation for all inserted images
  const log = req.log;
  (async () => {
    // Process thumbnails with limited concurrency to avoid overwhelming the server
    const THUMB_CONCURRENCY = 4;
    let i = 0;

    async function worker() {
      while (i < inserted.length) {
        const image = inserted[i++];
        if (!image) continue;
        try {
          const thumbnailPath = await objectStorageService.generateAndStoreThumbnail(image.objectPath);
          await db
            .update(galleryImagesTable)
            .set({ thumbnailPath })
            .where(eq(galleryImagesTable.id, image.id));
          broadcastGalleryUpdate("thumbnail_ready", { ...image, thumbnailPath });
        } catch (err) {
          log.warn({ err, imageId: image.id }, "Bulk thumbnail generation failed — original will be used");
        }
      }
    }

    await Promise.allSettled(
      Array.from({ length: Math.min(THUMB_CONCURRENCY, inserted.length) }, worker),
    );
  })();
});

// ─── Single image update ────────────────────────────────────────────────────
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
  broadcastGalleryUpdate("updated", image);
});

// ─── Regenerate thumbnail ───────────────────────────────────────────────────
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
    broadcastGalleryUpdate("thumbnail_ready", updated);
  } catch (err) {
    req.log.error({ err, imageId: existing.id }, "Thumbnail regeneration failed");
    res.status(500).json({ error: "Failed to generate thumbnail. The original image may not be in storage yet." });
  }
});

// ─── Single image delete ────────────────────────────────────────────────────
router.delete("/gallery/:id", requireGalleryAdmin, async (req, res): Promise<void> => {
  const parsed = DeleteGalleryImageParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

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
  broadcastGalleryUpdate("deleted", existing);

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

// ─── Bulk delete ───────────────────────────────────────────────────────────
// DELETE /gallery/bulk
// Body: { ids: number[] }  — up to 200 IDs at once
router.delete("/gallery/bulk", requireGalleryAdmin, async (req, res): Promise<void> => {
  const parsed = BulkDeleteGalleryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { ids } = parsed.data;

  // Fetch all matching records first (for storage cleanup)
  const existing = await db
    .select()
    .from(galleryImagesTable)
    .where(inArray(galleryImagesTable.id, ids));

  if (existing.length === 0) {
    res.status(404).json({ error: "None of the specified images were found" });
    return;
  }

  // Delete DB records in one query
  await db
    .delete(galleryImagesTable)
    .where(inArray(galleryImagesTable.id, ids));

  res.json({ success: true, deleted: existing.length });

  // Broadcast a bulk_deleted event with all affected IDs
  broadcastGalleryUpdate("bulk_deleted", undefined, {
    deletedIds: existing.map(img => img.id),
  });

  // Clean up storage objects in background with limited concurrency
  const log = req.log;
  (async () => {
    const allPaths = existing.flatMap(img =>
      [img.objectPath, img.thumbnailPath].filter(Boolean) as string[]
    );

    const CONCURRENCY = 6;
    let i = 0;

    async function worker() {
      while (i < allPaths.length) {
        const path = allPaths[i++];
        if (!path) continue;
        try {
          await objectStorageService.deleteObjectEntity(path);
        } catch (err) {
          log.warn({ err, path }, "Could not delete storage object during bulk gallery removal");
        }
      }
    }

    await Promise.allSettled(
      Array.from({ length: Math.min(CONCURRENCY, allPaths.length) }, worker),
    );

    log.info({ count: existing.length, paths: allPaths.length }, "Bulk gallery delete storage cleanup complete");
  })();
});

export default router;
