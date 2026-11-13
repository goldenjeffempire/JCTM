import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { pool } from "@workspace/db";
import { createAdminToken } from "../src/lib/adminAuth.js";

const base = `https://${process.env.REPLIT_DEV_DOMAIN}`;
try {
  const publicResponse = await fetch(`${base}/api/crusade-2026`);
  assert.equal(publicResponse.status, 200);
  assert.match(publicResponse.headers.get("cache-control") ?? "", /no-store/);
  const campaign = await publicResponse.json();
  assert.equal(campaign.programs.length, 4);
  assert.equal(campaign.programs.flatMap((p: { startsAt: string[] }) => p.startsAt).length, 6);
  assert.equal((await fetch(`${base}${campaign.flyerUrl}`)).status, 200);
  assert.equal((await fetch(`${base}/api/crusade-2026/admin`)).status, 401);
  const gallery = createAdminToken("gallery").token;
  assert.equal((await fetch(`${base}/api/crusade-2026/admin`, { headers: { Authorization: `Bearer ${gallery}` } })).status, 401);
  const livestream = createAdminToken("livestream").token;
  const headers = { Authorization: `Bearer ${livestream}`, "Content-Type": "application/json" };
  assert.equal((await fetch(`${base}/api/crusade-2026/admin`, { headers })).status, 200);
  assert.equal((await fetch(`${base}/api/crusade-2026/admin`, { method: "PUT", headers, body: JSON.stringify({ ...campaign, flyerUrl: "https://invalid.invalid/test.svg" }) })).status, 400);
  assert.equal((await fetch(`${base}/api/crusade-2026/admin`, { method: "PUT", headers, body: JSON.stringify({ ...campaign, revision: campaign.revision + 100 }) })).status, 409);
  const form = new FormData();
  form.append("flyer", new Blob(["not an image"], { type: "image/png" }), "invalid.png");
  assert.equal((await fetch(`${base}/api/crusade-2026/admin/flyer`, { method: "POST", headers: { Authorization: `Bearer ${livestream}` }, body: form })).status, 400);
  console.log("PASS live campaign: four programs, six starts, official flyer, no-store, admin role guards, invalid input, stale revision and spoofed images");
  if (process.argv.includes("--browser-session")) {
    await writeFile("/tmp/crusade-admin-test-session.json", JSON.stringify({ token: livestream }), { mode: 0o600 });
    console.log("Prepared temporary admin browser session securely; token not logged.");
  }
} finally { await pool.end(); }
