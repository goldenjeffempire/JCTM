/**
 * conferenceNotify.ts — Ministers Conference broadcast notifications
 *
 * Sends push notifications to all active browser subscribers AND
 * announcement emails to every known audience:
 *   • devotion_subscribers (opt-in email newsletter)
 *   • conference_registrations (people who registered for the conference)
 *   • member_auth (registered Digital Sanctuary members)
 *
 * All three email lists are deduplicated before dispatch.
 *
 * Routes:
 *   GET  /api/conference/notify/preview    — audience counts (admin)
 *   POST /api/conference/notify/broadcast  — send to all (admin)
 *   GET  /api/conference/notify/history    — last 10 push dispatches (admin)
 */

import { Router, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { requireAdminRole } from "../lib/adminAuth.js";
import {
  dispatchPushNotification,
  getSubscriberCount,
  type NotificationPayload,
} from "../lib/push-manager.js";
import {
  sendConferenceAnnouncementEmail,
  isEmailConfigured,
  getPublicBaseUrl,
} from "../lib/email-engine.js";

const router = Router();

// ─── Conference event details (live from DB or defaults) ─────────────────────

async function getConferenceEvent() {
  try {
    const res = await pool.query<{
      id: number;
      title: string;
      description: string | null;
      start_date: Date;
      end_date: Date | null;
      location: string | null;
      youtube_url: string | null;
    }>(
      `SELECT id, title, description, start_date, end_date, location, youtube_url
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

function formatConferenceDates(start: Date, end: Date | null): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  if (!end || end.toDateString() === start.toDateString()) return fmt(start);
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${start.getDate()}–${end.getDate()} ${start.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}`;
  }
  return `${fmt(start)} – ${fmt(end)}`;
}

// ─── GET /api/conference/notify/preview ─────────────────────────────────────

router.get(
  "/conference/notify/preview",
  requireAdminRole("livestream"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const [pushCount, devotionCount, registrantCount, memberCount, event] = await Promise.all([
        getSubscriberCount(),
        pool.query<{ count: string }>(
          `SELECT COUNT(*)::text AS count FROM devotion_subscribers WHERE is_active = true`,
        ),
        pool.query<{ count: string }>(
          `SELECT COUNT(*)::text AS count FROM conference_registrations WHERE email IS NOT NULL AND email != ''`,
        ),
        pool.query<{ count: string }>(
          `SELECT COUNT(*)::text AS count FROM member_auth`,
        ),
        getConferenceEvent(),
      ]);

      // Deduplicated email count — query unique emails across all 3 sources
      const uniqueEmailsRes = await pool.query<{ count: string }>(`
        SELECT COUNT(DISTINCT email)::text AS count FROM (
          SELECT lower(trim(email)) AS email FROM devotion_subscribers WHERE is_active = true AND email IS NOT NULL AND email != ''
          UNION
          SELECT lower(trim(email)) AS email FROM conference_registrations WHERE email IS NOT NULL AND email != ''
          UNION
          SELECT lower(trim(email)) AS email FROM member_auth WHERE email IS NOT NULL AND email != ''
        ) combined
      `);

      res.json({
        ok: true,
        push: {
          subscribers: pushCount,
          ready: pushCount > 0,
        },
        email: {
          devotionSubscribers: parseInt(devotionCount.rows[0]?.count ?? "0", 10),
          conferenceRegistrants: parseInt(registrantCount.rows[0]?.count ?? "0", 10),
          members: parseInt(memberCount.rows[0]?.count ?? "0", 10),
          uniqueRecipients: parseInt(uniqueEmailsRes.rows[0]?.count ?? "0", 10),
          smtpConfigured: isEmailConfigured(),
        },
        event: event
          ? {
              id: event.id,
              title: event.title,
              dateStr: formatConferenceDates(
                new Date(event.start_date),
                event.end_date ? new Date(event.end_date) : null,
              ),
              location: event.location ?? "JCTM Auditorium, Ebrumede Roundabout, Effurun",
              hasYouTube: Boolean(event.youtube_url),
            }
          : {
              id: null,
              title: "Ministers Conference 2026 — Apostolic Fire",
              dateStr: "8–10 May 2026",
              location: "JCTM Auditorium, Ebrumede Roundabout, Effurun",
              hasYouTube: false,
            },
      });
    } catch (err) {
      req.log.error({ err }, "conference/notify/preview failed");
      res.status(500).json({ ok: false, error: "Failed to load preview data" });
    }
  },
);

// ─── POST /api/conference/notify/broadcast ───────────────────────────────────

router.post(
  "/conference/notify/broadcast",
  requireAdminRole("livestream"),
  async (req: Request, res: Response): Promise<void> => {
    const {
      conferenceTitle,
      tagline,
      dateStr,
      timeStr,
      location,
      channels = ["push", "email"],
      startingSoon = false,
      countdownLabel,
      countdownSub,
    } = req.body as {
      conferenceTitle?: string;
      tagline?: string;
      dateStr?: string;
      timeStr?: string;
      location?: string;
      channels?: string[];
      startingSoon?: boolean;
      countdownLabel?: string;
      countdownSub?: string;
    };

    try {
      const event = await getConferenceEvent();
      const base = getPublicBaseUrl();

      const conf = {
        conferenceTitle: conferenceTitle ?? event?.title ?? "Ministers Conference 2026 — Apostolic Fire",
        tagline: tagline ?? "A word that will mark you for life. Come and be transformed.",
        dateStr:
          dateStr ??
          (event
            ? formatConferenceDates(new Date(event.start_date), event.end_date ? new Date(event.end_date) : null)
            : "8–10 May 2026"),
        timeStr: timeStr ?? "8:00 AM WAT",
        location:
          location ?? event?.location ?? "JCTM Auditorium, Ebrumede Roundabout, Effurun",
        registrationUrl: `${base}/conference-registration`,
        startingSoon,
        countdownLabel: countdownLabel ?? (startingSoon ? "Starting Soon" : undefined),
        countdownSub,
      };

      const result: {
        push: { sent: number; failed: number; deactivated: number; skipped: boolean };
        email: { sent: number; failed: number; total: number; skipped: boolean };
      } = {
        push: { sent: 0, failed: 0, deactivated: 0, skipped: true },
        email: { sent: 0, failed: 0, total: 0, skipped: true },
      };

      // ── Web push ──
      if (channels.includes("push")) {
        const pushPayload: NotificationPayload = conf.startingSoon
          ? {
              title: `🔴 STARTING SOON — ${conf.conferenceTitle}`,
              body: conf.countdownLabel
                ? `${conf.countdownLabel} · ${conf.location}. Join us live now!`
                : `Service is about to begin at ${conf.location}. Join us live now!`,
              icon: "/icons/icon-192x192.png",
              badge: "/icons/badge-72x72.png",
              url: "/sermons",
              tag: "ministers-conference-2026-live",
              requireInteraction: true,
              actions: [{ action: "watch", title: "Watch Live" }],
              data: {
                type: "conference_starting_soon",
                conferenceTitle: conf.conferenceTitle,
                timestamp: new Date().toISOString(),
              },
            }
          : {
              title: `📣 ${conf.conferenceTitle}`,
              body: `${conf.dateStr} · ${conf.location}. Register now — seats are limited!`,
              icon: "/icons/icon-192x192.png",
              badge: "/icons/badge-72x72.png",
              url: "/conference-registration",
              tag: "ministers-conference-2026",
              requireInteraction: true,
              actions: [{ action: "register", title: "Register Now" }],
              data: {
                type: "conference_announcement",
                conferenceTitle: conf.conferenceTitle,
                timestamp: new Date().toISOString(),
              },
            };

        const pushResult = await dispatchPushNotification(pushPayload, req.log, "conference_announcement");
        result.push = { ...pushResult, skipped: false };
        req.log.info({ ...pushResult }, "Conference push broadcast complete");
      }

      // ── Email broadcast ──
      if (channels.includes("email") && isEmailConfigured()) {
        // Collect deduplicated recipients with names
        const emailMap = new Map<string, string | null>(); // email → name

        const [devotionRes, registrantRes, memberRes] = await Promise.all([
          pool.query<{ email: string }>(
            `SELECT lower(trim(email)) AS email FROM devotion_subscribers WHERE is_active = true AND email IS NOT NULL AND email != '' LIMIT 10000`,
          ),
          pool.query<{ email: string; full_name: string }>(
            `SELECT lower(trim(email)) AS email, full_name FROM conference_registrations WHERE email IS NOT NULL AND email != '' LIMIT 10000`,
          ),
          pool.query<{ email: string; first_name: string }>(
            `SELECT lower(trim(email)) AS email, first_name FROM member_auth WHERE email IS NOT NULL AND email != '' LIMIT 10000`,
          ),
        ]);

        // Insert in order: devotion → registrant → member (later entries preserve name)
        for (const row of devotionRes.rows) {
          if (row.email) emailMap.set(row.email, null);
        }
        for (const row of registrantRes.rows) {
          if (row.email) emailMap.set(row.email, row.full_name || null);
        }
        for (const row of memberRes.rows) {
          if (row.email) {
            if (!emailMap.has(row.email) || !emailMap.get(row.email)) {
              emailMap.set(row.email, row.first_name || null);
            }
          }
        }

        const recipients = Array.from(emailMap.entries());
        result.email.total = recipients.length;
        result.email.skipped = false;

        req.log.info({ total: recipients.length }, "Starting conference email broadcast");

        // Send in batches of 20 with 200ms pacing to be polite to SMTP relays
        const BATCH = 20;
        const PACE_MS = 200;

        for (let i = 0; i < recipients.length; i += BATCH) {
          const batch = recipients.slice(i, i + BATCH);
          const settled = await Promise.allSettled(
            batch.map(([email, name]) =>
              sendConferenceAnnouncementEmail(
                email,
                { ...conf, recipientName: name ?? undefined },
                req.log,
              ),
            ),
          );
          for (const r of settled) {
            if (r.status === "fulfilled" && r.value) {
              result.email.sent++;
            } else {
              result.email.failed++;
            }
          }
          if (i + BATCH < recipients.length) {
            await new Promise((r) => setTimeout(r, PACE_MS));
          }
        }

        req.log.info(
          { sent: result.email.sent, failed: result.email.failed, total: result.email.total },
          "Conference email broadcast complete",
        );
      } else if (channels.includes("email") && !isEmailConfigured()) {
        result.email.skipped = true;
        result.email.total = 0;
      }

      res.json({
        ok: true,
        result,
        conference: conf,
        broadcastAt: new Date().toISOString(),
      });
    } catch (err) {
      req.log.error({ err }, "conference/notify/broadcast failed");
      res.status(500).json({ ok: false, error: "Broadcast failed. Check server logs." });
    }
  },
);

// ─── GET /api/conference/notify/history ─────────────────────────────────────

router.get(
  "/conference/notify/history",
  requireAdminRole("livestream"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const res2 = await pool.query<{
        id: number;
        notification_title: string;
        notification_type: string;
        sent: number;
        failed: number;
        deactivated: number;
        total_attempted: number;
        delivery_rate: number;
        dispatched_at: Date;
      }>(
        `SELECT id, notification_title, notification_type, sent, failed, deactivated, total_attempted, delivery_rate, dispatched_at
           FROM push_dispatch_log
          WHERE notification_type = 'conference_announcement'
          ORDER BY dispatched_at DESC
          LIMIT 10`,
      );

      res.json({
        ok: true,
        history: res2.rows.map(r => ({
          ...r,
          dispatchedAt: r.dispatched_at instanceof Date ? r.dispatched_at.toISOString() : r.dispatched_at,
        })),
      });
    } catch (err) {
      req.log.error({ err }, "conference/notify/history failed");
      res.status(500).json({ ok: false, error: "Failed to load history" });
    }
  },
);

export default router;
