/**
 * eventNotifications.ts — Public + admin endpoints for the multi-channel
 * event notification system (see lib/event-notification-scheduler.ts).
 *
 * Public:
 *   POST /api/event-notifications/subscribe         — opt-in email reminders
 *   GET  /api/event-notifications/unsubscribe       — token-based one-click off
 *
 * Admin (requires livestream admin token):
 *   GET  /api/admin/event-notifications/log         — recent dispatch rows
 *   GET  /api/admin/event-notifications/upcoming    — milestone status grid
 *   GET  /api/admin/event-notifications/stats       — aggregate counts + state
 *   POST /api/admin/event-notifications/run-now     — trigger immediate tick
 *   POST /api/admin/event-notifications/:id/retry   — retry a single failed row
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, eventNotificationSubscribersTable } from "@workspace/db";
import { logger } from "../lib/logger.js";
import { requireAdminRole } from "../lib/adminAuth.js";
import { getPublicBaseUrl, isEmailConfigured, sendTestEmail } from "../lib/email-engine.js";
import {
  runEventNotificationTick,
  retryDispatchLogRow,
  getRecentDispatchLog,
  getUpcomingWithMilestoneStatus,
  getDispatchStats,
  getEventNotificationState,
  updateEventNotificationConfig,
  type EventNotificationConfigPatch,
} from "../lib/event-notification-scheduler.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const router: IRouter = Router();

function makeUnsubscribeUrl(token: string): string {
  return `${getPublicBaseUrl()}/api/event-notifications/unsubscribe?token=${encodeURIComponent(token)}`;
}

// ─── Public: subscribe ───────────────────────────────────────────────────────

router.post(
  "/event-notifications/subscribe",
  async (req: Request, res: Response): Promise<void> => {
    const rawEmail =
      typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const sourcePage =
      typeof req.body?.source === "string" ? req.body.source.slice(0, 64) : null;
    const tzRaw = typeof req.body?.timezone === "string" ? req.body.timezone.slice(0, 64) : "";
    const timezone = sanitizeTimezone(tzRaw);

    if (!rawEmail || !EMAIL_RE.test(rawEmail) || rawEmail.length > 254) {
      res.status(400).json({ error: "Please enter a valid email address." });
      return;
    }

    try {
      const existing = await db
        .select()
        .from(eventNotificationSubscribersTable)
        .where(eq(eventNotificationSubscribersTable.email, rawEmail))
        .limit(1);

      let isNew = false;

      if (existing[0]) {
        if (!existing[0].isActive) {
          await db
            .update(eventNotificationSubscribersTable)
            .set({
              isActive: true,
              unsubscribedAt: null,
              subscribedAt: new Date(),
              sourcePage: sourcePage ?? existing[0].sourcePage,
              timezone: timezone ?? existing[0].timezone,
            })
            .where(eq(eventNotificationSubscribersTable.id, existing[0].id));
          isNew = true;
        } else if (timezone && timezone !== existing[0].timezone) {
          // Re-subscribe with a fresher timezone — silently update.
          await db
            .update(eventNotificationSubscribersTable)
            .set({ timezone })
            .where(eq(eventNotificationSubscribersTable.id, existing[0].id));
        }
      } else {
        const token = randomBytes(24).toString("hex");
        await db.insert(eventNotificationSubscribersTable).values({
          email: rawEmail,
          unsubscribeToken: token,
          sourcePage,
          ...(timezone ? { timezone } : {}),
        });
        isNew = true;
      }

      res.json({
        ok: true,
        alreadySubscribed: !isNew,
        emailDeliveryEnabled: isEmailConfigured(),
      });
    } catch (err) {
      logger.warn({ err, email: rawEmail }, "event-notification subscribe failed");
      res.status(500).json({ error: "Subscription failed. Please try again later." });
    }
  },
);

// ─── Public: unsubscribe (one-click HTML) ────────────────────────────────────

router.get(
  "/event-notifications/unsubscribe",
  async (req: Request, res: Response): Promise<void> => {
    const token = typeof req.query.token === "string" ? req.query.token : "";
    if (!token) {
      res.status(400).type("text/html").send(buildUnsubscribePage("Missing token", false));
      return;
    }
    try {
      const rows = await db
        .select()
        .from(eventNotificationSubscribersTable)
        .where(eq(eventNotificationSubscribersTable.unsubscribeToken, token))
        .limit(1);

      if (!rows[0]) {
        res.status(404).type("text/html").send(buildUnsubscribePage(
          "We couldn't find that subscription. It may have already been removed.",
          false,
        ));
        return;
      }

      if (rows[0].isActive) {
        await db
          .update(eventNotificationSubscribersTable)
          .set({ isActive: false, unsubscribedAt: new Date() })
          .where(eq(eventNotificationSubscribersTable.id, rows[0].id));
      }

      res.type("text/html").send(buildUnsubscribePage(
        `${rows[0].email} has been unsubscribed from JCTM event reminders.`,
        true,
      ));
    } catch (err) {
      logger.warn({ err }, "event-notification unsubscribe failed");
      res.status(500).type("text/html").send(buildUnsubscribePage(
        "Something went wrong. Please try again later.",
        false,
      ));
    }
  },
);

// ─── Admin endpoints ─────────────────────────────────────────────────────────

router.get(
  "/admin/event-notifications/log",
  requireAdminRole("livestream"),
  async (req: Request, res: Response): Promise<void> => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const rows = await getRecentDispatchLog(limit);
    res.json({
      rows: rows.map((r) => ({
        ...r,
        firstAttemptAt: r.firstAttemptAt?.toISOString() ?? null,
        lastAttemptAt: r.lastAttemptAt?.toISOString() ?? null,
        completedAt: r.completedAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  },
);

router.get(
  "/admin/event-notifications/upcoming",
  requireAdminRole("livestream"),
  async (_req: Request, res: Response): Promise<void> => {
    const data = await getUpcomingWithMilestoneStatus();
    res.json({
      events: data.map(({ event, milestones, config, pulse }) => ({
        id: event.id,
        title: event.title,
        location: event.location,
        startDate: event.startDate.toISOString(),
        endDate: event.endDate?.toISOString() ?? null,
        eventType: event.eventType,
        milestones,
        config,
        pulse: {
          lastSlotIso: pulse.lastSlotIso,
          totalPulseRows: pulse.totalPulseRows,
          sentPulseRows: pulse.sentPulseRows,
          lastByChannel: {
            push: pulse.lastChannelStatus.push
              ? {
                  status: pulse.lastChannelStatus.push.status,
                  bucketKey: pulse.lastChannelStatus.push.bucketKey,
                  sent: pulse.lastChannelStatus.push.successCount,
                  failed: pulse.lastChannelStatus.push.failureCount,
                }
              : null,
            email: pulse.lastChannelStatus.email
              ? {
                  status: pulse.lastChannelStatus.email.status,
                  bucketKey: pulse.lastChannelStatus.email.bucketKey,
                  sent: pulse.lastChannelStatus.email.successCount,
                  failed: pulse.lastChannelStatus.email.failureCount,
                }
              : null,
            sse: pulse.lastChannelStatus.sse
              ? {
                  status: pulse.lastChannelStatus.sse.status,
                  bucketKey: pulse.lastChannelStatus.sse.bucketKey,
                  sent: pulse.lastChannelStatus.sse.successCount,
                  failed: pulse.lastChannelStatus.sse.failureCount,
                }
              : null,
          },
        },
      })),
    });
  },
);

// PATCH per-event notification config
router.patch(
  "/admin/event-notifications/event/:id/config",
  requireAdminRole("livestream"),
  async (req: Request, res: Response): Promise<void> => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ error: "Invalid event id" });
      return;
    }
    const body = req.body ?? {};
    const patch: EventNotificationConfigPatch = {};

    if (typeof body.enabled === "boolean") patch.enabled = body.enabled;

    if (body.milestonesHours !== undefined) {
      if (body.milestonesHours === null) patch.milestonesHours = null;
      else if (Array.isArray(body.milestonesHours)) {
        const filtered = body.milestonesHours
          .map((n: unknown) => Number(n))
          .filter((n: number) => Number.isFinite(n) && n > 0 && n <= 24 * 14);
        if (filtered.length > 12) {
          res.status(400).json({ error: "Maximum 12 milestone hours allowed" });
          return;
        }
        patch.milestonesHours = filtered;
      } else {
        res.status(400).json({ error: "milestonesHours must be an array of positive integers" });
        return;
      }
    }

    if (body.pulseMinutes !== undefined) {
      if (body.pulseMinutes === null) patch.pulseMinutes = null;
      else {
        const n = Number(body.pulseMinutes);
        if (!Number.isFinite(n) || n < 5 || n > 24 * 60) {
          res.status(400).json({ error: "pulseMinutes must be between 5 and 1440 (or null)" });
          return;
        }
        patch.pulseMinutes = Math.round(n);
      }
    }

    if (body.pulseWindowHours !== undefined) {
      if (body.pulseWindowHours === null) patch.pulseWindowHours = null;
      else {
        const n = Number(body.pulseWindowHours);
        if (!Number.isFinite(n) || n < 1 || n > 24 * 14) {
          res.status(400).json({ error: "pulseWindowHours must be between 1 and 336 (or null)" });
          return;
        }
        patch.pulseWindowHours = Math.round(n);
      }
    }

    if (body.pausedUntil !== undefined) {
      if (body.pausedUntil === null) patch.pausedUntil = null;
      else if (typeof body.pausedUntil === "string") {
        const d = new Date(body.pausedUntil);
        if (Number.isNaN(d.getTime())) {
          res.status(400).json({ error: "pausedUntil must be an ISO timestamp or null" });
          return;
        }
        patch.pausedUntil = d.toISOString();
      } else {
        res.status(400).json({ error: "pausedUntil must be an ISO string or null" });
        return;
      }
    }

    try {
      const event = await updateEventNotificationConfig(id, patch);
      if (!event) {
        res.status(404).json({ error: "Event not found" });
        return;
      }
      res.json({
        ok: true,
        event: {
          id: event.id,
          title: event.title,
          notificationEnabled: event.notificationEnabled,
          notificationMilestones: event.notificationMilestones,
          notificationPulseMinutes: event.notificationPulseMinutes,
          notificationPulseWindowHours: event.notificationPulseWindowHours,
          notificationPausedUntil: event.notificationPausedUntil?.toISOString() ?? null,
        },
      });
    } catch (err) {
      logger.warn({ err, id }, "update event notification config failed");
      res.status(500).json({ error: "Update failed" });
    }
  },
);

router.get(
  "/admin/event-notifications/stats",
  requireAdminRole("livestream"),
  async (_req: Request, res: Response): Promise<void> => {
    const [stats, state] = await Promise.all([
      getDispatchStats(),
      Promise.resolve(getEventNotificationState()),
    ]);
    const nextTickAt = state.lastTickFinishedAt
      ? new Date(new Date(state.lastTickFinishedAt).getTime() + state.intervalMs).toISOString()
      : null;
    res.json({
      ...stats,
      lastTickStartedAt: state.lastTickStartedAt,
      lastTickFinishedAt: state.lastTickFinishedAt,
      lastTickResult: state.lastTickResult,
      isRunning: state.isRunning,
      intervalMs: state.intervalMs,
      nextTickAt,
      emailDeliveryEnabled: isEmailConfigured(),
    });
  },
);

router.post(
  "/admin/email/test",
  requireAdminRole("livestream"),
  async (req: Request, res: Response): Promise<void> => {
    const rawTo = typeof req.body?.to === "string" ? req.body.to.trim().toLowerCase() : "";
    if (!rawTo || !EMAIL_RE.test(rawTo) || rawTo.length > 254) {
      res.status(400).json({ error: "Please enter a valid recipient email address." });
      return;
    }
    if (!isEmailConfigured()) {
      res.status(503).json({
        error: "SMTP is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS, then restart the server.",
      });
      return;
    }
    const result = await sendTestEmail(rawTo, logger);
    if (result.ok) {
      res.json({ ok: true, to: rawTo, messageId: result.messageId ?? null });
    } else {
      res.status(502).json({ error: result.error });
    }
  },
);

router.post(
  "/admin/event-notifications/run-now",
  requireAdminRole("livestream"),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const result = await runEventNotificationTick(logger);
      res.json({ ok: true, result });
    } catch (err) {
      logger.warn({ err }, "Manual event-notification tick failed");
      res.status(500).json({
        error: "Tick failed",
        details: err instanceof Error ? err.message : String(err),
      });
    }
  },
);

router.post(
  "/admin/event-notifications/:id/retry",
  requireAdminRole("livestream"),
  async (req: Request, res: Response): Promise<void> => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    try {
      const updated = await retryDispatchLogRow(id, logger);
      if (!updated) {
        res.status(404).json({ error: "Log row not found, or referenced event was deleted." });
        return;
      }
      res.json({
        ok: true,
        row: {
          ...updated,
          firstAttemptAt: updated.firstAttemptAt?.toISOString() ?? null,
          lastAttemptAt: updated.lastAttemptAt?.toISOString() ?? null,
          completedAt: updated.completedAt?.toISOString() ?? null,
          createdAt: updated.createdAt.toISOString(),
        },
      });
    } catch (err) {
      logger.warn({ err, id }, "Retry dispatch row failed");
      res.status(500).json({ error: "Retry failed" });
    }
  },
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sanitizeTimezone(raw: string): string | null {
  const v = raw.trim();
  if (!v || v.length > 64) return null;
  // Light validation: must be a recognised IANA name like "Africa/Lagos" or
  // a region the runtime can format to. Anything else falls back to default.
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: v }).format(new Date());
    return v;
  } catch {
    return null;
  }
}

function buildUnsubscribePage(message: string, success: boolean): string {
  const colour = success ? "#0f766e" : "#991b1b";
  const heading = success ? "You've been unsubscribed" : "Unsubscribe";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>${heading} · JCTM Event Reminders</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1f2937;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;}
.card{max-width:480px;width:100%;background:#fff;border-radius:14px;padding:32px;box-shadow:0 1px 3px rgba(15,23,42,0.06);}
h1{font-size:20px;margin:0 0 12px 0;color:${colour};}
p{line-height:1.65;margin:0 0 16px 0;}
a{color:#2563eb;text-decoration:none;}
small{color:#6b7280;}</style></head>
<body><div class="card">
<small>JCTM Digital Sanctuary</small>
<h1>${heading}</h1>
<p>${message}</p>
<p><a href="${getPublicBaseUrl()}/events">Return to upcoming events</a></p>
</div></body></html>`;
}

export default router;
