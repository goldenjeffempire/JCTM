import { pool } from "@workspace/db";
import type { Logger } from "pino";
import { contentHash, duplicateReason, normalizeIdentity, uniqueComparables, type DevotionContent } from "./devotion-quality.js";
import { devotionTransaction, fromStored, seedDevotionLibrary, type DevotionClient, type StoredDevotion } from "./devotion-library.js";

export interface DailyDevotion {
  date: string; title: string; scripture: string; reference: string;
  reflection: string; propheticWord: string; prayerFocus: string; declaration: string;
  topic?: string; category?: string; scriptureVersion?: string;
  introduction?: string; application?: string; message?: string; closingPrayer?: string;
}

export function devotionFromRow(row: StoredDevotion): DailyDevotion {
  return {
    date: row.date, title: row.title, scripture: row.scripture, reference: row.reference,
    reflection: row.reflection, propheticWord: row.prophetic_word,
    prayerFocus: row.prayer_focus, declaration: row.declaration,
    ...(row.introduction ? {
      introduction: row.introduction, application: row.application ?? "",
      topic: row.topic ?? row.title, category: row.category ?? "Christian Living",
      scriptureVersion: row.scripture_version ?? "KJV",
      message: row.reflection, closingPrayer: row.prayer_focus,
    } : {}),
  };
}

export function devotionDate(now = new Date()): string {
  // Both website and mobile receive the same Nigerian calendar day.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export async function ensureDevotionForDate(
  dateStr: string, log?: Logger,
): Promise<{ devotion: DailyDevotion; cached: boolean }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || new Date(dateStr + "T12:00:00Z").toISOString().slice(0, 10) !== dateStr) {
    throw new Error("Invalid devotion date");
  }
  // Published readings are immutable. Normal audience traffic need not queue
  // behind the editorial lock or invoke generation.
  const published = await findPublishedDevotion(dateStr);
  if (published) return { devotion: published, cached: true };
  await seedDevotionLibrary();
  return devotionTransaction(client => reserveDevotionForDate(client, dateStr, log));
}

