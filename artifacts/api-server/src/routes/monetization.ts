/**
 * Monetization Routes — Ad analytics, partner inquiries, and revenue tracking
 *
 * Public (rate-limited):
 *   POST /api/monetization/pageview    — internal ad inventory page-view ping
 *   POST /api/partner/inquiry          — partnership inquiry submission
 *
 * Admin (token-gated):
 *   GET  /api/monetization/analytics   — aggregate revenue & page-view analytics
 *   GET  /api/monetization/partners    — all partner inquiries
 *   PATCH /api/monetization/partners/:id — update inquiry status
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger.js";
import { requireAdminRole } from "../lib/adminAuth.js";

const router: IRouter = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sanitize(str: unknown, max = 200): string {
  if (typeof str !== "string") return "";
  return str.trim().slice(0, max);
}

function safeEmail(str: unknown): string {
  const s = sanitize(str, 254);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : "";
}

// ─── POST /api/monetization/pageview ─────────────────────────────────────────
// Lightweight ping — records which page was visited for internal ad-inventory
// analytics. Does NOT store any PII; visitor_id is a random session UUID.
router.post(
  "/monetization/pageview",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        page = "/",
        referrer = "",
        visitorId = "",
        sessionId = "",
        adSlotsInView = 0,
        consentLevel = "none",
      } = req.body as Record<string, unknown>;

      await pool.query(
        `INSERT INTO ad_page_views
           (page, referrer, visitor_id, session_id, ad_slots_in_view, consent_level, recorded_at)
         VALUES ($1, $2, $3, $4, $5, $6, now())`,
        [
          sanitize(page, 500),
          sanitize(referrer, 500),
          sanitize(visitorId, 64),
          sanitize(sessionId, 64),
          Math.max(0, Math.min(Number(adSlotsInView) || 0, 20)),
          sanitize(consentLevel, 20),
        ]
      );

      res.json({ ok: true });
    } catch (err) {
      logger.warn({ err }, "ad_page_views insert failed");
      res.json({ ok: false });
    }
  }
);

// ─── POST /api/partner/inquiry ────────────────────────────────────────────────
router.post(
  "/partner/inquiry",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        name,
        email,
        organization = "",
        tier,
        message = "",
      } = req.body as Record<string, unknown>;

      const cleanName = sanitize(name, 120);
      const cleanEmail = safeEmail(email);
      const cleanOrg = sanitize(organization, 200);
      const cleanTier = sanitize(tier, 80);
      const cleanMsg = sanitize(message, 2000);

      if (!cleanName || !cleanEmail || !cleanTier) {
        res.status(400).json({ error: "name, email and tier are required" });
        return;
      }

      await pool.query(
        `INSERT INTO sponsorship_inquiries
           (name, email, organization, tier, message, status, created_at)
         VALUES ($1, $2, $3, $4, $5, 'new', now())`,
        [cleanName, cleanEmail, cleanOrg, cleanTier, cleanMsg]
      );

      logger.info({ name: cleanName, tier: cleanTier }, "New partnership inquiry received");
      res.json({ ok: true, message: "Partnership inquiry received" });
    } catch (err) {
      logger.error({ err }, "sponsorship_inquiries insert failed");
      res.status(500).json({ error: "Failed to submit inquiry" });
    }
  }
);

// ─── GET /api/monetization/analytics — Admin ──────────────────────────────────
router.get(
  "/monetization/analytics",
  requireAdminRole(["sermon", "gallery", "livestream"]),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const [
        pageViewsTotal,
        pageViewsByDay,
        pageViewsByPage,
        adSlotsTotal,
        consentBreakdown,
        partnerCounts,
        givingStats,
      ] = await Promise.all([
        pool.query<{ count: string }>(
          `SELECT COUNT(*)::text AS count FROM ad_page_views WHERE recorded_at >= NOW() - INTERVAL '30 days'`
        ),
        pool.query<{ day: string; views: string; ad_slots: string }>(
          `SELECT
             to_char(date_trunc('day', recorded_at), 'DD Mon') AS day,
             COUNT(*)::text AS views,
             COALESCE(SUM(ad_slots_in_view), 0)::text AS ad_slots
           FROM ad_page_views
           WHERE recorded_at >= NOW() - INTERVAL '30 days'
           GROUP BY date_trunc('day', recorded_at)
           ORDER BY date_trunc('day', recorded_at)`
        ),
        pool.query<{ page: string; views: string; avg_slots: string }>(
          `SELECT
             page,
             COUNT(*)::text AS views,
             ROUND(AVG(ad_slots_in_view), 1)::text AS avg_slots
           FROM ad_page_views
           WHERE recorded_at >= NOW() - INTERVAL '30 days'
           GROUP BY page
           ORDER BY COUNT(*) DESC
           LIMIT 15`
        ),
        pool.query<{ total: string }>(
          `SELECT COALESCE(SUM(ad_slots_in_view), 0)::text AS total
           FROM ad_page_views WHERE recorded_at >= NOW() - INTERVAL '30 days'`
        ),
        pool.query<{ level: string; count: string }>(
          `SELECT consent_level AS level, COUNT(*)::text AS count
           FROM ad_page_views
           WHERE recorded_at >= NOW() - INTERVAL '30 days'
           GROUP BY consent_level`
        ),
        pool.query<{ status: string; count: string }>(
          `SELECT status, COUNT(*)::text AS count FROM sponsorship_inquiries GROUP BY status`
        ),
        pool.query<{ total: string; donors: string; ngn: string; usd: string }>(
          `SELECT
             COALESCE(SUM(amount), 0)::text AS total,
             COUNT(*)::text AS donors,
             COALESCE(SUM(CASE WHEN currency = 'NGN' THEN amount ELSE 0 END), 0)::text AS ngn,
             COALESCE(SUM(CASE WHEN currency != 'NGN' THEN amount ELSE 0 END), 0)::text AS usd
           FROM giving_logs WHERE status = 'success' AND created_at >= NOW() - INTERVAL '30 days'`
        ),
      ]);

      const totalPageViews = Number(pageViewsTotal.rows[0]?.count ?? 0);
      const totalAdSlots   = Number(adSlotsTotal.rows[0]?.total ?? 0);
      const estimatedRpm   = totalPageViews > 0 ? (totalAdSlots * 0.4).toFixed(2) : "0.00";

      const partnerStatusMap: Record<string, number> = {};
      for (const row of partnerCounts.rows) {
        partnerStatusMap[row.status] = Number(row.count);
      }

      const consentMap: Record<string, number> = {};
      for (const row of consentBreakdown.rows) {
        consentMap[row.level] = Number(row.count);
      }

      res.json({
        period: "30d",
        pageViews: {
          total: totalPageViews,
          byDay: pageViewsByDay.rows.map(r => ({
            day: r.day,
            views: Number(r.views),
            adSlots: Number(r.ad_slots),
          })),
          byPage: pageViewsByPage.rows.map(r => ({
            page: r.page,
            views: Number(r.views),
            avgSlots: Number(r.avg_slots),
          })),
        },
        adInventory: {
          totalSlotImpressions: totalAdSlots,
          estimatedEcpm: "0.40",
          estimatedRevenue: estimatedRpm,
        },
        consent: consentMap,
        partnerships: {
          new: partnerStatusMap["new"] ?? 0,
          contacted: partnerStatusMap["contacted"] ?? 0,
          active: partnerStatusMap["active"] ?? 0,
          declined: partnerStatusMap["declined"] ?? 0,
          total: Object.values(partnerStatusMap).reduce((a, b) => a + b, 0),
        },
        giving30d: {
          total: Number(givingStats.rows[0]?.total ?? 0),
          donors: Number(givingStats.rows[0]?.donors ?? 0),
          ngn: Number(givingStats.rows[0]?.ngn ?? 0),
          usd: Number(givingStats.rows[0]?.usd ?? 0),
        },
        generatedAt: new Date().toISOString(),
      });
    } catch (err) {
      logger.error({ err }, "monetization analytics failed");
      res.status(500).json({ error: "Failed to load analytics" });
    }
  }
);

// ─── GET /api/monetization/partners — Admin ───────────────────────────────────
router.get(
  "/monetization/partners",
  requireAdminRole(["sermon", "gallery", "livestream"]),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const limit = Math.min(Number((req.query as Record<string, string>).limit) || 50, 200);
      const status = sanitize((req.query as Record<string, string>).status, 20);

      const result = await pool.query<{
        id: number;
        name: string;
        email: string;
        organization: string;
        tier: string;
        message: string;
        status: string;
        created_at: string;
      }>(
        `SELECT id, name, email, organization, tier, message, status, created_at
         FROM sponsorship_inquiries
         ${status ? "WHERE status = $2" : ""}
         ORDER BY created_at DESC
         LIMIT $1`,
        status ? [limit, status] : [limit]
      );

      res.json({ inquiries: result.rows });
    } catch (err) {
      logger.error({ err }, "partner inquiries fetch failed");
      res.status(500).json({ error: "Failed to fetch partner inquiries" });
    }
  }
);

// ─── PATCH /api/monetization/partners/:id — Admin ─────────────────────────────
router.patch(
  "/monetization/partners/:id",
  requireAdminRole(["sermon", "gallery", "livestream"]),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const { status } = req.body as { status?: string };
      const allowedStatuses = ["new", "contacted", "active", "declined"];

      if (!allowedStatuses.includes(status ?? "")) {
        res.status(400).json({ error: "Invalid status. Must be one of: new, contacted, active, declined" });
        return;
      }

      const result = await pool.query(
        `UPDATE sponsorship_inquiries SET status = $1 WHERE id = $2 RETURNING id, status`,
        [status, id]
      );

      if (result.rowCount === 0) {
        res.status(404).json({ error: "Inquiry not found" });
        return;
      }

      res.json({ ok: true, inquiry: result.rows[0] });
    } catch (err) {
      logger.error({ err }, "partner inquiry status update failed");
      res.status(500).json({ error: "Failed to update inquiry" });
    }
  }
);

export default router;
