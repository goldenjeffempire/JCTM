/**
 * subscribers.ts — Admin endpoints for the centralized subscriber management system.
 *
 * All routes require admin authentication.
 *
 * GET  /api/admin/subscribers/stats        — aggregate counts, by-source breakdown, delivery health
 * GET  /api/admin/subscribers              — paginated subscriber list
 * GET  /api/admin/subscribers/log          — delivery log (recent)
 * POST /api/admin/subscribers/seed-file    — (re)seed from root `emails` file
 * POST /api/admin/subscribers/sync-legacy  — sync from devotion/event/member tables
 * POST /api/admin/subscribers/bootstrap    — full seed + sync in one shot
 * POST /api/admin/subscribers/:id/activate — re-activate a deactivated subscriber
 * POST /api/admin/subscribers/:id/deactivate — deactivate a subscriber
 * DELETE /api/admin/subscribers/:id        — hard-delete a subscriber record
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { requireAdminRole } from "../lib/adminAuth.js";
import { logger } from "../lib/logger.js";
import { pool } from "@workspace/db";
import {
  getSubscriberStats,
  seedFromEmailsFile,
  syncFromLegacyTables,
  bootstrapSubscribers,
  deactivateSubscriber,
  upsertSubscriber,
} from "../lib/subscriber-manager.js";

const router: IRouter = Router();
const auth = requireAdminRole("livestream");

// ─── Stats ────────────────────────────────────────────────────────────────────

router.get("/admin/subscribers/stats", auth, async (_req: Request, res: Response): Promise<void> => {
  try {
    const stats = await getSubscriberStats(logger);
    res.json({ ok: true, stats });
  } catch (err) {
    logger.error({ err }, "GET /admin/subscribers/stats failed");
    res.status(500).json({ error: "Failed to load subscriber stats." });
  }
});

// ─── List ─────────────────────────────────────────────────────────────────────

router.get("/admin/subscribers", auth, async (req: Request, res: Response): Promise<void> => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const activeOnly = req.query.activeOnly !== "false";
  const search = typeof req.query.search === "string" ? req.query.search.trim() : null;

  try {
    let query = `
      SELECT id, email, name, is_active, source, subscribed_at, unsubscribed_at,
             last_sent_at, last_email_type, total_sent, total_failed
      FROM subscribers
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (activeOnly) {
      query += ` AND is_active = true`;
    }
    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      query += ` AND (lower(email) LIKE $${params.length} OR lower(name) LIKE $${params.length})`;
    }

    const countParams: unknown[] = [];
    let countQuery = `SELECT count(*)::text AS n FROM subscribers WHERE 1=1`;
    if (activeOnly) {
      countQuery += ` AND is_active = true`;
    }
    if (search) {
      countParams.push(`%${search.toLowerCase()}%`);
      countQuery += ` AND (lower(email) LIKE $${countParams.length} OR lower(name) LIKE $${countParams.length})`;
    }
    const countResult = await pool.query<{ n: string }>(countQuery, countParams);

    query += ` ORDER BY subscribed_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    res.json({
      ok: true,
      total: parseInt(countResult.rows[0]?.n ?? "0", 10),
      limit,
      offset,
      subscribers: result.rows.map((r) => ({
        id: r.id,
        email: r.email,
        name: r.name ?? null,
        isActive: r.is_active,
        source: r.source,
        subscribedAt: r.subscribed_at,
        unsubscribedAt: r.unsubscribed_at ?? null,
        lastSentAt: r.last_sent_at ?? null,
        lastEmailType: r.last_email_type ?? null,
        totalSent: Number(r.total_sent ?? 0),
        totalFailed: Number(r.total_failed ?? 0),
      })),
    });
  } catch (err) {
    logger.error({ err }, "GET /admin/subscribers failed");
    res.status(500).json({ error: "Failed to load subscribers." });
  }
});

// ─── Delivery log ─────────────────────────────────────────────────────────────

router.get("/admin/subscribers/log", auth, async (req: Request, res: Response): Promise<void> => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
  const emailType = typeof req.query.emailType === "string" ? req.query.emailType : null;
  const status = typeof req.query.status === "string" ? req.query.status : null;

  try {
    let query = `
      SELECT dl.id, dl.subscriber_id, dl.email, dl.email_type, dl.campaign_key,
             dl.status, dl.message_id, dl.error, dl.attempts, dl.sent_at,
             s.name
      FROM email_delivery_log dl
      LEFT JOIN subscribers s ON s.id = dl.subscriber_id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (emailType) {
      params.push(emailType);
      query += ` AND dl.email_type = $${params.length}`;
    }
    if (status) {
      params.push(status);
      query += ` AND dl.status = $${params.length}`;
    }

    query += ` ORDER BY dl.sent_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await pool.query(query, params);
    res.json({
      ok: true,
      rows: result.rows.map((r) => ({
        id: r.id,
        subscriberId: r.subscriber_id,
        email: r.email,
        name: r.name ?? null,
        emailType: r.email_type,
        campaignKey: r.campaign_key ?? null,
        status: r.status,
        messageId: r.message_id ?? null,
        error: r.error ?? null,
        attempts: r.attempts,
        sentAt: r.sent_at,
      })),
    });
  } catch (err) {
    logger.error({ err }, "GET /admin/subscribers/log failed");
    res.status(500).json({ error: "Failed to load delivery log." });
  }
});

// ─── Seed from emails file ────────────────────────────────────────────────────

router.post("/admin/subscribers/seed-file", auth, async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await seedFromEmailsFile(logger);
    res.json({ ok: true, result });
  } catch (err) {
    logger.error({ err }, "POST /admin/subscribers/seed-file failed");
    res.status(500).json({ error: "Seed from emails file failed." });
  }
});

// ─── Sync from legacy tables ──────────────────────────────────────────────────

router.post("/admin/subscribers/sync-legacy", auth, async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await syncFromLegacyTables(logger);
    res.json({ ok: true, result });
  } catch (err) {
    logger.error({ err }, "POST /admin/subscribers/sync-legacy failed");
    res.status(500).json({ error: "Legacy sync failed." });
  }
});

// ─── Full bootstrap (seed + sync) ────────────────────────────────────────────

router.post("/admin/subscribers/bootstrap", auth, async (_req: Request, res: Response): Promise<void> => {
  try {
    // Reset the bootstrapped flag so it runs again
    (await import("../lib/subscriber-manager.js")).bootstrapSubscribers(logger);
    const stats = await getSubscriberStats(logger);
    res.json({ ok: true, stats, message: "Bootstrap triggered — seed + legacy sync running in background." });
  } catch (err) {
    logger.error({ err }, "POST /admin/subscribers/bootstrap failed");
    res.status(500).json({ error: "Bootstrap failed." });
  }
});

// ─── Activate a subscriber ────────────────────────────────────────────────────

router.post("/admin/subscribers/:id/activate", auth, async (req: Request, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "Invalid subscriber id." });
    return;
  }
  try {
    const result = await pool.query(
      `UPDATE subscribers
         SET is_active = true, unsubscribed_at = NULL, updated_at = now()
       WHERE id = $1
       RETURNING email`,
      [id],
    );
    if (!result.rows[0]) {
      res.status(404).json({ error: "Subscriber not found." });
      return;
    }
    res.json({ ok: true, email: result.rows[0].email });
  } catch (err) {
    logger.error({ err, id }, "POST /admin/subscribers/:id/activate failed");
    res.status(500).json({ error: "Activation failed." });
  }
});

// ─── Deactivate a subscriber ──────────────────────────────────────────────────

router.post("/admin/subscribers/:id/deactivate", auth, async (req: Request, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "Invalid subscriber id." });
    return;
  }
  try {
    const lookup = await pool.query<{ email: string }>(
      `SELECT email FROM subscribers WHERE id = $1 LIMIT 1`,
      [id],
    );
    if (!lookup.rows[0]) {
      res.status(404).json({ error: "Subscriber not found." });
      return;
    }
    await deactivateSubscriber(lookup.rows[0].email, "admin_deactivation", logger);
    res.json({ ok: true, email: lookup.rows[0].email });
  } catch (err) {
    logger.error({ err, id }, "POST /admin/subscribers/:id/deactivate failed");
    res.status(500).json({ error: "Deactivation failed." });
  }
});

// ─── Hard-delete (admin only, irreversible) ───────────────────────────────────

router.delete("/admin/subscribers/:id", auth, async (req: Request, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "Invalid subscriber id." });
    return;
  }
  try {
    const result = await pool.query(
      `DELETE FROM subscribers WHERE id = $1 RETURNING email`,
      [id],
    );
    if (!result.rows[0]) {
      res.status(404).json({ error: "Subscriber not found." });
      return;
    }
    logger.warn({ id, email: result.rows[0].email }, "Subscriber hard-deleted by admin");
    res.json({ ok: true, deleted: result.rows[0].email });
  } catch (err) {
    logger.error({ err, id }, "DELETE /admin/subscribers/:id failed");
    res.status(500).json({ error: "Delete failed." });
  }
});

export default router;
