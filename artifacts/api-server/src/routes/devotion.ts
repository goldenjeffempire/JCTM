import { Router, type IRouter, type Request, type Response } from "express";
import { ensureDevotionForDate, getDevotionHistory } from "../lib/devotion-engine.js";
import { db, devotionSubscribersTable, devotionsTable, pool } from "@workspace/db";
import { eq, count, desc, and } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import {
  isEmailConfigured,
  sendWelcomeEmail,
  sendDevotionEmail,
  renderDevotionEmail,
  getPublicBaseUrl,
} from "../lib/email-engine.js";
import { requireAdminRole } from "../lib/adminAuth.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ─── Today's devotion ─────────────────────────────────────────────────────────

router.get("/devotion/daily", async (_req: Request, res: Response): Promise<void> => {
  const today = new Date().toISOString().split("T")[0]!;
  try {
    const result = await ensureDevotionForDate(today);
    res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Devotion generation failed";
    res.status(500).json({ error: msg });
  }
});

// ─── Devotion for a specific date ─────────────────────────────────────────────

router.get("/devotion/date/:date", async (req: Request, res: Response): Promise<void> => {
  const dateStr = req.params.date ?? "";
  if (!DATE_RE.test(dateStr) || isNaN(new Date(dateStr + "T00:00:00Z").getTime())) {
    res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD." });
    return;
  }
  const today = new Date().toISOString().split("T")[0]!;
  if (dateStr > today) {
    res.status(400).json({ error: "Cannot fetch devotions for future dates." });
    return;
  }
  try {
    const result = await ensureDevotionForDate(dateStr);
    res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Devotion generation failed";
    res.status(500).json({ error: msg });
  }
});

// ─── History ──────────────────────────────────────────────────────────────────

router.get("/devotion/history", async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(Number(req.query.limit) || 7, 30);
    const devotions = await getDevotionHistory(limit);
    res.json({ devotions });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch devotion history";
    res.status(500).json({ error: msg });
  }
});

// ─── Public stats ─────────────────────────────────────────────────────────────

router.get("/devotion/stats", async (_req: Request, res: Response): Promise<void> => {
  try {
    const [subCount, devCount] = await Promise.all([
      db.select({ total: count() }).from(devotionSubscribersTable)
        .where(eq(devotionSubscribersTable.isActive, true)),
      db.select({ total: count() }).from(devotionsTable),
    ]);
    res.json({
      activeSubscribers: Number(subCount[0]?.total ?? 0),
      devotionsArchived: Number(devCount[0]?.total ?? 0),
    });
  } catch (err) {
    logger.warn({ err }, "devotion/stats failed");
    res.status(500).json({ error: "Stats unavailable." });
  }
});

// ─── Email subscription ───────────────────────────────────────────────────────

function makeUnsubscribeUrl(token: string): string {
  return `${getPublicBaseUrl()}/api/devotion/unsubscribe?token=${encodeURIComponent(token)}`;
}

router.post("/devotion/subscribe", async (req: Request, res: Response): Promise<void> => {
  const rawEmail  = typeof req.body?.email  === "string" ? req.body.email.trim().toLowerCase() : "";
  const rawName   = typeof req.body?.name   === "string" ? req.body.name.trim().slice(0, 80) : null;
  const sourcePage = typeof req.body?.source === "string" ? req.body.source.slice(0, 64) : null;

  if (!rawEmail || !EMAIL_RE.test(rawEmail) || rawEmail.length > 254) {
    res.status(400).json({ error: "Please enter a valid email address." });
    return;
  }

  try {
    const existing = await db
      .select()
      .from(devotionSubscribersTable)
      .where(eq(devotionSubscribersTable.email, rawEmail))
      .limit(1);

    let token: string;
    let isNew = false;

    if (existing[0]) {
      token = existing[0].unsubscribeToken;
      if (!existing[0].isActive) {
        await db.update(devotionSubscribersTable)
          .set({ isActive: true, unsubscribedAt: null, subscribedAt: new Date(), name: rawName ?? existing[0].name })
          .where(eq(devotionSubscribersTable.id, existing[0].id));
        isNew = true;
      } else if (rawName && !existing[0].name) {
        await db.update(devotionSubscribersTable)
          .set({ name: rawName })
          .where(eq(devotionSubscribersTable.id, existing[0].id));
      }
    } else {
      token = randomBytes(24).toString("hex");
      await db.insert(devotionSubscribersTable).values({
        email: rawEmail,
        name: rawName,
        unsubscribeToken: token,
        sourcePage,
      });
      isNew = true;
    }

    if (isNew) {
      sendWelcomeEmail(rawEmail, makeUnsubscribeUrl(token), logger).catch((err) => {
        logger.warn({ err, to: rawEmail }, "Welcome email dispatch failed (non-fatal)");
      });
    }

    res.json({
      ok: true,
      alreadySubscribed: !isNew,
      emailDeliveryEnabled: isEmailConfigured(),
    });
  } catch (err) {
    logger.warn({ err, email: rawEmail }, "devotion subscribe failed");
    res.status(500).json({ error: "Subscription failed. Please try again later." });
  }
});

