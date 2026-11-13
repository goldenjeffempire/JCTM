import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { pool } from "@workspace/db";
import { DEFAULT_CRUSADE, nextCrusadeOccurrence } from "@workspace/content";
import { createCrusadeRepository, crusadeCampaignInput, publicCrusade } from "../src/lib/crusade-campaign.js";

const schema = `crusade_test_${randomUUID().replaceAll("-", "")}`;
const testPool = new pg.Pool({ ...pool.options, options: `-c search_path=${schema},public`, max: 2 });
let checks = 0;
const pass = (label: string) => { checks++; console.log(`PASS ${label}`); };
try {
  assert(crusadeCampaignInput.safeParse(DEFAULT_CRUSADE).success);
  for (const patch of [
    { flyerUrl: "https://evil.invalid/tracker.svg" },
    { flyerUrl: "/images/../private.png" },
    { revision: -1 },
    { contactEmail: "not-an-email" },
    { programs: [] },
    { programs: DEFAULT_CRUSADE.programs.map(p => ({ ...p, startsAt: ["garbage"] })) },
    { programs: DEFAULT_CRUSADE.programs.map(p => ({ ...p, id: "same" })) },
    { programs: DEFAULT_CRUSADE.programs.map(p => ({ ...p, startsAt: [p.startsAt[0], p.startsAt[0]] })) },
  ]) assert(!crusadeCampaignInput.safeParse({ ...DEFAULT_CRUSADE, ...patch }).success);
  pass("official schedule validates; malformed inputs, unsafe assets, duplicate IDs and times rejected");

  const transitions = [
    ["2026-12-28T06:59:59Z", "2026-12-28T08:00:00+01:00"],
    ["2026-12-28T07:00:00Z", "2026-12-29T08:00:00+01:00"],
    ["2026-12-29T07:00:00Z", "2026-12-30T08:00:00+01:00"],
    ["2026-12-30T07:00:00Z", "2026-12-31T20:00:00+01:00"],
    ["2026-12-31T19:00:00Z", "2027-01-01T20:00:00+01:00"],
    ["2027-01-01T19:00:00Z", "2027-01-03T08:00:00+01:00"],
  ];
  for (const [now, next] of transitions)
    assert.equal(nextCrusadeOccurrence(DEFAULT_CRUSADE, Date.parse(now))?.startsAt, next);
  assert.equal(nextCrusadeOccurrence(DEFAULT_CRUSADE, Date.parse("2027-01-03T07:00:00Z")), null);
  pass("all six Nigeria-time starts advance correctly, including daily baptism and year rollover");
  assert.equal(publicCrusade({ ...DEFAULT_CRUSADE, published: false }), null);
  const hidden = { ...DEFAULT_CRUSADE, programs: DEFAULT_CRUSADE.programs.map((p, i) => ({ ...p, published: i !== 0 })) };
  assert.equal(publicCrusade(hidden)?.programs.length, 3);
  assert.equal(nextCrusadeOccurrence(hidden, Date.parse("2026-12-27T00:00:00Z"))?.program.id, "last-crusade");
  pass("unpublished campaign and programs stay out of public schedules and countdowns");

  await pool.query(`CREATE SCHEMA "${schema}"`);
  const store = createCrusadeRepository(testPool);
  const initial = await store.readCrusadeCampaign();
  assert.equal(initial.programs.length, 4);
  assert.equal(initial.revision, 0);
  assert.equal(initial.contactPhone, DEFAULT_CRUSADE.contactPhone);
  assert.equal(initial.contactEmail, DEFAULT_CRUSADE.contactEmail);
  await testPool.query("UPDATE ministry_campaigns SET content=content-'contactPhone'-'contactEmail'");
  const legacyStore = createCrusadeRepository(testPool);
  const migrated = await legacyStore.readCrusadeCampaign();
  assert.equal(migrated.contactPhone, DEFAULT_CRUSADE.contactPhone);
  assert.equal(migrated.contactEmail, DEFAULT_CRUSADE.contactEmail);
  assert.deepEqual(migrated.programs, initial.programs);
  assert.equal(migrated.revision, initial.revision);
  pass("legacy campaigns gain official contact metadata without changing schedules or revision");
  const updated = await store.updateCrusadeCampaign({ ...initial, title: "Persisted editorial update", venue: "A corrected auditorium address in Effurun, Nigeria", contactPhone: "+234 800 000 0000", contactEmail: "office@example.org" });
  assert.equal(updated?.revision, 1);
  assert.equal((await store.readCrusadeCampaign()).title, "Persisted editorial update");
  const revisions = await testPool.query("SELECT content,revision FROM ministry_campaign_revisions");
  assert.equal(revisions.rows.length, 1);
  assert.equal(revisions.rows[0].content.title, DEFAULT_CRUSADE.title);
  pass("database edits persist and preserve complete original campaign revisions");
  assert.equal(await store.updateCrusadeCampaign(initial), null);
  assert.equal((await store.readCrusadeCampaign()).revision, 1);
  pass("stale administrator saves cannot overwrite newer changes");
  const newInstance = createCrusadeRepository(testPool);
  await newInstance.ensureCrusadeCampaign();
  assert.equal((await newInstance.readCrusadeCampaign()).title, "Persisted editorial update");
  assert.equal((await newInstance.readCrusadeCampaign()).contactPhone, "+234 800 000 0000");
  assert.equal((await newInstance.readCrusadeCampaign()).contactEmail, "office@example.org");
  pass("restart and idempotent seed never replace administrator edits");
  const [a, b] = await Promise.all([
    store.updateCrusadeCampaign({ ...updated!, published: false }),
    newInstance.updateCrusadeCampaign({ ...updated!, title: "Conflicting edit" }),
  ]);
  assert.equal([a, b].filter(Boolean).length, 1);
  assert.equal((await store.readCrusadeCampaign()).revision, 2);
  pass("concurrent saves are atomic and exactly one wins");
  console.log(`${checks} crusade checks passed; all data isolated from ministry records`);
} finally {
  await testPool.end();
  await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await pool.end();
}
