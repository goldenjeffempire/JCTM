/**
 * emailAnalytics.ts
 *
 * Admin-gated email analytics and monitoring endpoints.
 *
 * GET  /api/admin/email/analytics      — Overview: SMTP status, campaign stats, send log summary
 * GET  /api/admin/email/campaigns      — All conference campaign records with recipient counts
 * GET  /api/admin/email/send-log       — Paginated raw send log (last 500 entries)
 * GET  /api/admin/email/unsubscribes   — Global opt-out list (paginated, searchable)
 * POST /api/admin/email/unsubscribe    — Manually add an address to the global opt-out list
 * DELETE /api/admin/email/unsubscribe  — Remove an address from the global opt-out list (re-subscribe)
 */

import { Router, type Request, type Response } from "express";
import { requireAdminRole } from "../lib/adminAuth.js";
import { pool } from "@workspace/db";
import { isEmailConfigured } from "../lib/email-engine.js";
import { addGlobalUnsubscribe } from "../lib/email-automation.js";
import { logger } from "../lib/logger.js";

const router = Router();
const auth = requireAdminRole("super");

// ─── GET /api/admin/email/analytics ──────────────────────────────────────────

router.get(
  "/admin/email/analytics",
  auth,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const [
        campaignStats,
        sendLogSummary,
        unsubCount,
        recentCampaigns,
      ] = await Promise.allSettled([
        // Aggregate campaign-level stats
        pool.query<{
          status: string;
          count: string;
          total_sent: string;
          total_failed: string;
          total_recipients: string;
        }>(`
          SELECT
            status,
            count(*)::text            AS count,
            sum(sent)::text           AS total_sent,
            sum(failed)::text         AS total_failed,
            sum(total_recipients)::text AS total_recipients
          FROM conference_campaigns
          GROUP BY status
        `),

        // Send log summary by email_type over last 7 days
        pool.query<{
          email_type: string;
          sent_count: string;
          failed_count: string;
          last_sent: string | null;
        }>(`
          SELECT
            email_type,
            count(*) FILTER (WHERE status = 'sent')   ::text AS sent_count,
            count(*) FILTER (WHERE status = 'failed') ::text AS failed_count,
            max(sent_at)::text AS last_sent
          FROM email_send_log
          WHERE sent_at >= now() - interval '7 days'
          GROUP BY email_type
          ORDER BY max(sent_at) DESC
        `),

        // Global unsubscribe count
        pool.query<{ total: string }>(`SELECT count(*)::text AS total FROM email_unsubscribes`),

        // 10 most recent campaigns
        pool.query<{
          id: number;
          campaign_key: string;
          conference_title: string;
          status: string;
          total_recipients: number;
          sent: number;
          failed: number;
          skipped: number;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
          error: string | null;
        }>(`
          SELECT
            id, campaign_key, conference_title, status,
            total_recipients, sent, failed, skipped,
            started_at::text, completed_at::text, created_at::text, error
          FROM conference_campaigns
          ORDER BY created_at DESC
          LIMIT 10
        `),
      ]);

      const smtpOk = isEmailConfigured();

      res.json({
        smtp: {
          configured: smtpOk,
          host: process.env.SMTP_HOST ?? null,
          from: process.env.SMTP_FROM ?? null,
        },
        campaignStats:
          campaignStats.status === "fulfilled"
            ? campaignStats.value.rows
            : [],
        sendLogSummary:
          sendLogSummary.status === "fulfilled"
            ? sendLogSummary.value.rows
            : [],
        globalUnsubscribes:
          unsubCount.status === "fulfilled"
            ? Number(unsubCount.value.rows[0]?.total ?? 0)
            : null,
        recentCampaigns:
          recentCampaigns.status === "fulfilled"
            ? recentCampaigns.value.rows
            : [],
        generatedAt: new Date().toISOString(),
      });
    } catch (err) {
      logger.error({ err }, "Email analytics query failed");
      res.status(500).json({ error: "Failed to fetch email analytics" });
    }
  },
);

// ─── GET /api/admin/email/campaigns ──────────────────────────────────────────

