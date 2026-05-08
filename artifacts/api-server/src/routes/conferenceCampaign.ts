/**
 * conferenceCampaign.ts — Ministers Conference bulk email reminder campaign
 *
 * Routes:
 *   GET  /api/conference/campaign/preview   — audience counts across all tables
 *   POST /api/conference/campaign/launch    — trigger campaign (admin auth)
 *   GET  /api/conference/campaign/status    — current / latest campaign status
 *   GET  /api/conference/campaign/list      — all campaigns (admin)
 */

import { Router, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { requireAdminRole } from "../lib/adminAuth.js";
import { isEmailConfigured, getPublicBaseUrl } from "../lib/email-engine.js";
import {
  aggregateAllEmails,
  launchConferenceCampaign,
  launchConferenceLiveNotification,
  getCampaignByKey,
  listCampaigns,
  isValidEmail,
} from "../lib/conference-campaign-engine.js";

const router = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getConferenceEvent() {
  try {
    const res = await pool.query<{
      id: number;
      title: string;
      start_date: Date;
      end_date: Date | null;
      location: string | null;
      youtube_url: string | null;
    }>(
      `SELECT id, title, start_date, end_date, location, youtube_url
         FROM event_calendar
        WHERE title ILIKE '%minister%conference%' OR title ILIKE '%ministers%conference%'
        ORDER BY start_date DESC
        LIMIT 1`,
    );
    return res.rows[0] ?? null;
  } catch {
    return null;
  }
}

function formatDates(start: Date, end: Date | null): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  if (!end || end.toDateString() === start.toDateString()) return fmt(start);
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${start.getDate()}–${end.getDate()} ${start.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}`;
  }
  return `${fmt(start)} – ${fmt(end)}`;
}

// ─── GET /api/conference/campaign/preview ────────────────────────────────────

router.get(
  "/conference/campaign/preview",
  requireAdminRole("livestream"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const [event, unsubRes] = await Promise.all([
        getConferenceEvent(),
        pool.query<{ count: string }>(`
          SELECT COUNT(DISTINCT email)::text AS count FROM (
            SELECT lower(trim(email)) AS email FROM devotion_subscribers WHERE is_active = false AND email IS NOT NULL
            UNION
            SELECT lower(trim(email)) AS email FROM event_notification_subscribers WHERE is_active = false AND email IS NOT NULL
          ) u
        `),
      ]);

      // Count per-table
      const counts = await Promise.allSettled([
        pool.query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM event_notification_subscribers WHERE is_active = true AND email IS NOT NULL AND email != ''`),
        pool.query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM devotion_subscribers WHERE is_active = true AND email IS NOT NULL AND email != ''`),
        pool.query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM conference_registrations WHERE email IS NOT NULL AND email != ''`),
        pool.query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM member_auth WHERE email IS NOT NULL AND email != ''`),
        pool.query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM giving_logs WHERE donor_email IS NOT NULL AND donor_email != '' AND status = 'success'`),
        pool.query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM testimonies WHERE email IS NOT NULL AND email != '' AND approved = true`),
        pool.query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM member_directory WHERE email IS NOT NULL AND email != ''`),
        pool.query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM sponsorship_inquiries WHERE email IS NOT NULL AND email != ''`),
      ]);

      const n = (r: PromiseSettledResult<{ rows: { c: string }[] }>) =>
        r.status === "fulfilled" ? parseInt(r.value.rows[0]?.c ?? "0", 10) : 0;

      // Deduplicated unique estimate (live query)
      const uniqueRes = await pool.query<{ count: string }>(`
        SELECT COUNT(DISTINCT email)::text AS count FROM (
          SELECT lower(trim(email)) AS email FROM event_notification_subscribers WHERE is_active = true AND email IS NOT NULL AND email != ''
          UNION
          SELECT lower(trim(email)) AS email FROM devotion_subscribers WHERE is_active = true AND email IS NOT NULL AND email != ''
          UNION
          SELECT lower(trim(email)) AS email FROM conference_registrations WHERE email IS NOT NULL AND email != ''
          UNION
          SELECT lower(trim(email)) AS email FROM member_auth WHERE email IS NOT NULL AND email != ''
          UNION
          SELECT lower(trim(donor_email)) AS email FROM giving_logs WHERE donor_email IS NOT NULL AND donor_email != '' AND status = 'success'
          UNION
          SELECT lower(trim(email)) AS email FROM testimonies WHERE email IS NOT NULL AND email != '' AND approved = true
          UNION
          SELECT lower(trim(email)) AS email FROM member_directory WHERE email IS NOT NULL AND email != ''
          UNION
          SELECT lower(trim(email)) AS email FROM sponsorship_inquiries WHERE email IS NOT NULL AND email != ''
        ) combined
      `).catch(() => ({ rows: [{ count: "0" }] }));

      const unsubscribedCount = parseInt(unsubRes.rows[0]?.count ?? "0", 10);
      const uniqueTotal = parseInt(uniqueRes.rows[0]?.count ?? "0", 10);
      const estimatedDeliverable = Math.max(0, uniqueTotal - unsubscribedCount);

      res.json({
        ok: true,
        smtpConfigured: isEmailConfigured(),
        sources: {
          eventNotificationSubscribers: n(counts[0]!),
          devotionSubscribers: n(counts[1]!),
          conferenceRegistrations: n(counts[2]!),
          memberAuth: n(counts[3]!),
          donors: n(counts[4]!),
          testimonies: n(counts[5]!),
          memberDirectory: n(counts[6]!),
          sponsorshipInquiries: n(counts[7]!),
        },
        uniqueTotal,
        unsubscribedCount,
        estimatedDeliverable,
        event: event
          ? {
              title: event.title,
              dateStr: formatDates(new Date(event.start_date), event.end_date ? new Date(event.end_date) : null),
              location: event.location ?? "JCTM Auditorium, Ebrumede Roundabout, Effurun",
            }
          : {
              title: "Ministers Conference 2026 — Apostolic Fire",
              dateStr: "8–10 May 2026",
              location: "JCTM Auditorium, Ebrumede Roundabout, Effurun",
            },
      });
    } catch (err) {
      req.log.error({ err }, "conference/campaign/preview failed");
      res.status(500).json({ ok: false, error: "Failed to load preview" });
    }
  },
);

// ─── POST /api/conference/campaign/launch ────────────────────────────────────

router.post(
  "/conference/campaign/launch",
  requireAdminRole("livestream"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!isEmailConfigured()) {
        res.status(503).json({
          ok: false,
          error: "SMTP is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS to enable email delivery.",
        });
        return;
      }

      const event = await getConferenceEvent();
      const base = getPublicBaseUrl();

      const {
        campaignKey = `ministers-conference-2026-reminder-${Date.now()}`,
        conferenceTitle = event?.title ?? "Ministers Conference 2026 — Apostolic Fire",
        tagline = "A word that will mark you for life. Come and be transformed.",
        dateStr = event
          ? formatDates(new Date(event.start_date), event.end_date ? new Date(event.end_date) : null)
          : "8–10 May 2026",
        timeStr = "8:00 AM WAT",
        location = event?.location ?? "JCTM Auditorium, Ebrumede Roundabout, Effurun",
      } = req.body as Record<string, string>;

      const registrationUrl = `${base}/conference-registration`;
      const livestreamUrl = `${base}/sermons`;

      req.log.info(
        { campaignKey, conferenceTitle, dateStr, timeStr, location },
        "Conference campaign launch requested",
      );

      const { campaignId, totalRecipients, skipped } = await launchConferenceCampaign({
        campaignKey,
        conferenceTitle,
        tagline,
        dateStr,
        timeStr,
        location,
        registrationUrl,
        livestreamUrl,
        log: req.log,
      });

      res.json({
        ok: true,
        campaignId,
        campaignKey,
        totalRecipients,
        unsubscribeSkipped: skipped,
        message: `Campaign queued. ${totalRecipients} emails will be sent in the background.`,
        statusUrl: `/api/conference/campaign/status?key=${encodeURIComponent(campaignKey)}`,
      });
    } catch (err) {
      req.log.error({ err }, "conference/campaign/launch failed");
      const msg = err instanceof Error ? err.message : "Campaign launch failed";
      res.status(500).json({ ok: false, error: msg });
    }
  },
);

// ─── GET /api/conference/campaign/status ─────────────────────────────────────

router.get(
  "/conference/campaign/status",
  requireAdminRole("livestream"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const key = (req.query.key as string | undefined)?.trim();
      if (key) {
        const campaign = await getCampaignByKey(key);
        if (!campaign) {
          res.status(404).json({ ok: false, error: "Campaign not found" });
          return;
        }
        // Progress percentage
        const progress =
          campaign.totalRecipients > 0
            ? Math.min(
                100,
                Math.round(
                  ((campaign.sent + campaign.failed) / campaign.totalRecipients) * 100,
                ),
              )
            : 0;
        res.json({ ok: true, campaign, progress });
      } else {
        // Return latest campaign
        const campaigns = await listCampaigns(1);
        const latest = campaigns[0] ?? null;
        const progress =
          latest && latest.totalRecipients > 0
            ? Math.min(
                100,
                Math.round(
                  ((latest.sent + latest.failed) / latest.totalRecipients) * 100,
                ),
              )
            : 0;
        res.json({ ok: true, campaign: latest, progress });
      }
    } catch (err) {
      req.log.error({ err }, "conference/campaign/status failed");
      res.status(500).json({ ok: false, error: "Failed to fetch campaign status" });
    }
  },
);

// ─── POST /api/conference/campaign/send-live ─────────────────────────────────
// Manually triggers the "WE ARE LIVE NOW" email blast to every contact in the
// database (respecting unsubscribes). Does NOT require isConferenceDay() —
// the admin can fire this at any point during the conference. Creates a unique
// campaign key using the current timestamp to prevent dedup conflicts with any
// previous live-notification campaign.

router.post(
  "/conference/campaign/send-live",
  requireAdminRole("livestream"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!isEmailConfigured()) {
        res.status(503).json({
          ok: false,
          error: "SMTP is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS to enable email delivery.",
        });
        return;
      }

      const base = getPublicBaseUrl();
      const event = await getConferenceEvent();

      const {
        campaignKey = `ministers-conference-2026-live-${Date.now()}`,
        conferenceTitle = event?.title ?? "Ministers Conference 2026 — Apostolic Fire",
        serviceTitle = "Ministers Conference 2026 — Apostolic Fire (Day 1)",
        liveUrl = `${base}/sermons`,
      } = req.body as Record<string, string>;

      req.log.info(
        { campaignKey, conferenceTitle, serviceTitle, liveUrl },
        "Manual conference LIVE notification requested",
      );

      const { campaignId, totalRecipients, skipped } = await launchConferenceLiveNotification({
        campaignKey,
        conferenceTitle,
        serviceTitle,
        liveUrl,
        ministryWebsite: base,
        log: req.log,
      });

      res.json({
        ok: true,
        campaignId,
        campaignKey,
        totalRecipients,
        unsubscribeSkipped: skipped,
        message: `Live notification campaign queued. ${totalRecipients} emails will be sent in the background.`,
        statusUrl: `/api/conference/campaign/status?key=${encodeURIComponent(campaignKey)}`,
      });
    } catch (err) {
      req.log.error({ err }, "conference/campaign/send-live failed");
      const msg = err instanceof Error ? err.message : "Campaign launch failed";
      res.status(500).json({ ok: false, error: msg });
    }
  },
);

// ─── GET /api/conference/campaign/list ───────────────────────────────────────

router.get(
  "/conference/campaign/list",
  requireAdminRole("livestream"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const limit = Math.min(Number(req.query.limit) || 10, 50);
      const campaigns = await listCampaigns(limit);
      res.json({ ok: true, campaigns, total: campaigns.length });
    } catch (err) {
      req.log.error({ err }, "conference/campaign/list failed");
      res.status(500).json({ ok: false, error: "Failed to list campaigns" });
    }
  },
);

export default router;
