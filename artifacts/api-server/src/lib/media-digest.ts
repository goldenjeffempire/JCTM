/**
 * media-digest.ts — Daily admin digest email for download activity.
 *
 * Sends a concise HTML summary to every member with role = 'admin' or 'pastor'
 * at 7:00 AM WAT (= 6:00 AM UTC) each day, covering:
 *   • Total downloads in the last 24 h (job_created / download_served events)
 *   • Format and quality breakdown
 *   • Top 5 most-downloaded sermons
 *   • Auto-blocks fired overnight
 *   • Currently blocked IP count
 *
 * If SMTP is not configured the function is a no-op (logs a debug line).
 */

import { pool } from "@workspace/db";
import { sendWithRetry, isEmailConfigured, getPublicBaseUrl } from "./email-engine.js";
import { GUARD_HIGH_1H, GUARD_HIGH_24H } from "./media-abuse-guard.js";
import pino from "pino";
import type { Logger } from "pino";

const logger = pino({ name: "media-digest" });

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtBytes(b: number): string {
  if (b < 1024)             return `${b} B`;
  if (b < 1024 * 1024)      return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 ** 3)        return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}

function pct(n: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((n / total) * 100)}%`;
}

// ─── Data gathering ───────────────────────────────────────────────────────────

interface DigestData {
  jobsCreated:     number;
  jobsReady:       number;
  jobsFailed:      number;
  bytesServed:     number;
  downloadsServed: number;
  topSermons:      { videoId: string; sermonTitle: string | null; count: number; format: string }[];
  autoBlockedLast24h: { ip: string; reason: string; blockedAt: string }[];
  totalBlocked:    number;
  formatBreakdown: { format: string; count: number }[];
  qualityBreakdown:{ quality: string; count: number }[];
}

async function gatherDigestData(): Promise<DigestData> {
  const [
    jobStats,
    byteStats,
    topSermons,
    autoBlocked,
    totalBlocked,
    formatBreakdown,
    qualityBreakdown,
  ] = await Promise.all([
    // Jobs created/ready/failed in last 24 h
    pool.query<{ created: string; ready: string; failed: string }>(`
      SELECT
        COUNT(*)                                         AS created,
        COUNT(*) FILTER (WHERE status = 'ready')        AS ready,
        COUNT(*) FILTER (WHERE status = 'failed')       AS failed
      FROM media_download_jobs
      WHERE created_at >= now() - INTERVAL '24 hours'
    `),

    // Bytes served and download count from audit log
    pool.query<{ bytes: string; count: string }>(`
      SELECT
        COALESCE(SUM(bytes_served), 0) AS bytes,
        COUNT(*)                       AS count
      FROM media_audit_log
      WHERE event = 'download_served'
        AND created_at >= now() - INTERVAL '24 hours'
    `),

    // Top 5 sermons by download_served events
    pool.query<{ video_id: string; sermon_title: string | null; count: string; format: string }>(`
      SELECT a.video_id,
             s.title AS sermon_title,
             COUNT(*) AS count,
             MODE() WITHIN GROUP (ORDER BY a.format) AS format
        FROM media_audit_log a
        LEFT JOIN sermon_data s ON s.video_id = a.video_id
       WHERE a.event = 'download_served'
         AND a.created_at >= now() - INTERVAL '24 hours'
       GROUP BY a.video_id, s.title
       ORDER BY count DESC
       LIMIT 5
    `),

    // Auto-blocks in last 24 h
    pool.query<{ ip: string; reason: string; created_at: Date }>(`
      SELECT ip, reason, created_at
        FROM blocked_ips
       WHERE blocked_by = 'auto-guard'
         AND created_at >= now() - INTERVAL '24 hours'
       ORDER BY created_at DESC
    `),

    // Total currently blocked IPs
    pool.query<{ count: string }>(`SELECT COUNT(*) AS count FROM blocked_ips`),

    // Format breakdown (last 24h jobs)
    pool.query<{ format: string; count: string }>(`
      SELECT format, COUNT(*) AS count
        FROM media_download_jobs
       WHERE created_at >= now() - INTERVAL '24 hours'
       GROUP BY format
       ORDER BY count DESC
    `),

    // Quality breakdown (last 24h jobs)
    pool.query<{ quality: string; count: string }>(`
      SELECT quality, COUNT(*) AS count
        FROM media_download_jobs
       WHERE created_at >= now() - INTERVAL '24 hours'
       GROUP BY quality
       ORDER BY count DESC
    `),
  ]);

  return {
    jobsCreated:     Number(jobStats.rows[0]?.created  ?? 0),
    jobsReady:       Number(jobStats.rows[0]?.ready    ?? 0),
    jobsFailed:      Number(jobStats.rows[0]?.failed   ?? 0),
    bytesServed:     Number(byteStats.rows[0]?.bytes   ?? 0),
    downloadsServed: Number(byteStats.rows[0]?.count   ?? 0),
    topSermons: topSermons.rows.map(r => ({
      videoId:     r.video_id,
      sermonTitle: r.sermon_title ?? null,
      count:       Number(r.count),
      format:      r.format ?? "mp3",
    })),
    autoBlockedLast24h: autoBlocked.rows.map(r => ({
      ip:        r.ip,
      reason:    r.reason,
      blockedAt: r.created_at.toISOString(),
    })),
    totalBlocked:     Number(totalBlocked.rows[0]?.count ?? 0),
    formatBreakdown:  formatBreakdown.rows.map(r => ({ format: r.format, count: Number(r.count) })),
    qualityBreakdown: qualityBreakdown.rows.map(r => ({ quality: r.quality, count: Number(r.count) })),
  };
}

async function getAdminEmails(): Promise<{ email: string; firstName: string }[]> {
  const { rows } = await pool.query<{ email: string; first_name: string }>(
    `SELECT email, first_name FROM member_auth WHERE role IN ('admin','pastor') ORDER BY first_name`,
  );
  return rows.map(r => ({ email: r.email, firstName: r.first_name }));
}

// ─── HTML builder ─────────────────────────────────────────────────────────────

function qualityLabel(q: string): string {
  const map: Record<string, string> = { low: "360p", medium: "480p", high: "720p HD", ultra: "1080p Full HD" };
  return map[q] ?? q;
}

function buildDigestHtml(data: DigestData, date: string, baseUrl: string): string {
  const successRate = pct(data.jobsReady, data.jobsCreated);
  const topTable = data.topSermons.length === 0
    ? `<tr><td colspan="3" style="text-align:center;color:#6b7280;padding:12px 0;">No downloads recorded in the last 24 hours.</td></tr>`
    : data.topSermons.map((s, i) =>
        `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-weight:600;color:#374151;width:32px;">${i + 1}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;">
            <a href="https://youtu.be/${s.videoId}" style="color:#4f46e5;text-decoration:none;">${s.sermonTitle ?? s.videoId}</a>
            <span style="font-size:11px;color:#9ca3af;margin-left:6px;">${s.format.toUpperCase()}</span>
          </td>
          <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:700;color:#1f2937;">${s.count}</td>
        </tr>`,
      ).join("");

  const autoBlockRows = data.autoBlockedLast24h.length === 0
    ? `<tr><td colspan="2" style="text-align:center;color:#6b7280;padding:10px 0;font-size:13px;">No auto-blocks fired in the last 24 hours ✓</td></tr>`
    : data.autoBlockedLast24h.map(b =>
        `<tr>
          <td style="padding:6px 12px;border-bottom:1px solid #fee2e2;font-family:monospace;font-size:12px;color:#dc2626;">${b.ip}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #fee2e2;font-size:12px;color:#6b7280;">${b.reason}</td>
        </tr>`,
      ).join("");

  const qualRows = data.qualityBreakdown.map(q =>
    `<span style="display:inline-block;margin:0 6px 6px 0;padding:3px 10px;border-radius:99px;background:#f3f4f6;font-size:12px;color:#374151;">${qualityLabel(q.quality)} <strong>${q.count}</strong></span>`,
  ).join("");

  const fmtRows = data.formatBreakdown.map(f =>
    `<span style="display:inline-block;margin:0 6px 6px 0;padding:3px 10px;border-radius:99px;background:#ede9fe;font-size:12px;color:#4f46e5;">${f.format.toUpperCase()} <strong>${f.count}</strong></span>`,
  ).join("");

  const alertColor = data.autoBlockedLast24h.length > 0 ? "#fef2f2" : "#f0fdf4";
  const alertBorder = data.autoBlockedLast24h.length > 0 ? "#fca5a5" : "#86efac";
  const alertTitle  = data.autoBlockedLast24h.length > 0
    ? `⚠️ ${data.autoBlockedLast24h.length} IP${data.autoBlockedLast24h.length !== 1 ? "s" : ""} auto-blocked overnight`
    : "✅ No abuse detected overnight";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1e1b4b 0%,#4f46e5 100%);padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">JCTM Digital Sanctuary</h1>
            <p style="margin:6px 0 0;color:#c7d2fe;font-size:14px;">Admin Download Digest — ${date}</p>
          </td>
        </tr>

        <!-- Summary stats -->
        <tr>
          <td style="padding:28px 40px 0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:0 8px 0 0;" width="33%">
                  <div style="background:#f5f3ff;border-radius:10px;padding:16px 18px;text-align:center;">
                    <p style="margin:0;font-size:28px;font-weight:800;color:#4f46e5;">${data.downloadsServed}</p>
                    <p style="margin:4px 0 0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;">Files served</p>
                  </div>
                </td>
                <td style="padding:0 8px;" width="33%">
                  <div style="background:#f0fdf4;border-radius:10px;padding:16px 18px;text-align:center;">
                    <p style="margin:0;font-size:28px;font-weight:800;color:#16a34a;">${successRate}</p>
                    <p style="margin:4px 0 0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;">Success rate</p>
                  </div>
                </td>
                <td style="padding:0 0 0 8px;" width="33%">
                  <div style="background:#fff7ed;border-radius:10px;padding:16px 18px;text-align:center;">
                    <p style="margin:0;font-size:28px;font-weight:800;color:#ea580c;">${fmtBytes(data.bytesServed)}</p>
                    <p style="margin:4px 0 0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;">Bandwidth</p>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Job breakdown sub-row -->
        <tr>
          <td style="padding:12px 40px 0;">
            <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
              ${data.jobsCreated} jobs created &nbsp;·&nbsp;
              <span style="color:#16a34a;">${data.jobsReady} ready</span> &nbsp;·&nbsp;
              <span style="color:#dc2626;">${data.jobsFailed} failed</span>
            </p>
          </td>
        </tr>

        <!-- Format & quality pills -->
        ${(data.formatBreakdown.length + data.qualityBreakdown.length) > 0 ? `
        <tr>
          <td style="padding:20px 40px 0;">
            <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;">Formats</p>
            ${fmtRows || '<span style="font-size:12px;color:#9ca3af;">None</span>'}
            <p style="margin:10px 0 8px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;">Quality tiers</p>
            ${qualRows || '<span style="font-size:12px;color:#9ca3af;">None</span>'}
          </td>
        </tr>` : ""}

        <!-- Top sermons -->
        <tr>
          <td style="padding:24px 40px 0;">
            <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#1f2937;">Top Downloaded Sermons (last 24 h)</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:8px;overflow:hidden;border:1px solid #f3f4f6;">
              <thead>
                <tr style="background:#f9fafb;">
                  <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;" width="32">#</th>
                  <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;">Sermon</th>
                  <th style="padding:8px 12px;text-align:right;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;">Downloads</th>
                </tr>
              </thead>
              <tbody>${topTable}</tbody>
            </table>
          </td>
        </tr>

        <!-- Auto-block summary -->
        <tr>
          <td style="padding:24px 40px 0;">
            <div style="background:${alertColor};border:1px solid ${alertBorder};border-radius:10px;padding:16px 20px;">
              <p style="margin:0 0 10px;font-size:14px;font-weight:700;color:#1f2937;">${alertTitle}</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${autoBlockRows}
              </table>
              <p style="margin:10px 0 0;font-size:12px;color:#6b7280;">
                Thresholds: &gt;${GUARD_HIGH_1H} downloads/hour or &gt;${GUARD_HIGH_24H} downloads/24 h.
                Total IPs currently blocked: <strong>${data.totalBlocked}</strong>.
              </p>
            </div>
          </td>
        </tr>

        <!-- Admin link -->
        <tr>
          <td style="padding:24px 40px 28px;text-align:center;">
            <a href="${baseUrl}/admin" style="display:inline-block;padding:11px 28px;background:#4f46e5;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">
              Open Admin Dashboard →
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:18px 40px;text-align:center;border-top:1px solid #f3f4f6;">
            <p style="margin:0;font-size:11px;color:#9ca3af;">
              Jesus Christ Temple Ministry · Warri, Nigeria<br>
              This digest is sent automatically to platform administrators at 7 AM WAT daily.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Public send function ─────────────────────────────────────────────────────

export async function sendMediaDigest(log: Logger = logger): Promise<void> {
  if (!isEmailConfigured()) {
    log.debug("Media digest skipped — SMTP not configured");
    return;
  }

  const admins = await getAdminEmails();
  if (admins.length === 0) {
    log.info("Media digest skipped — no admin/pastor accounts found");
    return;
  }

  const data    = await gatherDigestData();
  const date    = new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const baseUrl = getPublicBaseUrl();
  const html    = buildDigestHtml(data, date, baseUrl);
  const from    = process.env.SMTP_FROM ?? `JCTM Admin <no-reply@jctm.org.ng>`;
  const subject = `JCTM Download Digest — ${date}`;

  let sent = 0;
  for (const admin of admins) {
    try {
      await sendWithRetry({ from, to: admin.email, subject, html }, log, "media-digest");
      sent++;
    } catch (err) {
      log.warn({ err, to: admin.email }, "Media digest send failed for recipient (non-fatal)");
    }
  }

  log.info(
    { sent, total: admins.length, jobsCreated: data.jobsCreated, autoBlocked: data.autoBlockedLast24h.length },
    "Media digest sent",
  );
}