router.get(
  "/admin/email/campaigns",
  auth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const limit = Math.min(Number(req.query.limit) || 50, 200);
      const offset = Math.max(Number(req.query.offset) || 0, 0);

      const result = await pool.query<{
        id: number;
        campaign_key: string;
        conference_title: string;
        status: string;
        total_recipients: number;
        sent: number;
        failed: number;
        skipped: number;
        started_at: string | null;
        completed_at: string | null;
        created_at: string;
        error: string | null;
        duration_seconds: number | null;
      }>(`
        SELECT
          id, campaign_key, conference_title, status,
          total_recipients, sent, failed, skipped,
          started_at::text, completed_at::text, created_at::text, error,
          CASE
            WHEN started_at IS NOT NULL AND completed_at IS NOT NULL
            THEN extract(epoch from (completed_at - started_at))::integer
            ELSE NULL
          END AS duration_seconds
        FROM conference_campaigns
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
      `, [limit, offset]);

      const total = await pool.query<{ count: string }>(
        "SELECT count(*)::text AS count FROM conference_campaigns",
      );

      res.json({
        campaigns: result.rows,
        total: Number(total.rows[0]?.count ?? 0),
        limit,
        offset,
      });
    } catch (err) {
      logger.error({ err }, "Campaigns list query failed");
      res.status(500).json({ error: "Failed to fetch campaigns" });
    }
  },
);

// ─── GET /api/admin/email/send-log ───────────────────────────────────────────

router.get(
  "/admin/email/send-log",
  auth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const limit  = Math.min(Number(req.query.limit) || 100, 500);
      const offset = Math.max(Number(req.query.offset) || 0, 0);
      const type   = typeof req.query.type === "string" ? req.query.type : null;

      const conditions: string[] = [];
      const params: unknown[] = [limit, offset];

      if (type) {
        params.push(type);
        conditions.push(`email_type = $${params.length}`);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      const result = await pool.query<{
        id: number;
        email_type: string;
        recipient_email: string;
        campaign_key: string | null;
        status: string;
        error: string | null;
        sent_at: string;
      }>(`
        SELECT id, email_type, recipient_email, campaign_key, status, error, sent_at::text
        FROM email_send_log
        ${where}
        ORDER BY sent_at DESC
        LIMIT $1 OFFSET $2
      `, params);

      res.json({ entries: result.rows, limit, offset });
    } catch (err) {
      logger.error({ err }, "Send log query failed");
      res.status(500).json({ error: "Failed to fetch send log" });
    }
  },
);

// ─── GET /api/admin/email/unsubscribes ───────────────────────────────────────

router.get(
  "/admin/email/unsubscribes",
  auth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const limit  = Math.min(Number(req.query.limit) || 100, 1000);
      const offset = Math.max(Number(req.query.offset) || 0, 0);
      const search = typeof req.query.search === "string" ? req.query.search.trim() : null;

      const params: unknown[] = [limit, offset];
      let searchClause = "";
      if (search) {
        params.push(`%${search.toLowerCase()}%`);
        searchClause = `WHERE email ILIKE $${params.length}`;
      }

      const [rows, total] = await Promise.all([
        pool.query<{ id: number; email: string; source: string; unsubscribed_at: string }>(`
          SELECT id, email, source, unsubscribed_at::text
          FROM email_unsubscribes
          ${searchClause}
          ORDER BY unsubscribed_at DESC
          LIMIT $1 OFFSET $2
        `, params),
        pool.query<{ count: string }>(
          `SELECT count(*)::text AS count FROM email_unsubscribes ${searchClause}`,
          search ? [params[params.length - 1]] : [],
        ),
      ]);

      res.json({
        unsubscribes: rows.rows,
        total: Number(total.rows[0]?.count ?? 0),
        limit,
        offset,
      });
    } catch (err) {
      logger.error({ err }, "Unsubscribes list query failed");
      res.status(500).json({ error: "Failed to fetch unsubscribes" });
    }
  },
);

// ─── POST /api/admin/email/unsubscribe — manual add ──────────────────────────

router.post(
  "/admin/email/unsubscribe",
  auth,
  async (req: Request, res: Response): Promise<void> => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: "Valid email address required" });
      return;
    }
    try {
      await addGlobalUnsubscribe(email, "admin_manual");
      logger.info({ email }, "Admin manually added email to global opt-out list");
      res.json({ success: true, email: email.toLowerCase() });
    } catch (err) {
      logger.error({ err, email }, "Manual unsubscribe add failed");
      res.status(500).json({ error: "Failed to add unsubscribe" });
    }
  },
);

// ─── DELETE /api/admin/email/unsubscribe — remove (re-subscribe) ─────────────

router.delete(
  "/admin/email/unsubscribe",
  auth,
  async (req: Request, res: Response): Promise<void> => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
    if (!email) {
      res.status(400).json({ error: "Email required" });
      return;
    }
    try {
      const result = await pool.query(
        "DELETE FROM email_unsubscribes WHERE email = $1",
        [email.trim().toLowerCase()],
      );
      const removed = (result.rowCount ?? 0) > 0;
      logger.info({ email, removed }, "Admin removed email from global opt-out list");
      res.json({ success: true, removed, email: email.toLowerCase() });
    } catch (err) {
      logger.error({ err, email }, "Manual unsubscribe remove failed");
      res.status(500).json({ error: "Failed to remove unsubscribe" });
    }
  },
);

export default router;