// ─── Unsubscribe ──────────────────────────────────────────────────────────────

router.get("/devotion/unsubscribe", async (req: Request, res: Response): Promise<void> => {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  if (!token) {
    res.status(400).type("text/html").send(buildUnsubscribePage("Missing unsubscribe token.", false, ""));
    return;
  }
  try {
    const rows = await db.select().from(devotionSubscribersTable)
      .where(eq(devotionSubscribersTable.unsubscribeToken, token)).limit(1);

    if (!rows[0]) {
      res.status(404).type("text/html").send(buildUnsubscribePage(
        "We couldn't find that subscription. It may have already been removed.", false, ""));
      return;
    }
    if (rows[0].isActive) {
      await db.update(devotionSubscribersTable)
        .set({ isActive: false, unsubscribedAt: new Date() })
        .where(eq(devotionSubscribersTable.id, rows[0].id));
    }
    res.type("text/html").send(buildUnsubscribePage("", true, rows[0].email));
  } catch (err) {
    logger.warn({ err }, "devotion unsubscribe failed");
    res.status(500).type("text/html").send(buildUnsubscribePage("Something went wrong. Please try again.", false, ""));
  }
});

// ─── Admin: full stats ────────────────────────────────────────────────────────

router.get(
  "/devotion/admin/stats",
  requireAdminRole("livestream"),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const [activeRows, totalRows, recentSubs, recentDevotions] = await Promise.all([
        db.select({ total: count() }).from(devotionSubscribersTable)
          .where(eq(devotionSubscribersTable.isActive, true)),
        db.select({ total: count() }).from(devotionSubscribersTable),
        db.select().from(devotionSubscribersTable)
          .orderBy(desc(devotionSubscribersTable.subscribedAt)).limit(20),
        db.select({ date: devotionsTable.date, title: devotionsTable.title, reference: devotionsTable.reference })
          .from(devotionsTable).orderBy(desc(devotionsTable.date)).limit(14),
      ]);

      const lastSentRow = await pool.query<{ last_sent_date: string }>(
        `SELECT last_sent_date FROM devotion_subscribers
         WHERE is_active = true AND last_sent_date IS NOT NULL
         ORDER BY last_sent_date DESC LIMIT 1`,
      );

      res.json({
        ok: true,
        activeSubscribers: Number(activeRows[0]?.total ?? 0),
        totalEverSubscribed: Number(totalRows[0]?.total ?? 0),
        lastBroadcastDate: lastSentRow.rows[0]?.last_sent_date ?? null,
        smtpConfigured: isEmailConfigured(),
        recentSubscribers: recentSubs.map((s) => ({
          id: s.id,
          email: s.email,
          name: s.name ?? null,
          subscribedAt: s.subscribedAt,
          lastSentDate: s.lastSentDate,
          sourcePage: s.sourcePage,
        })),
        recentDevotions,
      });
    } catch (err) {
      logger.warn({ err }, "devotion admin stats failed");
      res.status(500).json({ error: "Failed to load stats." });
    }
  },
);

// ─── Admin: preview today's email ────────────────────────────────────────────

router.get(
  "/devotion/admin/preview-email",
  requireAdminRole("livestream"),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const today = new Date().toISOString().split("T")[0]!;
      const { devotion } = await ensureDevotionForDate(today);
      const { html } = renderDevotionEmail(
        devotion,
        `${getPublicBaseUrl()}/api/devotion/unsubscribe?token=preview`,
      );
      res.type("text/html").send(html);
    } catch (err) {
      logger.warn({ err }, "devotion admin preview-email failed");
      res.status(500).send("<p>Preview failed. Check server logs.</p>");
    }
  },
);

// ─── Admin: send test email ───────────────────────────────────────────────────

router.post(
  "/devotion/admin/send-test",
  requireAdminRole("livestream"),
  async (req: Request, res: Response): Promise<void> => {
    const toEmail = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    if (!toEmail || !EMAIL_RE.test(toEmail)) {
      res.status(400).json({ error: "Provide a valid test email address." });
      return;
    }
    if (!isEmailConfigured()) {
      res.status(503).json({ error: "SMTP is not configured on this server." });
      return;
    }
    try {
      const today = new Date().toISOString().split("T")[0]!;
      const { devotion } = await ensureDevotionForDate(today, logger);
      const unsubUrl = `${getPublicBaseUrl()}/api/devotion/unsubscribe?token=test-preview`;
      const ok = await sendDevotionEmail(toEmail, devotion, unsubUrl, logger);
      if (ok) {
        res.json({ ok: true, message: `Test devotion email sent to ${toEmail}.` });
      } else {
        res.status(500).json({ error: "Email send failed — check server SMTP configuration." });
      }
    } catch (err) {
      logger.warn({ err }, "devotion admin send-test failed");
      res.status(500).json({ error: "Failed to send test email." });
    }
  },
);

