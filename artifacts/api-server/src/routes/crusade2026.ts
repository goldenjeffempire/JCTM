import { Router, type IRouter } from "express";
import { randomBytes } from "node:crypto";
import multer from "multer";
import sharp from "sharp";
import rateLimit from "express-rate-limit";
import { pool } from "@workspace/db";
import { requireAdminRole } from "../lib/adminAuth.js";
import { getPublicBaseUrl } from "../lib/email-engine.js";
import { ObjectStorageService, detectImageMimeType } from "../lib/objectStorage.js";
import { crusadeCampaignInput, readCrusadeCampaign, publicCrusade, updateCrusadeCampaign } from "../lib/crusade-campaign.js";

const router: IRouter = Router();
const admin = requireAdminRole("livestream");
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });
const uploadLimit = rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: "draft-7", legacyHeaders: false });
const newsletterSubscribeLimit = rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: "draft-7", legacyHeaders: false });
const invitationCountLimit = rateLimit({ windowMs: 15 * 60_000, limit: 120, standardHeaders: "draft-7", legacyHeaders: false });
const newsletterEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.use("/crusade-2026", (_req, res, next) => {
  res.setHeader("Cache-Control", "private, no-store");
  next();
});
router.get("/crusade-2026", async (req, res) => {
  try {
    const campaign = publicCrusade(await readCrusadeCampaign());
    if (!campaign) { res.status(404).json({ error: "This event is not currently published" }); return; }
    res.json(campaign);
  } catch (error) {
    req.log.error({ err: error }, "Unable to read crusade campaign");
    res.status(503).json({ error: "Event information is temporarily unavailable. Please try again." });
  }
});
router.get("/crusade-2026/invitation-count", async (req, res) => {
  try {
    const result = await pool.query<{ generatedCount: string }>(
      "SELECT generated_cards::text AS \"generatedCount\" FROM crusade_invitation_stats WHERE id = 1",
    );
    const count = result.rows[0]?.generatedCount;
    if (count === undefined) throw new Error("Invitation count row is missing");
    res.setHeader("Cache-Control", "private, no-store");
    res.json({ generatedCount: count });
  } catch (error) {
    req.log.error({ err: error }, "Crusade invitation count could not be read");
    res.status(503).json({ error: "Invitation count is temporarily unavailable." });
  }
});

router.post("/crusade-2026/invitation-count", invitationCountLimit, async (req, res) => {
  if (!req.is("application/json")) {
    res.status(415).json({ error: "JSON requests only." });
    return;
  }
  try {
    const result = await pool.query<{ generatedCount: string }>(
      `UPDATE crusade_invitation_stats
       SET generated_cards = generated_cards + 1, updated_at = now()
       WHERE id = 1
       RETURNING generated_cards::text AS "generatedCount"`,
    );
    const count = result.rows[0]?.generatedCount;
    if (count === undefined) throw new Error("Invitation count row is missing");
    res.setHeader("Cache-Control", "private, no-store");
    res.json({ generatedCount: count });
  } catch (error) {
    req.log.error({ err: error }, "Crusade invitation count could not be updated");
    res.status(503).json({ error: "Invitation count is temporarily unavailable." });
  }
});

router.post("/crusade-2026/newsletter-subscribe", newsletterSubscribeLimit, async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (!email || email.length > 254 || !newsletterEmailPattern.test(email)) {
    res.status(400).json({ error: "Please enter a valid email address." });
    return;
  }
  if (req.body?.consent !== true) {
    res.status(400).json({ error: "Please agree to the newsletter before subscribing." });
    return;
  }

  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const globalOptOut = await client.query(
      "SELECT 1 FROM email_unsubscribes WHERE lower(trim(email)) = $1 LIMIT 1",
      [email],
    );
    if (globalOptOut.rows.length > 0) {
      await client.query("ROLLBACK");
      res.status(409).json({ error: "This address is opted out of JCTM email. Contact the ministry for help." });
      return;
    }
    await client.query(
      `INSERT INTO crusade_newsletter_subscribers (email, unsubscribe_token, source_page)
       VALUES ($1, $2, 'crusade_invitation')
       ON CONFLICT (email) DO UPDATE
       SET is_active = true, subscribed_at = now(), unsubscribed_at = NULL`,
      [email, randomBytes(24).toString("hex")],
    );
    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    req.log.error({ err: error }, "Crusade newsletter signup failed");
    res.status(503).json({ error: "The newsletter signup could not be saved. Please try again." });
  } finally {
    client?.release();
  }
});

