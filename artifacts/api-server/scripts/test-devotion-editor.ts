import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { createEntry,editEntry,scheduleEntry,setEntryVisibility,assertDate } from "../src/lib/devotion-editor.js";
import { reserveDevotionForDate,devotionDate,devotionFromRow } from "../src/lib/devotion-engine.js";
import { NINETY_DAY_SERIES } from "../src/lib/devotion-series/index.js";
import { contentHash } from "../src/lib/devotion-quality.js";
import type { DevotionClient } from "../src/lib/devotion-library.js";

const schema=`devotion_editor_test_${randomUUID().replaceAll("-","")}`;
let checks=0;
const pass=(name:string)=>{console.log("PASS "+name);checks++;};
async function tx<T>(work:(c:DevotionClient)=>Promise<T>) {
  const c=await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query(`SET LOCAL search_path TO "${schema}",public`);
    await c.query("SELECT pg_advisory_xact_lock(147073,683041)");
    const result=await work(c);await c.query("COMMIT");return result;
  }catch(e){await c.query("ROLLBACK");throw e;}finally{c.release();}
}
const first=NINETY_DAY_SERIES[0]!,second=NINETY_DAY_SERIES[1]!;
try {
  await pool.query(`CREATE SCHEMA "${schema}"`);
  for(const table of ["daily_devotions","devotion_library","devotion_identity_history"]) await pool.query(`CREATE TABLE "${schema}".${table} (LIKE public.${table} INCLUDING ALL)`);
  await pool.query(`CREATE TABLE "${schema}".devotion_revisions(id bigserial PRIMARY KEY,owner text,original_date date,content jsonb,reason text,created_at timestamptz DEFAULT now())`);
  assert.throws(()=>assertDate("2026-02-31"));assert.throws(()=>assertDate("garbage"));pass("invalid calendar dates rejected");
  const created=await tx(c=>createEntry(c,first));
  await assert.rejects(tx(c=>createEntry(c,first)),/Title|Topic|fingerprint/);pass("duplicate draft creation blocked");
  const edited={...first,title:"The Instruction That Comes Home with Us"};
  await tx(c=>editEntry(c,created.id,0,edited));
  await assert.rejects(tx(c=>editEntry(c,created.id,0,first)),/another session/);pass("edits persist with optimistic concurrency protection");
  await assert.rejects(tx(c=>createEntry(c,{...second,title:first.title})),/Title|reserved/);pass("an earlier edited title remains permanently reserved");
  await tx(c=>scheduleEntry(c,created.id,1,"2099-01-01"));
  const other=await tx(c=>createEntry(c,second));
  await assert.rejects(tx(c=>scheduleEntry(c,other.id,0,"2099-01-01")),/already has/);pass("occupied dates cannot overwrite another reading");
  await tx(c=>scheduleEntry(c,created.id,2,"2099-01-02"));
  assert.equal((await pool.query(`SELECT count(*)::int AS n FROM "${schema}".daily_devotions WHERE date='2099-01-01'`)).rows[0].n,0);
  pass("moving an unpublished reading clears only its old reservation");
  await tx(c=>setEntryVisibility(c,created.id,3,false));
  await assert.rejects(tx(c=>reserveDevotionForDate(c,"2099-01-02")),/paused/);pass("paused schedules cannot be automatically published or replaced");
  await tx(c=>setEntryVisibility(c,created.id,4,true));
  await tx(c=>scheduleEntry(c,created.id,5,devotionDate()));
  const published=await tx(c=>reserveDevotionForDate(c,devotionDate()));
  assert.equal(published.devotion.declaration,first.declaration);
  assert.equal(published.devotion.seriesDay,1);assert.equal(published.devotion.sources?.[0]?.id,first.sources?.[0]?.id);
  assert.equal(published.devotion.message,first.message);pass("due-date publication retains declaration, provenance and full shared API content");
  const before=JSON.stringify(published.devotion);
  await assert.rejects(tx(c=>editEntry(c,created.id,6,{...first,message:first.message+" Another change."})),/preserved/);
  await assert.rejects(tx(c=>scheduleEntry(c,created.id,6,"2099-01-03")),/cannot be moved/);pass("published content cannot be edited or moved to a second date");
  await tx(c=>setEntryVisibility(c,created.id,6,false));
  await assert.rejects(tx(c=>reserveDevotionForDate(c,devotionDate())),/paused/);
  await tx(c=>setEntryVisibility(c,created.id,7,true));
  const restored=await tx(c=>reserveDevotionForDate(c,devotionDate()));
  assert.equal(JSON.stringify(restored.devotion),before);pass("unpublish and restore preserve every published content field");
  const stored=await pool.query(`SELECT *,date::text FROM "${schema}".daily_devotions WHERE date=$1`,[devotionDate()]);
  assert.equal(JSON.stringify(devotionFromRow(stored.rows[0])),before);pass("website, mobile and admin share the same canonical content mapping");
  assert.equal(contentHash(first),contentHash(edited));pass("title edits do not disguise body fingerprints");
  console.log(`${checks} editorial checks passed`);
}finally {
  await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await pool.end();
}
