/**
 * emailUnsubscribe.ts
 *
 * General-purpose email unsubscribe handler for campaign and broadcast emails.
 *
 * GET  /api/unsubscribe?email=<addr>&sig=<hmac>   — HTML confirmation page
 * POST /api/unsubscribe                            — Process opt-out, return HTML success
 *
 * The sig parameter is an HMAC-SHA256 derived from the email address using the
 * server's SESSION_SECRET, ensuring only recipients of genuine JCTM emails can
 * trigger the opt-out (prevents enumeration attacks).
 *
 * On successful opt-out the email is:
 *  1. Added to email_unsubscribes (global opt-out, checked by all campaign workers)
 *  2. Deactivated in devotion_subscribers (if present)
 *  3. Deactivated in event_notification_subscribers (if present)
 */

import { Router, type Request, type Response } from "express";
import {
  verifyUnsubToken,
  addGlobalUnsubscribe,
  isGloballyUnsubscribed,
} from "../lib/email-automation.js";
import { logger } from "../lib/logger.js";

const router = Router();

// ─── HTML helpers ─────────────────────────────────────────────────────────────

function htmlPage(title: string, bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} — JCTM</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #f5f5f0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: #ffffff;
      border-radius: 12px;
      box-shadow: 0 2px 16px rgba(0,0,0,.1);
      max-width: 480px;
      width: 100%;
      overflow: hidden;
    }
    .header {
      background: #1a1a2e;
      padding: 28px 32px;
      text-align: center;
    }
    .header .cross { font-size: 28px; margin-bottom: 8px; }
    .header h1 { color: #fff; font-size: 18px; font-weight: 600; letter-spacing: .3px; }
    .header p  { color: #aaa; font-size: 13px; margin-top: 4px; }
    .body { padding: 32px; }
    .body p { color: #555; line-height: 1.6; font-size: 15px; margin-bottom: 16px; }
    .email-box {
      background: #f8f8f8;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 12px 16px;
      font-family: monospace;
      font-size: 14px;
      color: #333;
      margin-bottom: 24px;
      word-break: break-all;
    }
    .btn {
      display: block;
      width: 100%;
      padding: 14px;
      border: none;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      text-align: center;
      text-decoration: none;
    }
    .btn-danger { background: #c62828; color: #fff; }
    .btn-danger:hover { background: #b71c1c; }
    .btn-primary { background: #1a1a2e; color: #fff; }
    .btn-primary:hover { background: #2d2d4e; }
    .footer { padding: 20px 32px; text-align: center; border-top: 1px solid #f0f0f0; }
    .footer a { color: #888; font-size: 12px; text-decoration: none; }
    .success-icon { font-size: 48px; text-align: center; margin-bottom: 16px; }
    .alert-info { background:#e3f2fd;border-left:4px solid #1976d2;padding:12px 16px;border-radius:4px;font-size:14px;color:#1565c0;margin-bottom:16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="cross">✝</div>
      <h1>Jesus Christ Temple Ministry</h1>
      <p>Digital Sanctuary — Warri, Nigeria</p>
    </div>
    <div class="body">
      ${bodyContent}
    </div>
    <div class="footer">
      <a href="https://jctm.org.ng">Return to JCTM Website</a>
    </div>
  </div>
</body>
</html>`;
}

// ─── GET /api/unsubscribe ─────────────────────────────────────────────────────
//
// Renders a branded confirmation page. The user must explicitly click a button
// to complete the opt-out — this protects against image-load unsubscribes.

router.get("/unsubscribe", async (req: Request, res: Response): Promise<void> => {
  const email = typeof req.query.email === "string" ? req.query.email.trim() : "";
  const sig   = typeof req.query.sig   === "string" ? req.query.sig.trim()   : "";

  if (!email || !sig) {
    res.status(400).send(
      htmlPage(
        "Invalid Link",
        `<p style="color:#c62828">This unsubscribe link is invalid or has expired. Please contact
         <a href="mailto:info@jctm.org.ng">info@jctm.org.ng</a> if you need assistance.</p>`,
      ),
    );
    return;
  }

  if (!verifyUnsubToken(email, sig)) {
    res.status(400).send(
      htmlPage(
        "Invalid Link",
        `<p style="color:#c62828">This unsubscribe link could not be verified. It may have been
         modified or already used. Please contact us directly at
         <a href="mailto:info@jctm.org.ng">info@jctm.org.ng</a>.</p>`,
      ),
    );
    return;
  }

  const alreadyOut = await isGloballyUnsubscribed(email).catch(() => false);
  if (alreadyOut) {
    res.send(
      htmlPage(
        "Already Unsubscribed",
        `<div class="alert-info">You are already unsubscribed from JCTM campaign emails.</div>
         <p>The email address <strong>${email}</strong> is not on our mailing list.</p>
         <a href="https://jctm.org.ng" class="btn btn-primary" style="margin-top:8px">Return to Website</a>`,
      ),
    );
    return;
  }

  res.send(
    htmlPage(
      "Unsubscribe",
      `<h2 style="font-size:20px;font-weight:700;color:#1a1a2e;margin-bottom:16px">Confirm Unsubscription</h2>
       <p>Are you sure you want to unsubscribe from JCTM email notifications?
          You will no longer receive conference reminders, event updates, or ministry broadcasts.</p>
       <div class="email-box">${email}</div>
       <form method="POST" action="/api/unsubscribe">
         <input type="hidden" name="email" value="${email}" />
         <input type="hidden" name="sig"   value="${sig}" />
         <button type="submit" class="btn btn-danger">Yes, Unsubscribe Me</button>
       </form>`,
    ),
  );
});

// ─── POST /api/unsubscribe ────────────────────────────────────────────────────

router.post("/unsubscribe", async (req: Request, res: Response): Promise<void> => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
  const sig   = typeof req.body?.sig   === "string" ? req.body.sig.trim()   : "";

  if (!email || !sig) {
    res.status(400).send(
      htmlPage("Invalid Request", `<p style="color:#c62828">Missing email or signature. Please use the unsubscribe link from your email.</p>`),
    );
    return;
  }

  if (!verifyUnsubToken(email, sig)) {
    res.status(400).send(
      htmlPage("Verification Failed", `<p style="color:#c62828">The unsubscribe signature is invalid. Please contact <a href="mailto:info@jctm.org.ng">info@jctm.org.ng</a> for assistance.</p>`),
    );
    return;
  }

  try {
    await addGlobalUnsubscribe(email, "campaign_email");
    logger.info({ email }, "Email unsubscribed via campaign opt-out link");

    res.send(
      htmlPage(
        "Unsubscribed Successfully",
        `<div class="success-icon">✅</div>
         <h2 style="font-size:20px;font-weight:700;color:#1a1a2e;margin-bottom:16px;text-align:center">You have been unsubscribed</h2>
         <p>The email address <strong>${email}</strong> has been removed from all JCTM campaign and ministry broadcast mailing lists.</p>
         <p>If you believe this was done in error, please email us at
            <a href="mailto:info@jctm.org.ng">info@jctm.org.ng</a> and we will restore your subscription.</p>
         <a href="https://jctm.org.ng" class="btn btn-primary" style="margin-top:16px">Return to JCTM Website</a>`,
      ),
    );
  } catch (err) {
    logger.error({ err, email }, "Email unsubscribe failed");
    res.status(500).send(
      htmlPage(
        "Error",
        `<p style="color:#c62828">Something went wrong processing your unsubscription.
         Please email us directly at <a href="mailto:info@jctm.org.ng">info@jctm.org.ng</a>.</p>`,
      ),
    );
  }
});

export default router;