router.get("/crusade-2026/newsletter-unsubscribe", async (req, res) => {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  if (!/^[a-f0-9]{48}$/.test(token)) {
    res.status(400).type("html").send(buildNewsletterUnsubscribePage("", "This unsubscribe link is invalid.", false));
    return;
  }
  try {
    const found = await pool.query(
      "SELECT id FROM crusade_newsletter_subscribers WHERE unsubscribe_token = $1 AND is_active = true LIMIT 1",
      [token],
    );
    if (!found.rows[0]) {
      res.status(404).type("html").send(buildNewsletterUnsubscribePage("", "This subscription is no longer active.", false));
      return;
    }
    res.type("html").send(buildNewsletterUnsubscribePage(token, "Confirm that you want to stop receiving JCTM newsletters.", true));
  } catch (error) {
    req.log.error({ err: error }, "Newsletter unsubscribe page failed");
    res.status(503).type("html").send(buildNewsletterUnsubscribePage("", "Please try again later.", false));
  }
});

router.post("/crusade-2026/newsletter-unsubscribe", async (req, res) => {
  const token = typeof req.body?.token === "string" ? req.body.token : "";
  if (!/^[a-f0-9]{48}$/.test(token)) {
    res.status(400).type("html").send(buildNewsletterUnsubscribePage("", "This unsubscribe link is invalid.", false));
    return;
  }
  try {
    const result = await pool.query(
      `UPDATE crusade_newsletter_subscribers
       SET is_active = false, unsubscribed_at = now()
       WHERE unsubscribe_token = $1 AND is_active = true
       RETURNING id`,
      [token],
    );
    if (!result.rows[0]) {
      res.status(404).type("html").send(buildNewsletterUnsubscribePage("", "This subscription is no longer active.", false));
      return;
    }
    res.type("html").send(buildNewsletterUnsubscribePage("", "You have been unsubscribed from the JCTM crusade newsletter.", false));
  } catch (error) {
    req.log.error({ err: error }, "Newsletter unsubscribe failed");
    res.status(503).type("html").send(buildNewsletterUnsubscribePage("", "Please try again later.", false));
  }
});

router.get("/crusade-2026/admin/newsletter-subscribers", admin, async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 500);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const visible = `s.is_active = true
    AND NOT EXISTS (SELECT 1 FROM email_unsubscribes u WHERE lower(trim(u.email)) = s.email)`;
  try {
    const [total, subscribers] = await Promise.all([
      pool.query<{ total: string }>(`SELECT count(*)::text AS total FROM crusade_newsletter_subscribers s WHERE ${visible}`),
      pool.query<{ email: string; subscribedAt: string }>(
        `SELECT s.email, s.subscribed_at AS "subscribedAt"
         FROM crusade_newsletter_subscribers s
         WHERE ${visible}
         ORDER BY s.subscribed_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset],
      ),
    ]);
    res.json({ total: Number(total.rows[0]?.total ?? 0), limit, offset, subscribers: subscribers.rows });
  } catch (error) {
    req.log.error({ err: error }, "Admin newsletter subscriber list failed");
    res.status(503).json({ error: "The newsletter list could not be loaded." });
  }
});

router.get("/crusade-2026/admin/newsletter-export", admin, async (req, res) => {
  try {
    const result = await pool.query<{ email: string; subscribedAt: Date; unsubscribeToken: string }>(
      `SELECT s.email, s.subscribed_at AS "subscribedAt", s.unsubscribe_token AS "unsubscribeToken"
       FROM crusade_newsletter_subscribers s
       WHERE s.is_active = true
         AND NOT EXISTS (SELECT 1 FROM email_unsubscribes u WHERE lower(trim(u.email)) = s.email)
       ORDER BY s.subscribed_at ASC`,
    );
    const csvCell = (value: string) => {
      const safe = /^[\s]*[=+\-@\t\r]/.test(value) ? `'${value}` : value;
      return `"${safe.replace(/"/g, '""')}"`;
    };
    const baseUrl = getPublicBaseUrl();
    const rows = [
      ["Email", "Subscribed at", "Unsubscribe URL"].map(csvCell).join(","),
      ...result.rows.map((row) => [
        row.email,
        row.subscribedAt.toISOString(),
        `${baseUrl}/api/crusade-2026/newsletter-unsubscribe?token=${encodeURIComponent(row.unsubscribeToken)}`,
      ].map(csvCell).join(",")),
    ];
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Content-Disposition", 'attachment; filename="jctm-crusade-newsletter.csv"');
    res.type("text/csv").send(`${rows.join("\r\n")}\r\n`);
  } catch (error) {
    req.log.error({ err: error }, "Admin newsletter export failed");
    res.status(503).json({ error: "The newsletter export could not be created." });
  }
});

