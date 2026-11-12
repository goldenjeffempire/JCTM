import { pool } from "@workspace/db";
import {
  contentHash, duplicateReason, normalizeIdentity, uniqueComparables, validateContent,
  type ComparableDevotion, type DevotionContent,
} from "./devotion-quality.js";
import { DEVOTION_SEEDS } from "./devotion-seeds.js";

const connectClient = () => pool.connect();
export type DevotionClient = Awaited<ReturnType<typeof connectClient>>;
export type StoredDevotion = {
  date: string; title: string; scripture: string; reference: string; reflection: string;
  prophetic_word: string; prayer_focus: string; declaration: string;
  topic?: string | null; category?: string | null; introduction?: string | null;
  application?: string | null; scripture_version?: string | null; review_required?: boolean;
  published_at?: Date | string | null;
};

// All creation, approval, scheduling and publication paths share this lock.
// The database lock protects different Node workers and different server instances.
export async function devotionTransaction<T>(work: (client: DevotionClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL statement_timeout = '20000'");
    await client.query("SELECT pg_advisory_xact_lock(147073, 683041)");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export function fromStored(row: StoredDevotion): ComparableDevotion {
  return {
    title: row.title, reference: row.reference, topic: row.topic,
    introduction: row.introduction, reflection: row.reflection,
    application: row.application, prayerFocus: row.prayer_focus,
  };
}

export async function inventory(client: DevotionClient): Promise<ComparableDevotion[]> {
  // Deliberately unbounded by age: old topics must never become eligible again.
  const published = await client.query<StoredDevotion>(
    `SELECT date::text, title, reference, reflection, prayer_focus, topic, introduction, application
     FROM daily_devotions ORDER BY date`,
  );
  const queued = await client.query<{ content: DevotionContent }>(
    "SELECT content FROM devotion_library WHERE source <> 'legacy-review'",
  );
  // Exact copies in the preserved legacy archive need only one comparison;
  // different titles, topics, passages or body versions are all retained.
  return uniqueComparables([...published.rows.map(fromStored), ...queued.rows.map(r => r.content)]);
}

export async function addLibraryContent(
  entries: unknown[], source: "curated" | "editor" | "ai" = "editor",
  requireAll = true,
): Promise<{ added: number; rejected: { title: string; reason: string }[] }> {
  return devotionTransaction(async client => {
    const existing = await inventory(client);
    const accepted: DevotionContent[] = [];
    const rejected: { title: string; reason: string }[] = [];
    for (const input of entries) {
      let candidate: DevotionContent;
      try {
        candidate = validateContent(input);
        let duplicate: string | null = null;
        for (const previous of existing) {
          duplicate = duplicateReason(candidate, previous);
          if (duplicate) break;
        }
        if (duplicate) throw new Error(duplicate);
      } catch (error) {
        rejected.push({ title: String((input as { title?: string })?.title ?? "Untitled"), reason: (error as Error).message });
        continue;
      }
      accepted.push(candidate);
      existing.push(candidate);
    }
    // Import is atomic by default: an invalid batch cannot partially publish.
    if (requireAll && rejected.length) return { added: 0, rejected };
    if (accepted.length) {
      await client.query(
        `INSERT INTO devotion_library(topic_key,title_key,content_hash,content,category,source)
         SELECT topic_key,title_key,content_hash,content,category,$2
         FROM jsonb_to_recordset($1::jsonb)
           AS x(topic_key text,title_key text,content_hash text,content jsonb,category text)
         ON CONFLICT DO NOTHING`,
        [JSON.stringify(accepted.map(c => ({
          topic_key: normalizeIdentity(c.topic), title_key: normalizeIdentity(c.title),
          content_hash: contentHash(c), content: c, category: c.category,
        }))), source],
      );
    }
    return { added: accepted.length, rejected };
  });
}

let seedPromise: Promise<unknown> | undefined;
export function seedDevotionLibrary(): Promise<unknown> {
  seedPromise ??= (async () => {
    const result = await addLibraryContent(DEVOTION_SEEDS, "curated", false);
    // Allow verified quotation corrections in unpublished reserve material only.
    // Identical message fingerprints and references prevent this from becoming
    // a general-purpose overwrite of editorial content or published history.
    await devotionTransaction(async client => {
      await client.query(
        `UPDATE devotion_library l SET content=jsonb_set(l.content,'{scripture}',to_jsonb(x.scripture))
         FROM jsonb_to_recordset($1::jsonb) AS x(topic_key text,content_hash text,reference text,scripture text)
         WHERE l.topic_key=x.topic_key AND l.content_hash=x.content_hash AND l.content->>'reference'=x.reference
           AND l.source='curated' AND (l.status='ready' OR (l.status='used' AND l.assigned_date>(now() AT TIME ZONE 'Africa/Lagos')::date))
           AND l.content->>'scripture' IS DISTINCT FROM x.scripture`,
        [JSON.stringify(DEVOTION_SEEDS.map(c => ({ topic_key: normalizeIdentity(c.topic), content_hash: contentHash(c), reference: c.reference, scripture: c.scripture })))],
      );
      await client.query(`UPDATE daily_devotions d SET scripture=l.content->>'scripture',prophetic_word=l.content->>'scripture'
        FROM devotion_library l WHERE l.assigned_date=d.date AND l.source='curated'
          AND d.published_at IS NULL AND d.reference=l.content->>'reference'
          AND d.content_hash=l.content_hash AND d.date>(now() AT TIME ZONE 'Africa/Lagos')::date
          AND d.scripture IS DISTINCT FROM l.content->>'scripture'`);
    });
    return result;
  })().catch(error => {
    seedPromise = undefined;
    throw error;
  });
  return seedPromise;
}

export async function getLibraryStatus() {
  const [counts, categories, history, review, expansion, scheduled] = await Promise.all([
    pool.query<{ status: string; count: number }>("SELECT status,count(*)::int AS count FROM devotion_library GROUP BY status"),
    pool.query("SELECT category,count(*)::int AS count FROM devotion_library WHERE status='ready' GROUP BY category ORDER BY category"),
    pool.query(`SELECT count(*)::int AS total,count(DISTINCT lower(trim(title)))::int AS distinct_titles,
      count(*) FILTER (WHERE date > CURRENT_DATE)::int AS scheduled FROM daily_devotions`),
    pool.query("SELECT topic_key,content->>'title' AS title,content,review_reason FROM devotion_library WHERE status='review' ORDER BY created_at DESC LIMIT 30"),
    pool.query("SELECT attempted_at,succeeded_at,added,error_code,error_message FROM devotion_expansion_state WHERE id=1"),
    pool.query(`SELECT d.date::text,d.title,d.topic,d.category,l.content FROM daily_devotions d
      LEFT JOIN devotion_library l ON l.assigned_date=d.date
      WHERE d.date>(now() AT TIME ZONE 'Africa/Lagos')::date ORDER BY d.date LIMIT 14`),
  ]);
  return {
    counts: counts.rows, categories: categories.rows, archive: history.rows[0], review: review.rows,
    expansion: expansion.rows[0] ?? null, scheduled: scheduled.rows,
    aiConfigured: Boolean(process.env.OPENAI_API_KEY),
    lowStock: (counts.rows.find(c => c.status === "ready")?.count ?? 0) < 30,
  };
}
