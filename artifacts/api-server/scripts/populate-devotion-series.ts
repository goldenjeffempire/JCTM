import assert from "node:assert/strict";
import { pool } from "@workspace/db";
import { DEVOTION_SCHEMA_SQL } from "../src/lib/devotion-schema.js";
import { NINETY_DAY_SERIES, SERIES_ID } from "../src/lib/devotion-series/index.js";
import { populateNinetyDaySeries } from "../src/lib/devotion-series/populate.js";
import { inventory } from "../src/lib/devotion-library.js";
import { contentHash,duplicateReason,normalizeIdentity,validateContent } from "../src/lib/devotion-quality.js";

try {
  await pool.query(DEVOTION_SCHEMA_SQL);
  const checksum=async()=> (await pool.query(`SELECT count(*)::int AS count,md5(string_agg(
    jsonb_build_array(date,title,scripture,reference,reflection,prophetic_word,prayer_focus,declaration)::text,'' ORDER BY date)) AS hash
    FROM daily_devotions WHERE published_at IS NOT NULL`)).rows[0];
  const before=await checksum();
  assert.equal(NINETY_DAY_SERIES.length,90);
  const client=await pool.connect();
  let previous;
  try {previous=await inventory(client);} finally {client.release();}
  const installed=await pool.query("SELECT count(*)::int AS count FROM devotion_library WHERE source='jctm-series' AND content->>'seriesId'=$1",[SERIES_ID]);
  const accepted: typeof NINETY_DAY_SERIES = [];
  for(const [i,raw] of NINETY_DAY_SERIES.entries()) {
    const c=validateContent(raw);
    assert.equal(c.seriesDay,i+1);
    assert.ok(c.declaration && c.sources?.length);
    assert.ok(c.message.split(/\s+/).length>=130,`Day ${i+1} needs a more substantial message`);
    for(const old of [...accepted,...(installed.rows[0].count?[]:previous)]) {
      const reason=duplicateReason(c,old);
      assert.equal(reason,null,`Day ${i+1} "${c.title}" versus "${old.title}": ${reason}`);
    }
    accepted.push(c);
  }
  assert.equal(new Set(accepted.map(c=>normalizeIdentity(c.title))).size,90);
  assert.equal(new Set(accepted.map(c=>normalizeIdentity(c.topic))).size,90);
  assert.equal(new Set(accepted.map(contentHash)).size,90);
  console.log("PASS 90 complete authored readings, unique specific lessons, titles, passages and bodies; provenance and declarations present");
  if(!process.argv.includes("--audit-only")) {
    console.log(await populateNinetyDaySeries());
    assert.deepEqual(await checksum(),before,"Published archive changed");
    const stored=await pool.query(`SELECT count(*)::int AS count,count(DISTINCT date)::int AS dates,
      count(DISTINCT topic_key)::int AS topics,count(DISTINCT title_key)::int AS titles,
      min(date)::text AS first,max(date)::text AS last FROM daily_devotions WHERE series_id=$1`,[SERIES_ID]);
    assert.equal(stored.rows[0].count,90);assert.equal(stored.rows[0].dates,90);
    assert.equal(stored.rows[0].topics,90);assert.equal(stored.rows[0].titles,90);
    assert.equal((Date.parse(stored.rows[0].last)-Date.parse(stored.rows[0].first))/86400000,89);
    console.log("PASS complete series stored on 90 consecutive dates; published archive unchanged",stored.rows[0],before);
  }
}catch(error) {console.error(error instanceof Error?error.message:"Series population failed");process.exitCode=1;}
finally {await pool.end();}