function buildNewsletterUnsubscribePage(token: string, message: string, showConfirm: boolean): string {
  const confirmation = showConfirm
    ? `<form method="post" action="/api/crusade-2026/newsletter-unsubscribe"><input type="hidden" name="token" value="${token}"><button type="submit">Unsubscribe</button></form>`
    : `<a href="https://jctm.org.ng">Return to JCTM</a>`;
  return `<!doctype html>
    <html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="robots" content="noindex,nofollow"><title>JCTM newsletter preferences</title>
    <style>body{font-family:Arial,sans-serif;background:#071130;color:#fff;min-height:100vh;display:grid;place-items:center;padding:24px}main{max-width:420px;background:#10204a;border-radius:16px;padding:32px;text-align:center}button,a{display:inline-block;margin-top:20px;padding:12px 24px;border:0;border-radius:24px;background:#ffc93c;color:#071130;font-weight:700;text-decoration:none;cursor:pointer}</style></head>
    <body><main><h1>JCTM Newsletter</h1><p>${message}</p>${confirmation}</main></body></html>`;
}
router.get("/crusade-2026/admin", admin, async (req, res) => {
  try { res.json(await readCrusadeCampaign()); }
  catch (error) {
    req.log.error({ err: error }, "Unable to read admin crusade campaign");
    res.status(503).json({ error: "Unable to load event settings" });
  }
});
router.put("/crusade-2026/admin", admin, async (req, res) => {
  const parsed = crusadeCampaignInput.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues.map(i => i.message).join("; ") }); return; }
  try {
    const result = await updateCrusadeCampaign(parsed.data);
    if (!result) { res.status(409).json({ error: "Another administrator updated this event. Reload before saving." }); return; }
    res.json(result);
  } catch (error) {
    req.log.error({ err: error }, "Unable to save crusade campaign");
    res.status(503).json({ error: "The event could not be saved. Your edits have not been published." });
  }
});
router.post("/crusade-2026/admin/flyer", admin, uploadLimit, (req, res) => {
  upload.single("flyer")(req, res, async error => {
    if (error) { res.status(400).json({ error: "Upload one image, no larger than 10 MB." }); return; }
    if (!req.file || !detectImageMimeType(req.file.buffer)) {
      res.status(400).json({ error: "Choose a valid JPG, PNG or WebP image." }); return;
    }
    try {
      const buffer = await sharp(req.file.buffer, { limitInputPixels: 40_000_000 })
        .rotate().resize({ width: 2048, withoutEnlargement: true }).webp({ quality: 86 }).toBuffer();
      const objectPath = await new ObjectStorageService().uploadBuffer(buffer, "image/webp");
      res.status(201).json({ flyerUrl: `/api/storage${objectPath}` });
    } catch (err) {
      req.log.error({ err }, "Unable to upload crusade flyer");
      res.status(503).json({ error: "Flyer upload failed. The existing flyer has not changed." });
    }
  });
});
export default router;