// ─── Admin: trigger broadcast now ────────────────────────────────────────────

router.post(
  "/devotion/admin/broadcast-now",
  requireAdminRole("livestream"),
  async (_req: Request, res: Response): Promise<void> => {
    if (!isEmailConfigured()) {
      res.status(503).json({ error: "SMTP is not configured on this server." });
      return;
    }
    try {
      const today = new Date().toISOString().split("T")[0]!;
      const { devotion } = await ensureDevotionForDate(today, logger);

      const {
        getActiveSubscribersMissedToday,
        makeUnsubscribeUrl,
        recordDelivery,
      } = await import("../lib/subscriber-manager.js");

      const base = getPublicBaseUrl();
      const subscribers = await getActiveSubscribersMissedToday("devotion", logger);

      if (subscribers.length === 0) {
        res.json({ ok: true, sent: 0, failed: 0, total: 0, note: "All subscribers already received today's devotion." });
        return;
      }

      let sent = 0;
      let failed = 0;

      for (const sub of subscribers) {
        const unsubUrl = makeUnsubscribeUrl(sub.email, base);
        const ok = await sendDevotionEmail(sub.email, devotion, unsubUrl, logger);
        if (ok) {
          sent++;
          await recordDelivery({
            subscriberId: sub.id,
            email: sub.email,
            emailType: "devotion",
            campaignKey: `devotion-${today}`,
            status: "sent",
          }, logger);
          // Also update legacy devotion_subscribers last_sent_date for compatibility
          await pool.query(
            `UPDATE devotion_subscribers SET last_sent_date = $1 WHERE lower(trim(email)) = $2`,
            [today, sub.email.toLowerCase()],
          ).catch(() => null);
        } else {
          failed++;
          await recordDelivery({
            subscriberId: sub.id,
            email: sub.email,
            emailType: "devotion",
            campaignKey: `devotion-${today}`,
            status: "failed",
          }, logger);
        }
        await new Promise((r) => setTimeout(r, 200));
      }

      res.json({ ok: true, sent, failed, total: subscribers.length });
    } catch (err) {
      logger.warn({ err }, "devotion admin broadcast-now failed");
      res.status(500).json({ error: "Broadcast failed. Check server logs." });
    }
  },
);

// ─── Unsubscribe page ─────────────────────────────────────────────────────────

function buildUnsubscribePage(message: string, success: boolean, email: string): string {
  const base = getPublicBaseUrl();
  const colour = success ? "#0f766e" : "#991b1b";
  const heading = success ? "Successfully Unsubscribed" : "Unsubscribe";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>${heading} · JCTM Daily Devotion</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{box-sizing:border-box}body{margin:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1f2937;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:24px}
.card{max-width:520px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(15,23,42,.08)}
.head{background:#0f172a;padding:20px 28px}.head p{margin:0;color:#94a3b8;font-size:11px;letter-spacing:.1em;text-transform:uppercase}.head strong{display:block;color:#fff;font-size:15px;margin-top:2px}
.body{padding:28px 28px 32px}
h1{font-size:20px;margin:0 0 10px;color:${colour}}p{line-height:1.7;margin:0 0 12px;color:#374151}
.links{margin-top:20px;padding-top:18px;border-top:1px solid #e5e7eb;display:flex;flex-wrap:wrap;gap:12px}
a{color:#2563eb;text-decoration:none;font-size:14px}a:hover{text-decoration:underline}
.note{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 14px;font-size:13px;color:#166534;margin-top:10px}
small{color:#9ca3af;font-size:12px}
</style></head><body>
<div class="card">
  <div class="head"><p>JCTM Digital Sanctuary</p><strong>Daily Devotion</strong></div>
  <div class="body">
    <h1>${heading}</h1>
    ${success
      ? `<p><strong>${email}</strong> has been removed from the JCTM Daily Devotion mailing list.</p>
         <div class="note">You won't receive any more daily devotion emails. You can re-subscribe any time from the <a href="${base}/devotion">devotion page</a>.</div>`
      : `<p>${message}</p>`}
    <div class="links">
      <a href="${base}/devotion">📖 Read today's devotion</a>
      <a href="${base}">🏠 Return to JCTM</a>
      ${success ? `<a href="${base}/devotion">Re-subscribe</a>` : ""}
    </div>
  </div>
</div>
<p style="margin-top:20px;font-size:12px;color:#9ca3af">Jesus Christ Temple Ministry · Warri, Nigeria</p>
</body></html>`;
}

export default router;
