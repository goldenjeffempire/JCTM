import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { pool } from "@workspace/db";
import { createAdminToken } from "../src/lib/adminAuth.js";
import { SERIES_ID } from "../src/lib/devotion-series/index.js";
const base=`https://${process.env.REPLIT_DEV_DOMAIN}`;
const auth=createAdminToken("livestream");
try {
  const request=async(path:string,token?:string)=>{
    const r=await fetch(base+path,{headers:token?{Authorization:`Bearer ${token}`}:{}});return {status:r.status,data:await r.json()};
  };
  assert.equal((await request("/api/devotion/admin/entries")).status,401);
  assert.equal((await request("/api/devotion/admin/entries",createAdminToken("gallery").token)).status,401);
  const entries=await request(`/api/devotion/admin/entries?series=${SERIES_ID}&pageSize=100`,auth.token);
  assert.equal(entries.status,200);assert.equal(entries.data.total,90);
  assert.equal(entries.data.entries.length,90);
  for(const e of entries.data.entries) for(const field of ["title","topic","scripture","reference","introduction","message","application","closingPrayer","declaration"]) assert.ok(e.content[field],`${e.id} missing ${field}`);
  const page=await request(`/api/devotion/admin/entries?series=${SERIES_ID}&page=2&pageSize=30`,auth.token);
  assert.equal(page.data.entries.length,30);assert.equal(page.data.entries[0].content.seriesDay,31);
  const daily=await request("/api/devotion/daily");
  assert.equal(daily.status,200);
  const historical=await request("/api/devotion/date/"+daily.data.devotion.date);
  assert.deepEqual(historical.data.devotion,daily.data.devotion);
  const history=await request("/api/devotion/history?limit=365");
  assert.ok(history.data.devotions.every((d:{date:string})=>d.date<=daily.data.devotion.date));
  // Development-only test session; uses the existing signing function without
  // reading, printing, or changing the signing secret or any admin passphrase.
  if(process.argv.includes("--browser-session")) await writeFile("/tmp/devotion-editor-test-session.json",JSON.stringify({token:auth.token}),{mode:0o600});
  console.log("PASS live API: role authorization, all 90 complete readings, month pagination, shared daily/historical response, future-date privacy");
}finally{await pool.end();}