// Exported separately so integration tests can exercise the actual reservation
// SQL in an isolated schema, without creating test readings in the public archive.
export async function reserveDevotionForDate(client: DevotionClient, dateStr: string, log?: Logger) {
    const result = await client.query<StoredDevotion>("SELECT *,date::text FROM daily_devotions WHERE date=$1", [dateStr]);
    const existing = result.rows[0];
    // Preserve everything already published, even legacy repetitions. An existing
    // reservation is already validated, and has no need to consume another topic.
    if (existing && !existing.review_required && existing.published_at && dateStr <= devotionDate()) return { devotion: devotionFromRow(existing), cached: true };
    const earlier = await client.query<StoredDevotion>(
      "SELECT *,date::text FROM daily_devotions WHERE date<>$1 ORDER BY daily_devotions.date", [dateStr],
    );
    if (existing && !existing.review_required) {
      const conflict = earlier.rows.filter(r => r.date < dateStr).map(r => duplicateReason(fromStored(existing), fromStored(r))).find(Boolean);
      if (!conflict) {
        if (dateStr <= devotionDate()) await client.query("UPDATE daily_devotions SET published_at=COALESCE(published_at,now()) WHERE date=$1", [dateStr]);
        return { devotion: devotionFromRow(existing), cached: true };
      }
      // Keep the complete superseded future content for pastoral review; never
      // overwrite an already-published devotion and never delete a historical row.
      await client.query(
        `INSERT INTO devotion_library(topic_key,title_key,content_hash,content,category,status,source,review_reason)
         VALUES($1,$1,$2,$3::jsonb,'Legacy','review','legacy-review',$4) ON CONFLICT DO NOTHING`,
        [`legacy-review-${dateStr}`, contentHash(fromStored(existing)), JSON.stringify({ ...devotionFromRow(existing), originalDate: dateStr }), conflict],
      );
      await client.query("UPDATE daily_devotions SET review_required=true WHERE date=$1", [dateStr]);
    }
    const ready = await client.query<{ topic_key: string; content: DevotionContent }>(
      `SELECT topic_key,content FROM devotion_library WHERE status='ready'
       ORDER BY CASE WHEN category=COALESCE((SELECT category FROM daily_devotions WHERE date<$1 ORDER BY date DESC LIMIT 1),'') THEN 1 ELSE 0 END,
       (SELECT count(*) FROM daily_devotions d WHERE d.category=devotion_library.category),
       created_at,topic_key FOR UPDATE`, [dateStr],
    );
    const previousContent = uniqueComparables(earlier.rows.map(fromStored));
    let selected: (typeof ready.rows)[number] | undefined;
    for (const candidate of ready.rows) {
      let conflict: string | null = null;
      for (const previous of previousContent) {
        conflict = duplicateReason(candidate.content, previous);
        if (conflict) break;
      }
      if (conflict) {
        await client.query("UPDATE devotion_library SET status='review',review_reason=$2 WHERE topic_key=$1", [candidate.topic_key, conflict]);
      } else {
        selected = candidate;
        break;
      }
    }
    if (!selected) throw new Error("No unused, validated devotion is available. Editorial attention is required; previously published topics will not be recycled.");
    const c = selected.content;
    const values = [
      dateStr,c.title,c.scripture,c.reference,c.message,c.scripture,c.closingPrayer,
      `With Christ's help, I will put this teaching into practice: ${c.application}`,
      c.topic,c.category,c.introduction,c.application,c.scriptureVersion,
      normalizeIdentity(c.topic),normalizeIdentity(c.title),contentHash(c),
    ];
    const saved = await client.query<StoredDevotion>(
      `INSERT INTO daily_devotions(date,title,scripture,reference,reflection,prophetic_word,prayer_focus,declaration,
        topic,category,introduction,application,scripture_version,topic_key,title_key,content_hash,published_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
         CASE WHEN $1::date<=(now() AT TIME ZONE 'Africa/Lagos')::date THEN now() ELSE NULL END)
       ON CONFLICT(date) DO UPDATE SET title=EXCLUDED.title,scripture=EXCLUDED.scripture,reference=EXCLUDED.reference,
         reflection=EXCLUDED.reflection,prophetic_word=EXCLUDED.prophetic_word,prayer_focus=EXCLUDED.prayer_focus,
         declaration=EXCLUDED.declaration,topic=EXCLUDED.topic,category=EXCLUDED.category,introduction=EXCLUDED.introduction,
         application=EXCLUDED.application,scripture_version=EXCLUDED.scripture_version,topic_key=EXCLUDED.topic_key,
         title_key=EXCLUDED.title_key,content_hash=EXCLUDED.content_hash,review_required=false,published_at=EXCLUDED.published_at
       WHERE daily_devotions.review_required=true
       RETURNING *,date::text`, values,
    );
    if (!saved.rows[0]) throw new Error("The date already has a valid devotion; it was not overwritten");
    await client.query("UPDATE devotion_library SET status='used',assigned_date=$2 WHERE topic_key=$1", [selected.topic_key, dateStr]);
    log?.info({ date: dateStr, category: c.category }, "Reserved a previously unused devotion");
    return { devotion: devotionFromRow(saved.rows[0]), cached: false };
}

export async function findPublishedDevotion(date: string): Promise<DailyDevotion | null> {
  const result = await pool.query<StoredDevotion>(
    "SELECT *,date::text FROM daily_devotions WHERE date=$1 AND date<=$2 AND review_required=false AND published_at IS NOT NULL",
    [date, devotionDate()],
  );
  return result.rows[0] ? devotionFromRow(result.rows[0]) : null;
}

export async function getDevotionHistory(limit: number): Promise<DailyDevotion[]> {
  const rows = await pool.query<StoredDevotion>(
    "SELECT *,date::text FROM daily_devotions WHERE date<=$1 AND review_required=false AND published_at IS NOT NULL ORDER BY daily_devotions.date DESC LIMIT $2",
    [devotionDate(), Math.max(1, Math.min(365, Math.trunc(limit) || 7))],
  );
  return rows.rows.map(devotionFromRow);
}
