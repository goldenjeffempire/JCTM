import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { DEVOTION_SEEDS } from "../src/lib/devotion-seeds.js";
import { contentHash, duplicateReason, normalizeIdentity, validateContent, DEVOTION_CATEGORIES } from "../src/lib/devotion-quality.js";
import { devotionDate, reserveDevotionForDate } from "../src/lib/devotion-engine.js";
import { reviewedDrafts, verifyScripture } from "../src/lib/devotion-expansion.js";

let passed = 0;
function check(name: string, work: () => void) {
  work(); passed++; console.log(`PASS ${name}`);
}
const seed = DEVOTION_SEEDS[0]!;
check("64 complete, original reserve readings", () => {
  assert.equal(DEVOTION_SEEDS.length, 64);
  DEVOTION_SEEDS.forEach(validateContent);
  assert.equal(new Set(DEVOTION_SEEDS.map(s => normalizeIdentity(s.title))).size, 64);
  assert.equal(new Set(DEVOTION_SEEDS.map(s => normalizeIdentity(s.topic))).size, 64);
  assert.equal(new Set(DEVOTION_SEEDS.map(s => normalizeIdentity(s.reference))).size, 64);
  for (let i = 0; i < DEVOTION_SEEDS.length; i++) {
    for (let j = i + 1; j < DEVOTION_SEEDS.length; j++) {
      assert.equal(duplicateReason(DEVOTION_SEEDS[i]!, DEVOTION_SEEDS[j]!), null, `${i}/${j} unexpectedly similar`);
    }
  }
});
check("all sixteen categories have four distinct readings", () => {
  for (const category of DEVOTION_CATEGORIES) assert.equal(DEVOTION_SEEDS.filter(s => s.category === category).length, 4);
});
check("title identity ignores case, punctuation and accents", () => {
  assert.match(duplicateReason({ ...seed, title: seed.title.toUpperCase() + "!!!" }, seed)!, /Title/);
  assert.equal(normalizeIdentity("Saviour’s GRÁCE"), normalizeIdentity("Saviours Grace"));
});
check("changing title does not disguise the same topic", () => {
  assert.match(duplicateReason({ ...seed, title: "A Brand New Heading" }, seed)!, /Topic/);
});
check("body reuse is blocked under a new title, topic and passage", () => {
  assert.match(duplicateReason({ ...seed, title: "A Different New Heading", topic: "A completely unrelated subject", reference: "Romans 1:1" }, seed)!, /fingerprint|repeats|duplicate/);
});
check("small edits to a copied message remain detectable", () => {
  assert.match(duplicateReason({ ...seed, title: "A Different New Heading", topic: "A completely unrelated subject", reference: "Romans 1:1", message: seed.message + " Consider this carefully before your next decision." }, seed)!, /repeats|duplicate/);
});
check("incomplete readings are rejected before storage", () => {
  assert.throws(() => validateContent({ ...seed, application: "" }));
  assert.throws(() => validateContent({ ...seed, message: "A short recycled sentence." }));
  assert.throws(() => validateContent({ ...seed, closingPrayer: "" }));
});
check("independent review rejects ambiguous or missing decisions", () => {
  assert.deepEqual(reviewedDrafts([seed], { reviews: [{ index: 0, approved: true }] }), [seed]);
  assert.deepEqual(reviewedDrafts([seed], { reviews: [{ index: 0, approved: false }] }), []);
  assert.throws(() => reviewedDrafts([seed], { reviews: [] }));
  assert.throws(() => reviewedDrafts([seed], { reviews: [{ index: 0, approved: "true" }] }));
  assert.throws(() => reviewedDrafts([seed, seed], { reviews: [{ index: 0, approved: true }, { index: 0, approved: true }] }));
});
check("website and mobile use Nigerian midnight", () => {
  assert.equal(devotionDate(new Date("2026-11-12T22:59:59Z")), "2026-11-12");
  assert.equal(devotionDate(new Date("2026-11-12T23:00:00Z")), "2026-11-13");
});

const scriptureMock = (text: string) => (async () => new Response(JSON.stringify({
  text, translation_id: "kjv", verses: [{}],
}), { status: 200 })) as typeof fetch;
await verifyScripture(seed, scriptureMock(seed.scripture));
await assert.rejects(verifyScripture(seed, scriptureMock("This quotation is invented.")));
await assert.rejects(verifyScripture(seed, (async () => new Response("", { status: 503 })) as typeof fetch));
console.log("PASS verified scripture accepts exact quotations and fails closed on mismatch or outage"); passed++;

