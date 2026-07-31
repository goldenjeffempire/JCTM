/**
 * write-ads-txt.mjs — Generates ads.txt for Google AdSense publisher verification.
 *
 * The correct JCTM publisher ID is the authoritative value.
 * The VITE_ADSENSE_CLIENT_ID env var can override it, but ONLY if it matches
 * the expected "ca-pub-DIGITS" format AND the digits match the known correct ID.
 * Any other env var value is ignored to prevent accidental misconfiguration.
 *
 * Google's ads.txt crawler must be able to read this file from the site root.
 * Spec: https://iabtechlab.com/ads-txt/
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

// ── Source of truth — JCTM AdSense publisher ID ──────────────────────────────
// This MUST match the account in https://www.google.com/adsense
// and the <meta name="google-adsense-account"> tag in index.html.
const AUTHORITATIVE_PUBLISHER_ID = "6817509745706083";

// Allow env var override only if it explicitly matches the correct account.
// This prevents a misconfigured secret from silently breaking ad serving.
const rawEnvId = (
  process.env.VITE_ADSENSE_CLIENT_ID ??
  process.env.VITE_GOOGLE_ADSENSE_CLIENT ??
  ""
).trim();

const envDigits = rawEnvId.startsWith("ca-pub-")
  ? rawEnvId.replace("ca-pub-", "")
  : rawEnvId;

const publisherId = /^\d+$/.test(envDigits) && envDigits === AUTHORITATIVE_PUBLISHER_ID
  ? envDigits
  : AUTHORITATIVE_PUBLISHER_ID;

if (publisherId !== AUTHORITATIVE_PUBLISHER_ID) {
  // This branch is unreachable given current logic but is a safety guard.
  process.stderr.write(
    `[write-ads-txt] WARNING: resolved publisher ID ${publisherId} does not match ` +
    `authoritative ID ${AUTHORITATIVE_PUBLISHER_ID} — using authoritative ID.\n`
  );
}

const publicDir = path.resolve("public");
await mkdir(publicDir, { recursive: true });
await writeFile(
  path.join(publicDir, "ads.txt"),
  `google.com, pub-${AUTHORITATIVE_PUBLISHER_ID}, DIRECT, f08c47fec0942fa0\n`,
);

console.log(`[write-ads-txt] ads.txt written: google.com, pub-${AUTHORITATIVE_PUBLISHER_ID}, DIRECT, f08c47fec0942fa0`);
