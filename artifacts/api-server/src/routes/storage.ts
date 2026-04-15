import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import { ObjectStorageService, ObjectNotFoundError, detectImageMimeType } from "../lib/objectStorage";
import { ObjectPermission } from "../lib/objectAcl";
import { requireGalleryAdmin } from "../lib/adminAuth.js";

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg", "image/jpg", "image/png", "image/webp",
  "image/gif", "image/avif", "image/heic", "image/heif",
]);

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload.
 * The client sends JSON metadata (name, size, contentType) — NOT the file.
 * Then uploads the file directly to the returned presigned URL.
 */
router.post("/storage/uploads/request-url", requireGalleryAdmin, async (req: Request, res: Response) => {
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }

  try {
    const { name, size, contentType } = parsed.data;

    if (!contentType.startsWith("image/")) {
      res.status(400).json({ error: "Only image uploads are allowed" });
      return;
    }

    if (size > 20 * 1024 * 1024) {
      res.status(400).json({ error: "Image must be 20MB or smaller" });
      return;
    }

    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

    res.json(
      RequestUploadUrlResponse.parse({
        uploadURL,
        objectPath,
        metadata: { name, size, contentType },
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Error generating upload URL");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

/**
 * POST /storage/uploads
 *
 * Server-proxied file upload. The browser sends the raw image bytes to this
 * endpoint (Content-Type: image/*) and the server stores it in GCS.
 * This avoids CORS issues that arise when the browser tries to PUT directly
 * to a GCS presigned URL from a different origin.
 */
router.post("/storage/uploads", requireGalleryAdmin, async (req: Request, res: Response) => {
  const rawContentType = (req.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();

  if (!ALLOWED_IMAGE_TYPES.has(rawContentType)) {
    res.status(400).json({ error: "Only image uploads are allowed (jpeg, png, webp, gif, avif)" });
    return;
  }

  const MAX_BYTES = 20 * 1024 * 1024;
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  let oversized = false;

  try {
    await new Promise<void>((resolve, reject) => {
      req.on("data", (chunk: Buffer) => {
        if (oversized) return;
        totalBytes += chunk.length;
        if (totalBytes > MAX_BYTES) {
          oversized = true;
          reject(new Error("IMAGE_TOO_LARGE"));
          return;
        }
        chunks.push(chunk);
      });
      req.on("end", resolve);
      req.on("error", reject);
      req.on("close", () => {
        if (oversized) return;
        resolve();
      });
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Upload stream error";
    if (msg === "IMAGE_TOO_LARGE") {
      res.status(413).json({ error: "Image must be 20 MB or smaller" });
    } else {
      res.status(400).json({ error: "Upload stream interrupted" });
    }
    return;
  }

  if (totalBytes === 0) {
    res.status(400).json({ error: "No file data received" });
    return;
  }

  const buffer = Buffer.concat(chunks);

  // Validate actual file contents via magic bytes to prevent content-type spoofing
  const detectedType = detectImageMimeType(buffer);
  if (!detectedType) {
    res.status(400).json({ error: "File does not appear to be a valid image" });
    return;
  }

  try {
    // Use the detected MIME type (from magic bytes) rather than the client-supplied header
    const objectPath = await objectStorageService.uploadBuffer(buffer, detectedType);
    res.json({ objectPath });
  } catch (error) {
    req.log.error({ err: error }, "Error uploading file to storage");
    res.status(500).json({ error: "Failed to upload file to storage" });
  }
});

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * These are unconditionally public — no authentication or ACL checks.
 * IMPORTANT: Always provide this endpoint when object storage is set up.
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const response = await objectStorageService.downloadObject(file);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    req.log.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

/**
 * GET /storage/objects/*
 *
 * Serve object entities from PRIVATE_OBJECT_DIR.
 * These are served from a separate path from /public-objects and can optionally
 * be protected with authentication or ACL checks based on the use case.
 */
router.get("/storage/objects/*path", async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);

    // --- Protected route example (uncomment when using replit-auth) ---
    // if (!req.isAuthenticated()) {
    //   res.status(401).json({ error: "Unauthorized" });
    //   return;
    // }
    // const canAccess = await objectStorageService.canAccessObjectEntity({
    //   userId: req.user.id,
    //   objectFile,
    //   requestedPermission: ObjectPermission.READ,
    // });
    // if (!canAccess) {
    //   res.status(403).json({ error: "Forbidden" });
    //   return;
    // }

    const response = await objectStorageService.downloadObject(objectFile);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, "Object not found");
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
