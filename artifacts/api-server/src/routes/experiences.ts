/**
 * experiences.ts — "Share Your Experience" portal routes
 *
 * Public:
 *   POST /api/experiences/upload/photo          — upload profile photo
 *   POST /api/experiences/upload/init           — init chunked video session
 *   POST /api/experiences/upload/chunk          — upload one chunk
 *   POST /api/experiences/upload/finalize       — assemble + store video
 *   POST /api/experiences                       — submit experience record
 *   GET  /api/experiences                       — list approved (public) or all (admin)
 *
 * Admin (requireAdminRole):
 *   GET  /api/experiences/export.csv            — CSV export
 *   GET  /api/experiences/:id                   — get single submission
 *   PATCH /api/experiences/:id                  — update status/featured/notes
 *   DELETE /api/experiences/:id                 — delete submission
 */

import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { requireAdminRole } from "../lib/adminAuth.js";
import { detectAnomaly } from "../lib/local-moderation.js";
import { ObjectStorageService } from "../lib/objectStorage.js";
import { sendWithRetry, isEmailConfigured } from "../lib/email-engine.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

// ── Allowed MIME types ────────────────────────────────────────────────────────
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg", "image/jpg", "image/png", "image/webp",
  "image/gif", "image/avif", "image/heic", "image/heif",
]);
const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4", "video/quicktime", "video/avi", "video/webm",
  "video/x-msvideo", "video/x-matroska", "video/mov",
]);

const MAX_PHOTO_BYTES = 20 * 1024 * 1024;       // 20 MB
const MAX_VIDEO_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB
const MAX_CHUNK_BYTES = 10 * 1024 * 1024;        // 10 MB per chunk

// ── In-memory upload session registry ────────────────────────────────────────
interface UploadSession {
  sessionId: string;
  totalChunks: number;
  receivedChunks: Set<number>;
  tempDir: string;
  contentType: string;
  filename: string;
  declaredSize: number;
  createdAt: number;
}

const uploadSessions = new Map<string, UploadSession>();

// Clean up stale sessions every 30 min
const STALE_SESSION_MS = 2 * 60 * 60 * 1000; // 2 hours
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of uploadSessions) {
    if (now - session.createdAt > STALE_SESSION_MS) {
      fsSync.rm(session.tempDir, { recursive: true, force: true }, () => {});
      uploadSessions.delete(id);
    }
  }
}, 30 * 60 * 1000).unref();

// ── Helpers ───────────────────────────────────────────────────────────────────
function safeInt(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : 0;
}

async function readBodyBuffer(req: Request, maxBytes: number): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > maxBytes) { resolve(null); req.destroy(); }
      else chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", () => resolve(null));
    req.on("close", () => { if (chunks.length === 0) resolve(null); });
  });
}

async function sendAdminNotification(submission: {
  id: number; fullName: string; email: string; location: string;
}) {
  if (!isEmailConfigured()) return;
  const smtpFrom = process.env.SMTP_FROM ?? "JCTM <info@jctm.org.ng>";
  const adminEmail = process.env.SMTP_USER ?? process.env.SMTP_FROM ?? "info@jctm.org.ng";

  await sendWithRetry({
    from: smtpFrom,
    to: adminEmail,
    subject: `New Experience Submission — ${submission.fullName}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#1a0828;color:#e9d5ff;padding:32px;border-radius:16px;">
        <h1 style="color:#a855f7;margin:0 0 8px;">New Experience Submission</h1>
        <p style="color:#c4b5fd;margin:0 0 24px;">A new experience has been submitted and is pending your review.</p>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px 0;color:#a78bfa;font-weight:600;width:120px;">Name</td><td style="padding:8px 0;">${submission.fullName}</td></tr>
          <tr><td style="padding:8px 0;color:#a78bfa;font-weight:600;">Email</td><td style="padding:8px 0;">${submission.email}</td></tr>
          <tr><td style="padding:8px 0;color:#a78bfa;font-weight:600;">Location</td><td style="padding:8px 0;">${submission.location}</td></tr>
          <tr><td style="padding:8px 0;color:#a78bfa;font-weight:600;">Status</td><td style="padding:8px 0;color:#f59e0b;">Pending Review</td></tr>
        </table>
        <div style="margin-top:24px;padding:16px;background:#2d1b69;border-radius:8px;border-left:3px solid #a855f7;">
          <p style="margin:0;font-size:14px;">Log in to the admin panel to review, approve, or reject this submission.</p>
        </div>
      </div>
    `,
  }, logger, "experience-notification");
}

