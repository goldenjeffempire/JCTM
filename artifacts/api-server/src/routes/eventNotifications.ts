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
import { getPublicBaseUrl, isEmailConfigured } from "../lib/email-engine.js";
import {
  runEventNotificationTick,
  retryDispatchLogRow,
  getRecentDispatchLog,
  getUpcomingWithMilestoneStatus,
  getDispatchStats,
  getEventNotificationState,
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
            })
            .where(eq(eventNotificationSubscribersTable.id, existing[0].id));
          isNew = true;
        }
      } else {
        const token = randomBytes(24).toString("hex");
        await db.insert(eventNotificationSubscribersTable).values({
          email: rawEmail,
          unsubscribeToken: token,
          sourcePage,
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
      events: data.map(({ event, milestones }) => ({
        id: event.id,
        title: event.title,
        location: event.location,
        startDate: event.startDate.toISOString(),
        endDate: event.endDate?.toISOString() ?? null,
        eventType: event.eventType,
        milestones,
      })),
    });
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
