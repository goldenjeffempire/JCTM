import { pool } from "@workspace/db";
import { devotionDate } from "./devotion-engine.js";
import { contentHash, duplicateReason, normalizeIdentity, validateContent, type DevotionContent } from "./devotion-quality.js";
import { inventory, type DevotionClient, type StoredDevotion } from "./devotion-library.js";

export class EditorialError extends Error {
  constructor(message: string, public status = 409) { super(message); }
}
export const assertDate = (date: unknown): string => {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      isNaN(Date.parse(date+"T12:00:00Z")) || new Date(date+"T12:00:00Z").toISOString().slice(0,10)!==date) throw new EditorialError("A real calendar date is required", 400);
  return date;
};
export function editorialContent(input: unknown): DevotionContent {
  const c = validateContent(input);
  if (!c.declaration) throw new EditorialError("A complete daily declaration is required", 422);
  return c;
}
type LibraryRow = { topic_key:string; content:DevotionContent; status:string; assigned_date:string|null; revision:number; paused:boolean };
export function historicalContent(d: StoredDevotion): DevotionContent {
  return { title:d.title,topic:d.topic??d.title,category:d.category??"Christian Living",reference:d.reference,
    scripture:d.scripture,scriptureVersion:d.scripture_version??"",introduction:d.introduction??"",
    message:d.reflection,application:d.application??"",closingPrayer:d.prayer_focus,declaration:d.declaration,
    sources:d.source_notes??[],seriesId:d.series_id??undefined,seriesDay:d.series_day??undefined };
}
async function load(client: DevotionClient, id: string, revision: unknown) {
  if (!Number.isInteger(revision) || Number(revision)<0) throw new EditorialError("A current revision is required",400);
  let library: LibraryRow | undefined;
  let daily: StoredDevotion | undefined;
  if (id.startsWith("historical:")) {
    const date=assertDate(id.slice(11));
    const d=await client.query<StoredDevotion>("SELECT *,date::text FROM daily_devotions WHERE date=$1 FOR UPDATE",[date]); daily=d.rows[0];
    // A historical identifier cannot bypass the revision on a linked library row.
    const linked=await client.query("SELECT 1 FROM devotion_library WHERE assigned_date=$1",[date]);
    if (linked.rowCount) throw new EditorialError("Use the current library identifier for this reading");
  } else {
    const l=await client.query<LibraryRow>("SELECT *,assigned_date::text FROM devotion_library WHERE topic_key=$1 AND source<>'legacy-review' FOR UPDATE",[id]); library=l.rows[0];
    if(library?.assigned_date) daily=(await client.query<StoredDevotion>("SELECT *,date::text FROM daily_devotions WHERE date=$1 FOR UPDATE",[library.assigned_date])).rows[0];
  }
  if(!library && !daily) throw new EditorialError("Reading not found",404);
  if(Number(library?.revision ?? daily?.revision ?? 0)!==revision) throw new EditorialError("This reading changed in another session");
  return {library,daily};
}
async function validateUnique(client:DevotionClient, content:DevotionContent, owner?:string) {
  for(const previous of await inventory(client,owner)) {
    const reason=duplicateReason(content,previous);
    if(reason) throw new EditorialError(reason);
  }
  const history=await client.query("SELECT 1 FROM devotion_identity_history WHERE ((kind='title' AND identity=$1) OR (kind='topic' AND identity=$2)) AND owner IS DISTINCT FROM $3 LIMIT 1",
    [normalizeIdentity(content.title),normalizeIdentity(content.topic),owner??null]);
  if(history.rowCount) throw new EditorialError("This title or topic was used by an earlier version");
}
export async function rememberIdentity(client:DevotionClient,content:DevotionContent,owner:string) {
  await client.query(`INSERT INTO devotion_identity_history(kind,identity,owner) VALUES('title',$1,$3),('topic',$2,$3)
    ON CONFLICT DO NOTHING`,[normalizeIdentity(content.title),normalizeIdentity(content.topic),owner]);
}
async function saveDate(client:DevotionClient,content:DevotionContent,date:string,revision:number,hidden=false) {
  const c=content;
  await client.query(`INSERT INTO daily_devotions(date,title,scripture,reference,reflection,prophetic_word,prayer_focus,declaration,
    topic,category,introduction,application,scripture_version,topic_key,title_key,content_hash,source_notes,series_id,series_day,revision,is_hidden,published_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18,$19,$20,$21,
      CASE WHEN $1::date<=(now() AT TIME ZONE 'Africa/Lagos')::date AND $21=false THEN now() ELSE NULL END)`,
    [date,c.title,c.scripture,c.reference,c.message,c.scripture,c.closingPrayer,c.declaration??`I will follow Christ in this teaching: ${c.application}`,
      c.topic,c.category,c.introduction,c.application,c.scriptureVersion,normalizeIdentity(c.topic),normalizeIdentity(c.title),contentHash(c),
      JSON.stringify(c.sources??[]),c.seriesId??null,c.seriesDay??null,revision,hidden]);
}
export async function createEntry(client:DevotionClient,c:DevotionContent) {
  await validateUnique(client,c);
  const id=normalizeIdentity(c.topic);
  await client.query("INSERT INTO devotion_library(topic_key,title_key,content_hash,content,category,source) VALUES($1,$2,$3,$4::jsonb,$5,'editor')",
    [id,normalizeIdentity(c.title),contentHash(c),JSON.stringify(c),c.category]);
  await rememberIdentity(client,c,id);
  return {ok:true,id};
}
export async function editEntry(client:DevotionClient,id:string,revision:unknown,c:DevotionContent) {
  const {library,daily}=await load(client,id,revision);
  if(!library || daily?.published_at) throw new EditorialError("Published content is preserved unchanged; create a genuinely new reading instead");
  await validateUnique(client,c,library.topic_key);
  // The old lesson and every changed identity remain permanently reserved.
  await rememberIdentity(client,library.content,id);
  await rememberIdentity(client,c,id);
  await client.query("INSERT INTO devotion_revisions(owner,original_date,content,reason) VALUES($1,$2,$3::jsonb,'editorial update')",
    [id,library.assigned_date,JSON.stringify(library.content)]);
  await client.query("UPDATE devotion_library SET content=$2::jsonb,title_key=$3,content_hash=$4,category=$5,revision=revision+1 WHERE topic_key=$1",
    [id,JSON.stringify(c),normalizeIdentity(c.title),contentHash(c),c.category]);
  if(daily) {
    await client.query("DELETE FROM daily_devotions WHERE date=$1 AND published_at IS NULL",[library.assigned_date]);
    await saveDate(client,c,library.assigned_date!,library.revision+1,library.paused);
  }
  return {ok:true};
}
export async function scheduleEntry(client:DevotionClient,id:string,revision:unknown,dateInput:unknown) {
  const date=assertDate(dateInput);
  if(date<devotionDate()) throw new EditorialError("New schedules cannot be placed in the published past");
  const {library,daily}=await load(client,id,revision);
  if(!library || daily?.published_at) throw new EditorialError("A published reading cannot be moved to another date");
  if(library.status==="review") throw new EditorialError("This reading requires review before scheduling");
  const occupied=await client.query("SELECT 1 FROM daily_devotions WHERE date=$1 AND date IS DISTINCT FROM $2::date",[date,library.assigned_date]);
  if(occupied.rowCount) throw new EditorialError("That date already has a reading; nothing was overwritten");
  await validateUnique(client,library.content,id);
  if(daily) {
    await client.query("INSERT INTO devotion_revisions(owner,original_date,content,reason) VALUES($1,$2,$3::jsonb,'publication date changed')",[id,library.assigned_date,JSON.stringify(library.content)]);
    await client.query("DELETE FROM daily_devotions WHERE date=$1 AND published_at IS NULL",[library.assigned_date]);
  }
  await saveDate(client,library.content,date,library.revision+1,false);
  await client.query("UPDATE devotion_library SET assigned_date=$2,status='used',paused=false,revision=revision+1 WHERE topic_key=$1",[id,date]);
  await rememberIdentity(client,library.content,id);
  return {ok:true};
}
export async function setEntryVisibility(client:DevotionClient,id:string,revision:unknown,publish:boolean) {
  const {library,daily}=await load(client,id,revision);
  if(!daily) {
    if(!publish || !library) throw new EditorialError("Only scheduled or published readings can be hidden");
    return scheduleEntry(client,id,revision,devotionDate());
  }
  if(publish && !daily.published_at && library) await validateUnique(client,library.content,id);
  await client.query(`UPDATE daily_devotions SET is_hidden=$2,revision=revision+1,
    published_at=CASE WHEN $2=false AND date<=(now() AT TIME ZONE 'Africa/Lagos')::date THEN COALESCE(published_at,now()) ELSE published_at END WHERE date=$1`,[daily.date,!publish]);
  if(library) await client.query("UPDATE devotion_library SET paused=$2,revision=revision+1 WHERE topic_key=$1",[id,!publish]);
  await client.query("INSERT INTO devotion_revisions(owner,original_date,content,reason) VALUES($1,$2,$3::jsonb,$4)",
    [id,daily.date,JSON.stringify(library?.content??historicalContent(daily)),publish?"visibility restored":"visibility paused"]);
  return {ok:true};
}
export async function listEntries(query:Record<string,unknown>) {
  const page=Math.max(1,Math.trunc(Number(query.page))||1),pageSize=Math.max(1,Math.min(100,Math.trunc(Number(query.pageSize))||30));
  const state=typeof query.state==="string"?query.state:"all";
  const search=typeof query.search==="string"?query.search.slice(0,200):"";
  const series=typeof query.series==="string"?query.series:"";
  // A single snapshot represents paired scheduled rows and standalone archive
  // rows exactly once. Public readers never use this administrator query.
  const result=await pool.query(`WITH entries AS (
    SELECT l.topic_key AS id,l.assigned_date::text AS date,l.content,l.revision,
      (d.published_at IS NULL AND l.status<>'review') AS editable,
      CASE WHEN l.paused OR d.is_hidden THEN 'unpublished' WHEN l.status='review' THEN 'review'
        WHEN d.published_at IS NOT NULL AND d.date<=(now() AT TIME ZONE 'Africa/Lagos')::date THEN 'published'
        WHEN l.assigned_date IS NOT NULL THEN 'scheduled' ELSE 'draft' END AS state
    FROM devotion_library l LEFT JOIN daily_devotions d ON d.date=l.assigned_date WHERE l.source<>'legacy-review'
    UNION ALL
    SELECT 'historical:'||d.date::text,d.date::text,
      jsonb_build_object('title',d.title,'topic',COALESCE(d.topic,d.title),'category',COALESCE(d.category,'Christian Living'),
        'reference',d.reference,'scripture',d.scripture,'scriptureVersion',COALESCE(d.scripture_version,''),
        'introduction',COALESCE(d.introduction,''),'message',d.reflection,'application',COALESCE(d.application,''),
        'closingPrayer',d.prayer_focus,'declaration',d.declaration),d.revision,false,
      CASE WHEN d.is_hidden THEN 'unpublished' WHEN d.published_at IS NOT NULL THEN 'published' ELSE 'scheduled' END
    FROM daily_devotions d WHERE NOT EXISTS(SELECT 1 FROM devotion_library l WHERE l.assigned_date=d.date)
  ), filtered AS (
    SELECT * FROM entries WHERE ($1='all' OR state=$1)
      AND ($2='' OR content->>'title' ILIKE '%'||$2||'%' OR content->>'topic' ILIKE '%'||$2||'%' OR content->>'reference' ILIKE '%'||$2||'%')
      AND ($3='' OR content->>'seriesId'=$3)
  )
  SELECT jsonb_build_object('entries',COALESCE((SELECT jsonb_agg(x) FROM (
    SELECT * FROM filtered ORDER BY CASE state WHEN 'scheduled' THEN 0 WHEN 'draft' THEN 1 WHEN 'unpublished' THEN 2 ELSE 3 END,
      CASE WHEN state='published' THEN date END DESC, date ASC NULLS LAST,id LIMIT $4 OFFSET $5
    ) x),'[]'::jsonb),'total',(SELECT count(*) FROM filtered),
    'series',COALESCE((SELECT jsonb_agg(s) FROM (SELECT content->>'seriesId' AS id,count(*)::int AS count,
      min(date) AS "firstDate",max(date) AS "lastDate" FROM entries WHERE content->>'seriesId' IS NOT NULL GROUP BY content->>'seriesId') s),'[]'::jsonb)) AS result`,
    [state,search,series,pageSize,(page-1)*pageSize]);
  return {...result.rows[0].result,page,pageSize};
}
