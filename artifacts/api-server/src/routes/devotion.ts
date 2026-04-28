import { Router, type IRouter, type Request, type Response } from "express";
import { ensureDevotionForDate, getDevotionHistory } from "../lib/devotion-engine.js";
import { db, devotionSubscribersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import {
  isEmailConfigured,
  sendWelcomeEmail,
  getPublicBaseUrl,
} from "../lib/email-engine.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

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

// ─── Email subscription ───────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function makeUnsubscribeUrl(token: string): string {
  return `${getPublicBaseUrl()}/api/devotion/unsubscribe?token=${encodeURIComponent(token)}`;
}

router.post("/devotion/subscribe", async (req: Request, res: Response): Promise<void> => {
  const rawEmail = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
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
        // Re-activate a previously unsubscribed address.
        await db
          .update(devotionSubscribersTable)
          .set({ isActive: true, unsubscribedAt: null, subscribedAt: new Date() })
          .where(eq(devotionSubscribersTable.id, existing[0].id));
        isNew = true;
      }
    } else {
      token = randomBytes(24).toString("hex");
      await db.insert(devotionSubscribersTable).values({
        email: rawEmail,
        unsubscribeToken: token,
        sourcePage,
      });
      isNew = true;
    }

    if (isNew) {
      // Welcome email is best-effort — failure does NOT roll back the
      // subscription. The reply payload tells the UI whether mail was sent so
      // we can show a clearer success message.
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

router.get("/devotion/unsubscribe", async (req: Request, res: Response): Promise<void> => {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  if (!token) {
    res.status(400).type("text/html").send(buildUnsubscribePage("Missing token", false));
    return;
  }

  try {
    const rows = await db
      .select()
      .from(devotionSubscribersTable)
      .where(eq(devotionSubscribersTable.unsubscribeToken, token))
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
        .update(devotionSubscribersTable)
        .set({ isActive: false, unsubscribedAt: new Date() })
        .where(eq(devotionSubscribersTable.id, rows[0].id));
    }

    res.type("text/html").send(buildUnsubscribePage(
      `${rows[0].email} has been unsubscribed from the JCTM Daily Devotion.`,
      true,
    ));
  } catch (err) {
    logger.warn({ err }, "devotion unsubscribe failed");
    res.status(500).type("text/html").send(buildUnsubscribePage(
      "Something went wrong. Please try again later.",
      false,
    ));
  }
});

function buildUnsubscribePage(message: string, success: boolean): string {
  const colour = success ? "#0f766e" : "#991b1b";
  const heading = success ? "You've been unsubscribed" : "Unsubscribe";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>${heading} · JCTM Daily Devotion</title>
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
<p><a href="${getPublicBaseUrl()}/devotion">Return to the Devotion page</a></p>
</div></body></html>`;
}

export default router;