// ─────────────────────────────────────────────────────────────────────────────
// PHOTO UPLOAD  POST /api/experiences/upload/photo
// ─────────────────────────────────────────────────────────────────────────────
router.post("/experiences/upload/photo", async (req: Request, res: Response): Promise<void> => {
  const ip = String(req.ip ?? req.socket?.remoteAddress ?? "unknown");
  const anomaly = detectAnomaly(ip, "photo-upload");
  if (anomaly.riskLevel === "high") {
    res.status(429).json({ error: "Too many requests. Please wait before uploading again." });
    return;
  }

  const rawContentType = (req.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.has(rawContentType)) {
    res.status(400).json({ error: "Only image files are accepted (JPEG, PNG, WebP, GIF)." });
    return;
  }

  const buffer = await readBodyBuffer(req, MAX_PHOTO_BYTES);
  if (!buffer) {
    res.status(413).json({ error: "Photo exceeds the 20 MB limit. Please resize it before uploading." });
    return;
  }
  if (buffer.length === 0) {
    res.status(400).json({ error: "No image data received." });
    return;
  }

  try {
    const objectPath = await objectStorageService.uploadBuffer(buffer, rawContentType);
    res.json({ objectPath });
  } catch (err) {
    logger.error({ err }, "Photo upload failed");
    res.status(500).json({ error: "Failed to store photo. Please try again." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// INIT CHUNKED VIDEO UPLOAD  POST /api/experiences/upload/init
// ─────────────────────────────────────────────────────────────────────────────
router.post("/experiences/upload/init", async (req: Request, res: Response): Promise<void> => {
  const ip = String(req.ip ?? req.socket?.remoteAddress ?? "unknown");
  const anomaly = detectAnomaly(ip, "video-upload-init");
  if (anomaly.riskLevel === "high") {
    res.status(429).json({ error: "Too many requests." });
    return;
  }

  const { contentType, filename, totalChunks, totalSize } = req.body as {
    contentType?: string; filename?: string; totalChunks?: number; totalSize?: number;
  };

  const mimeType = (contentType ?? "").toLowerCase().split(";")[0].trim();
  if (!ALLOWED_VIDEO_TYPES.has(mimeType)) {
    res.status(400).json({ error: "Only MP4, MOV, AVI, WebM, and MKV video files are accepted." });
    return;
  }

  const size = safeInt(totalSize);
  if (size > MAX_VIDEO_BYTES) {
    res.status(400).json({ error: "Video exceeds the 5 GB limit." });
    return;
  }

  const chunks = safeInt(totalChunks);
  if (chunks < 1 || chunks > 5000) {
    res.status(400).json({ error: "Invalid chunk count (must be 1–5000)." });
    return;
  }

  const sessionId = randomUUID();
  const tempDir = path.join(os.tmpdir(), "experience-uploads", sessionId);
  await fs.mkdir(tempDir, { recursive: true });

  uploadSessions.set(sessionId, {
    sessionId,
    totalChunks: chunks,
    receivedChunks: new Set(),
    tempDir,
    contentType: mimeType,
    filename: (filename ?? "video").replace(/[^a-zA-Z0-9._\-]/g, "_").slice(0, 100),
    declaredSize: size,
    createdAt: Date.now(),
  });

  res.json({ sessionId, chunkSize: MAX_CHUNK_BYTES });
});

// ─────────────────────────────────────────────────────────────────────────────
// UPLOAD CHUNK  POST /api/experiences/upload/chunk
// ─────────────────────────────────────────────────────────────────────────────
router.post("/experiences/upload/chunk", async (req: Request, res: Response): Promise<void> => {
  const sessionId = String(req.headers["x-session-id"] ?? "");
  const chunkIndex = safeInt(req.headers["x-chunk-index"]);

  const session = uploadSessions.get(sessionId);
  if (!session) {
    res.status(404).json({ error: "Upload session not found or expired. Please start a new upload." });
    return;
  }

  if (session.receivedChunks.has(chunkIndex)) {
    // Already received — idempotent, just confirm
    res.json({ received: chunkIndex, total: session.totalChunks, progress: session.receivedChunks.size });
    return;
  }

  const buffer = await readBodyBuffer(req, MAX_CHUNK_BYTES);
  if (!buffer || buffer.length === 0) {
    res.status(400).json({ error: "Empty or oversized chunk received." });
    return;
  }

  try {
    const chunkPath = path.join(session.tempDir, `chunk_${String(chunkIndex).padStart(5, "0")}`);
    await fs.writeFile(chunkPath, buffer);
    session.receivedChunks.add(chunkIndex);

    res.json({
      received: chunkIndex,
      total: session.totalChunks,
      progress: session.receivedChunks.size,
    });
  } catch (err) {
    logger.error({ err, sessionId, chunkIndex }, "Failed to write chunk");
    res.status(500).json({ error: "Failed to store chunk. Please retry this chunk." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// FINALIZE UPLOAD  POST /api/experiences/upload/finalize
// ─────────────────────────────────────────────────────────────────────────────
router.post("/experiences/upload/finalize", async (req: Request, res: Response): Promise<void> => {
  const { sessionId } = req.body as { sessionId?: string };

  const session = uploadSessions.get(sessionId ?? "");
  if (!session) {
    res.status(404).json({ error: "Upload session not found or expired." });
    return;
  }

  // Verify all chunks received
  for (let i = 0; i < session.totalChunks; i++) {
    if (!session.receivedChunks.has(i)) {
      res.status(400).json({ error: `Missing chunk ${i}. Please retry the upload.`, missingChunk: i });
      return;
    }
  }

  try {
    // Assemble all chunks into a single temp file
    const assembledPath = path.join(session.tempDir, "assembled");
    const writeStream = fsSync.createWriteStream(assembledPath);

    await new Promise<void>((resolve, reject) => {
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);

      (async () => {
        try {
          for (let i = 0; i < session.totalChunks; i++) {
            const chunkPath = path.join(session.tempDir, `chunk_${String(i).padStart(5, "0")}`);
            const chunkData = await fs.readFile(chunkPath);
            const canContinue = writeStream.write(chunkData);
            if (!canContinue) {
              await new Promise<void>((r) => writeStream.once("drain", r));
            }
          }
          writeStream.end();
        } catch (e) {
          reject(e);
        }
      })();
    });

    // Read assembled file and upload to object storage
    const assembledBuffer = await fs.readFile(assembledPath);
    const objectPath = await objectStorageService.uploadBuffer(assembledBuffer, session.contentType);

    // Clean up temp dir
    fs.rm(session.tempDir, { recursive: true, force: true }).catch(() => {});
    uploadSessions.delete(session.sessionId);

    res.json({ objectPath, filename: session.filename, contentType: session.contentType });
  } catch (err) {
    logger.error({ err, sessionId }, "Failed to finalize upload");
    res.status(500).json({ error: "Failed to finalize video upload. Please try again." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SUBMIT EXPERIENCE  POST /api/experiences
// ─────────────────────────────────────────────────────────────────────────────
router.post("/experiences", async (req: Request, res: Response): Promise<void> => {
  const ip = String(req.ip ?? req.socket?.remoteAddress ?? "unknown");
  const anomaly = detectAnomaly(ip, (req.body?.fullName ?? "") + " " + (req.body?.email ?? ""));
  if (anomaly.riskLevel === "high") {
    res.status(429).json({ error: "Too many submissions. Please wait before submitting again." });
    return;
  }

  const { fullName, email, location, photoPath, videoPath, videoFilename, consent } = req.body as {
    fullName?: string; email?: string; location?: string;
    photoPath?: string; videoPath?: string; videoFilename?: string; consent?: boolean;
  };

  // Validation
  const errors: string[] = [];
  if (!fullName || fullName.trim().length < 2) errors.push("Full name is required.");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("A valid email address is required.");
  if (!location || location.trim().length < 2) errors.push("Location is required.");
  if (!videoPath) errors.push("A video experience is required.");
  if (!consent) errors.push("You must agree to the consent terms.");

  // Honeypot anti-spam check
  if ((req.body as Record<string, unknown>).website) {
    res.status(200).json({ success: true }); // silently discard spam bots
    return;
  }

  if (errors.length > 0) {
    res.status(400).json({ error: errors[0], errors });
    return;
  }

  try {
    const result = await pool.query<{ id: number }>(
      `INSERT INTO experience_submissions
         (full_name, email, location, photo_path, video_path, video_filename, ip_address, consent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        fullName!.trim(), email!.trim().toLowerCase(), location!.trim(),
        photoPath ?? null, videoPath ?? null, videoFilename ?? null,
        ip, Boolean(consent),
      ],
    );

    const id = result.rows[0].id;

    // Send admin notification (non-blocking)
    sendAdminNotification({ id, fullName: fullName!.trim(), email: email!.trim(), location: location!.trim() })
      .catch((err) => logger.warn({ err }, "Experience notification email failed"));

    res.status(201).json({ success: true, id, message: "Thank you! Your experience has been received and is pending review." });
  } catch (err) {
    logger.error({ err }, "Failed to save experience submission");
    res.status(500).json({ error: "Failed to save your submission. Please try again." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// LIST EXPERIENCES  GET /api/experiences
// ─────────────────────────────────────────────────────────────────────────────
router.get("/experiences", async (req: Request, res: Response): Promise<void> => {
  const limit = Math.min(safeInt(req.query.limit) || 20, 100);
  const offset = safeInt(req.query.offset);
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const status = typeof req.query.status === "string" ? req.query.status.trim() : "";

  // Admin mode: requires admin token via ?all=true header pattern from testimonies
  const rawAll = req.query.all === "true";
  const { verifyAdminToken, getAdminTokenFromRequest } = await import("../lib/adminAuth.js");
  const isAdmin = rawAll && verifyAdminToken(getAdminTokenFromRequest(req)) !== null;

  try {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let p = 1;

    if (!isAdmin) {
      conditions.push(`e.status = 'approved'`);
    } else {
      if (status && ["pending", "approved", "rejected"].includes(status)) {
        conditions.push(`e.status = $${p++}`);
        params.push(status);
      }
      if (search) {
        conditions.push(`(e.full_name ILIKE $${p} OR e.email ILIKE $${p} OR e.location ILIKE $${p})`);
        params.push(`%${search}%`);
        p++;
      }
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const countResult = await pool.query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM experience_submissions e ${where}`,
      params,
    );
    const total = safeInt(countResult.rows[0]?.total ?? 0);

    const rows = await pool.query(
      `SELECT e.id, e.full_name, e.email, e.location, e.photo_path,
              e.video_path, e.video_filename, e.status, e.is_featured,
              e.admin_notes, e.created_at, e.updated_at
       FROM experience_submissions e
       ${where}
       ORDER BY e.created_at DESC
       LIMIT $${p} OFFSET $${p + 1}`,
      [...params, limit, offset],
    );

    const submissions = rows.rows.map((r) => ({
      ...r,
      createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
      updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : r.updated_at,
    }));

    if (!isAdmin) {
      res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
    }

    res.json({ submissions, total, limit, offset });
  } catch (err) {
    logger.error({ err }, "Failed to list experiences");
    res.status(500).json({ error: "Failed to load experiences." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT CSV  GET /api/experiences/export.csv  (admin)
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  "/experiences/export.csv",
  requireAdminRole(["gallery", "sermon", "livestream"]),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const rows = await pool.query(
        `SELECT id, full_name, email, location, video_filename, status,
                is_featured, admin_notes, created_at
         FROM experience_submissions
         ORDER BY created_at DESC`,
      );

      const headers = ["ID", "Full Name", "Email", "Location", "Video Filename", "Status", "Featured", "Admin Notes", "Submitted At"];
      const csv = [
        headers.join(","),
        ...rows.rows.map((r) =>
          [
            r.id,
            `"${String(r.full_name).replace(/"/g, '""')}"`,
            `"${String(r.email).replace(/"/g, '""')}"`,
            `"${String(r.location).replace(/"/g, '""')}"`,
            `"${String(r.video_filename ?? "").replace(/"/g, '""')}"`,
            r.status,
            r.is_featured ? "Yes" : "No",
            `"${String(r.admin_notes ?? "").replace(/"/g, '""')}"`,
            r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
          ].join(","),
        ),
      ].join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="experience-submissions-${new Date().toISOString().slice(0, 10)}.csv"`);
      res.send(csv);
    } catch (err) {
      logger.error({ err }, "Failed to export experiences");
      res.status(500).json({ error: "Export failed." });
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// GET SINGLE  GET /api/experiences/:id  (admin)
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  "/experiences/:id",
  requireAdminRole(["gallery", "sermon", "livestream"]),
  async (req: Request, res: Response): Promise<void> => {
    const id = safeInt(req.params.id);
    if (!id) { res.status(400).json({ error: "Invalid ID." }); return; }

    try {
      const result = await pool.query(
        `SELECT * FROM experience_submissions WHERE id = $1`,
        [id],
      );
      if (!result.rows[0]) { res.status(404).json({ error: "Submission not found." }); return; }
      const r = result.rows[0];
      res.json({
        ...r,
        createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
        updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : r.updated_at,
      });
    } catch (err) {
      logger.error({ err }, "Failed to get experience");
      res.status(500).json({ error: "Failed to load submission." });
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE  PATCH /api/experiences/:id  (admin)
// ─────────────────────────────────────────────────────────────────────────────
router.patch(
  "/experiences/:id",
  requireAdminRole(["gallery", "sermon", "livestream"]),
  async (req: Request, res: Response): Promise<void> => {
    const id = safeInt(req.params.id);
    if (!id) { res.status(400).json({ error: "Invalid ID." }); return; }

    const { status, isFeatured, adminNotes } = req.body as {
      status?: string; isFeatured?: boolean; adminNotes?: string;
    };

    const updates: string[] = [];
    const params: unknown[] = [];
    let p = 1;

    if (status !== undefined) {
      if (!["pending", "approved", "rejected"].includes(status)) {
        res.status(400).json({ error: "Invalid status. Must be pending, approved, or rejected." });
        return;
      }
      updates.push(`status = $${p++}`);
      params.push(status);
    }
    if (isFeatured !== undefined) {
      updates.push(`is_featured = $${p++}`);
      params.push(Boolean(isFeatured));
    }
    if (adminNotes !== undefined) {
      updates.push(`admin_notes = $${p++}`);
      params.push(adminNotes);
    }

    if (updates.length === 0) {
      res.status(400).json({ error: "No fields to update." });
      return;
    }

    updates.push(`updated_at = now()`);
    params.push(id);

    try {
      const result = await pool.query(
        `UPDATE experience_submissions SET ${updates.join(", ")} WHERE id = $${p} RETURNING id, status, is_featured`,
        params,
      );
      if (!result.rows[0]) { res.status(404).json({ error: "Submission not found." }); return; }
      res.json({ success: true, ...result.rows[0] });
    } catch (err) {
      logger.error({ err }, "Failed to update experience");
      res.status(500).json({ error: "Failed to update submission." });
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// DELETE  DELETE /api/experiences/:id  (admin)
// ─────────────────────────────────────────────────────────────────────────────
router.delete(
  "/experiences/:id",
  requireAdminRole(["gallery", "sermon", "livestream"]),
  async (req: Request, res: Response): Promise<void> => {
    const id = safeInt(req.params.id);
    if (!id) { res.status(400).json({ error: "Invalid ID." }); return; }

    try {
      // Fetch paths for storage cleanup
      const existing = await pool.query(
        `SELECT photo_path, video_path FROM experience_submissions WHERE id = $1`,
        [id],
      );
      const row = existing.rows[0];

      const result = await pool.query(
        `DELETE FROM experience_submissions WHERE id = $1 RETURNING id`,
        [id],
      );
      if (!result.rows[0]) { res.status(404).json({ error: "Submission not found." }); return; }

      // Clean up stored files
      if (row?.photo_path) {
        objectStorageService.deleteObjectEntity(row.photo_path).catch(() => {});
      }
      if (row?.video_path) {
        objectStorageService.deleteObjectEntity(row.video_path).catch(() => {});
      }

      res.json({ success: true, id });
    } catch (err) {
      logger.error({ err }, "Failed to delete experience");
      res.status(500).json({ error: "Failed to delete submission." });
    }
  },
);

export default router;
