import { pool } from "@workspace/db";
import { NINETY_DAY_SERIES, SERIES_ID } from "./index.js";
import { addLibraryContent, devotionTransaction } from "../devotion-library.js";
import { devotionDate } from "../devotion-engine.js";
import { contentHash, normalizeIdentity, type DevotionContent } from "../devotion-quality.js";

// Explicit, idempotent content installation. It neither edits published history
// nor replaces an existing editor's changes on subsequent starts.
export async function populateNinetyDaySeries() {
  const present=await pool.query("SELECT content->>'seriesDay' AS day FROM devotion_library WHERE source='jctm-series' AND content->>'seriesId'=$1",[SERIES_ID]);
  if(!present.rowCount) {
    const admitted=await addLibraryContent(NINETY_DAY_SERIES,"jctm-series");
    if(admitted.added!==90) {
      const concurrent=await pool.query("SELECT 1 FROM devotion_library WHERE source='jctm-series' AND content->>'seriesId'=$1",[SERIES_ID]);
      if(concurrent.rowCount!==90) throw new Error(`The complete series was not admitted: ${admitted.rejected.map(r=>`${r.title}: ${r.reason}`).join("; ")}`);
    }
  } else if(present.rowCount!==90) {
    throw new Error("The series is partially present; editorial inspection is required before changing its schedule");
  }
  return devotionTransaction(async client=>{
    const rows=await client.query<{topic_key:string;content:DevotionContent;assigned_date:string|null}>(
      "SELECT topic_key,content,assigned_date::text FROM devotion_library WHERE source='jctm-series' AND content->>'seriesId'=$1 ORDER BY (content->>'seriesDay')::int FOR UPDATE",[SERIES_ID]);
    if(rows.rows.every(r=>r.assigned_date)) return {added:0,scheduled:90,alreadyPresent:true};
    if(rows.rows.some(r=>r.assigned_date)) throw new Error("Series dates have been partly edited; existing assignments were preserved");
    const last=await client.query<{date:string}>("SELECT GREATEST(COALESCE(max(date),$1::date),$1::date)::text AS date FROM daily_devotions",[devotionDate()]);
    const start=new Date(last.rows[0]!.date+"T12:00:00Z");
    const entries=rows.rows.map((r,i)=>{
      const date=new Date(start);date.setUTCDate(start.getUTCDate()+i+1);
      const c=r.content;
      return {date:date.toISOString().slice(0,10),owner:r.topic_key,...c,topic_key:normalizeIdentity(c.topic),
        title_key:normalizeIdentity(c.title),content_hash:contentHash(c)};
    });
    await client.query(`INSERT INTO daily_devotions(date,title,scripture,reference,reflection,prophetic_word,prayer_focus,declaration,
      topic,category,introduction,application,scripture_version,topic_key,title_key,content_hash,source_notes,series_id,series_day)
      SELECT date,title,scripture,reference,message,scripture,"closingPrayer",declaration,
        topic,category,introduction,application,"scriptureVersion",topic_key,title_key,content_hash,sources,"seriesId","seriesDay"
      FROM jsonb_to_recordset($1::jsonb) AS x(date date,title text,scripture text,reference text,message text,
        "closingPrayer" text,declaration text,topic text,category text,introduction text,application text,"scriptureVersion" text,
        topic_key text,title_key text,content_hash text,sources jsonb,"seriesId" text,"seriesDay" int)`,[JSON.stringify(entries)]);
    await client.query(`UPDATE devotion_library l SET status='used',assigned_date=x.date FROM
      jsonb_to_recordset($1::jsonb) AS x(owner text,date date) WHERE l.topic_key=x.owner`,[JSON.stringify(entries)]);
    return {added:present.rowCount?0:90,scheduled:90,firstDate:entries[0]!.date,lastDate:entries[89]!.date,alreadyPresent:false};
  });
}