// Only this temporary test schema is changed. Existing public readings, library,
// subscribers and deliveries are never mutated by the integration tests.
const schema = `devotion_test_${randomUUID().replaceAll("-", "")}`;
const tomorrow = new Date(`${devotionDate()}T12:00:00Z`); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
const future = tomorrow.toISOString().slice(0, 10);
const prior = "2001-01-01";
async function reserve(date: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL search_path TO "${schema}", public`);
    await client.query("SELECT pg_advisory_xact_lock(147073,683041)");
    const result = await reserveDevotionForDate(client, date);
    await client.query("COMMIT");
    return result;
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
try {
  await pool.query(`CREATE SCHEMA "${schema}"`);
  await pool.query(`CREATE TABLE "${schema}".daily_devotions (LIKE public.daily_devotions INCLUDING ALL)`);
  await pool.query(`CREATE TABLE "${schema}".devotion_library (LIKE public.devotion_library INCLUDING ALL)`);
  await pool.query(`INSERT INTO "${schema}".devotion_library(topic_key,title_key,content_hash,content,category)
    SELECT topic_key,title_key,content_hash,content,category FROM jsonb_to_recordset($1::jsonb)
    AS x(topic_key text,title_key text,content_hash text,content jsonb,category text)`,
  [JSON.stringify(DEVOTION_SEEDS.map(c => ({ topic_key: normalizeIdentity(c.topic), title_key: normalizeIdentity(c.title), content_hash: contentHash(c), content: c, category: c.category })))]);
  for (const date of [prior, future]) {
    await pool.query(`INSERT INTO "${schema}".daily_devotions(date,title,scripture,reference,reflection,prophetic_word,prayer_focus,declaration,published_at)
      VALUES($1,$2,$3,$4,$5,'original encouragement',$6,'original declaration',CASE WHEN $1::date=$7::date THEN now() ELSE NULL END)`,
    [date, seed.title, seed.scripture, seed.reference, seed.message, seed.closingPrayer, prior]);
  }
  const old = await reserve(prior);
  assert.equal(old.devotion.title, seed.title);
  console.log("PASS published historical content remains unchanged"); passed++;
  const concurrent = await Promise.all(Array.from({ length: 6 }, () => reserve(future)));
  assert.equal(new Set(concurrent.map(r => r.devotion.title)).size, 1);
  assert.notEqual(concurrent[0]!.devotion.title, seed.title);
  assert.equal(concurrent.filter(r => r.cached === false).length, 1);
  console.log("PASS six concurrent requests reserve one unused devotion for one date"); passed++;
  const preserved = await pool.query(`SELECT content FROM "${schema}".devotion_library WHERE source='legacy-review'`);
  assert.equal(preserved.rows[0].content.title, seed.title);
  assert.equal(preserved.rows[0].content.reflection, seed.message);
  console.log("PASS superseded future duplicate is preserved in review"); passed++;
  const next = new Date(tomorrow); next.setUTCDate(next.getUTCDate() + 1);
  const following = await reserve(next.toISOString().slice(0, 10));
  assert.notEqual(following.devotion.topic, concurrent[0]!.devotion.topic);
  assert.notEqual(following.devotion.reference, concurrent[0]!.devotion.reference);
  console.log("PASS different dates cannot reserve the same topic or passage"); passed++;
  await pool.query(`UPDATE "${schema}".devotion_library SET status='review' WHERE status='ready'`);
  next.setUTCDate(next.getUTCDate() + 1);
  await assert.rejects(reserve(next.toISOString().slice(0, 10)), /No unused/);
  console.log("PASS exhaustion stops publication instead of recycling"); passed++;
  // An unvalidated duplicate that becomes due must not be served merely because
  // its date is now today. This guards the midnight/outage boundary.
  await pool.query(`INSERT INTO "${schema}".daily_devotions(date,title,scripture,reference,reflection,prophetic_word,prayer_focus,declaration)
    VALUES($1,$2,$3,$4,$5,'original encouragement',$6,'original declaration')`,
  [devotionDate(), seed.title, seed.scripture, seed.reference, seed.message, seed.closingPrayer]);
  await assert.rejects(reserve(devotionDate()), /No unused/);
  console.log("PASS a due legacy duplicate is never served during reserve exhaustion"); passed++;
  console.log(`${passed} devotion checks passed`);
} finally {
  // Schema name is generated locally, and contains only this run's fixtures.
  await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await pool.end();
}
