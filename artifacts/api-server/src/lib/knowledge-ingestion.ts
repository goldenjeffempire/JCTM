/**
 * JCTM Knowledge Ingestion — Zero External API
 *
 * Populates the knowledge_chunks table with JCTM-specific content.
 * Embeddings are generated locally using local-embeddings.ts.
 * No OpenAI required — all embedding is local.
 *
 * Strategy:
 *  - Embeddings via local all-MiniLM-L6-v2 transformer model (384-dim)
 *  - TF-IDF hash fallback if transformer fails to load
 *  - Text-only storage fallback if both fail
 *  - Keyword search always works regardless of embedding method
 *
 * Learning sources:
 *  1. Static JCTM canonical doctrine (JCTM_KNOWLEDGE)
 *  2. All sermon videos synced from YouTube (ingestAllSermons)
 *  3. Website activity: prayer themes, testimonies, blog posts, events (ingestActivityLearning)
 */

import pg from "pg";
import type { Logger } from "pino";
import { embed } from "./local-embeddings.js";

const { Pool } = pg;

function normalizeDbUrl(url: string): string {
  return url.replace(
    /([?&])sslmode=(prefer|require|verify-ca)(&|$)/g,
    (_m, prefix, _mode, suffix) => `${prefix}sslmode=verify-full${suffix}`,
  );
}

const pool = new Pool({ connectionString: normalizeDbUrl(process.env.DATABASE_URL ?? "") });

// ─── Version Stamp ────────────────────────────────────────────────────────────
// Increment this when the static JCTM_KNOWLEDGE array changes to force
// re-ingestion even if chunk count looks sufficient.
const KNOWLEDGE_VERSION = "2.1";
const VERSION_SOURCE = `jctm-version-${KNOWLEDGE_VERSION}`;

// ─── JCTM Knowledge Base ──────────────────────────────────────────────────────

const JCTM_KNOWLEDGE = [
  {
    source: "jctm-mission",
    content: `Jesus Christ Temple Ministry (JCTM) is a Christian ministry based in Ebrumede, Warri, Delta State, Nigeria. Founded and led by Prophet Amos Evomobor, JCTM operates under a divine mandate called the "Correction Mandate" — a God-given assignment to restore the original, unadulterated gospel of Jesus Christ to the global Body of Christ. The ministry's mission is to identify, expose, and correct false doctrines that have infiltrated Christianity, and to return believers to Primitive Christianity — the faith as originally delivered to the apostles. JCTM operates Temple TV, a YouTube channel (@TEMPLETVJCTM) that broadcasts sermons, teachings, and live services to a global audience.`,
  },
  {
    source: "prophet-amos-bio",
    content: `Prophet Amos Evomobor is the founder and senior pastor of Jesus Christ Temple Ministry (JCTM), Warri, Nigeria. He is a prophet in the five-fold ministry gifting, called specifically to the office of the prophet in this generation. Prophet Amos received the Correction Mandate directly from God — a divine commission to bring doctrinal correction and reformation to the global church. He teaches with apostolic authority and theological precision, drawing from deep study of the original Greek and Hebrew scriptures. He is known for his bold, uncompromising stance on holiness, doctrinal purity, and the restoration of Primitive Christianity. His YouTube channel Temple TV (@TEMPLETVJCTM) reaches believers worldwide.`,
  },
  {
    source: "correction-mandate",
    content: `The Correction Mandate is the divine assignment given to Jesus Christ Temple Ministry (JCTM) and Prophet Amos Evomobor. It is a call to expose and correct five major areas of error in modern Christianity: 1. The Prosperity Gospel / Word of Faith heresy — teaching that financial prosperity is always God's will. 2. Prophetic manipulation — false prophets using spiritual gifts for financial gain. 3. Apostolic abuse — people falsely claiming the office of apostle. 4. Sacramental corruption — distortion of holy sacraments like baptism and communion. 5. Ecumenism without truth — dangerous blending of Christianity with other religions. The Correction Mandate is not a criticism of individuals but a prophetic correction of doctrinal error for the health of the global church.`,
  },
  {
    source: "primitive-christianity",
    content: `Primitive Christianity, as taught by JCTM and Prophet Amos Evomobor, refers to the original form of the Christian faith as practiced in the first-century apostolic church. Key principles: The Bible is the supreme and final authority. Salvation is by grace through faith in Jesus Christ alone. Water baptism by full immersion is the biblical mode. The Holy Spirit gifts are still active today within proper biblical order. Holiness is not optional — believers are called to live separated, consecrated lives unto God. The church must return to simplicity of worship, sound doctrine, and genuine community as modeled in Acts 2.`,
  },
  {
    source: "holiness-doctrine",
    content: `Holiness is a central pillar of JCTM's teaching under Prophet Amos Evomobor. Holiness means: personal sanctification — being set apart from the world and unto God. Moral purity — rejecting sexual immorality, dishonesty, greed, and worldliness. Doctrinal purity — refusing to compromise God's Word for social acceptance. Practical consecration — living visibly different from the world, reflecting the character of Christ. Key scriptures: Hebrews 12:14 ("Without holiness no one will see the Lord"), 1 Peter 1:15-16, Romans 12:1-2. Prophet Amos warns against the "holiness is legalism" argument used to excuse moral compromise.`,
  },
  {
    source: "warri-city-crusade-2026",
    content: `The Warri City Crusade 2026 is a major outdoor evangelical crusade organized by Jesus Christ Temple Ministry (JCTM). Event Details: Dates: April 30 – May 1, 2026 (two-day event). Location: Ighogbadu Primary School, Warri, Delta State, Nigeria. Organizer: Jesus Christ Temple Ministry (JCTM) under Prophet Amos Evomobor. Theme: "Be Ready For Rapture: Tribulation Is Coming! Run For Your Soul!" Purpose: To bring the message of Primitive Christianity, the Correction Mandate, and the true gospel to the people of Warri and beyond. Features: Open-air gospel preaching, healing and miracle services, worship, testimonies, and doctrinal teachings. All believers, seekers, and the general public are welcome. Expected to draw thousands from across the Niger Delta region.`,
  },
  {
    source: "giving-seed-sowing",
    content: `Seed sowing and giving at JCTM is practiced within biblical stewardship, not the prosperity gospel. JCTM's teaching on giving: Giving is an act of worship and partnership with the ministry's mandate, not a formula for personal enrichment. JCTM does not teach "sow a seed and get a hundredfold return" as a transactional law. Giving supports the spread of the gospel, the Correction Mandate, and Temple TV. Tithes (10% of income) are a covenant principle from Malachi 3:10, given from a heart of love, not compulsion. To give to JCTM: visit jctm.org.ng/give. Prophet Amos warns against ministries that use manipulation and false promises to extract money.`,
  },
  {
    source: "baptism-doctrine",
    content: `JCTM teaches water baptism as a critical ordinance of the Christian faith, practiced by full immersion. Mode: Full immersion in water, following Jesus' baptism in the Jordan River (Matthew 3:16) and the Greek word "baptizo" meaning to immerse. Candidate: Baptism is for believing adults who have consciously confessed faith in Jesus Christ — not infants. Purpose: Baptism is an outward declaration of an inward reality — the death to sin and resurrection to new life in Christ (Romans 6:3-4). It is not the means of salvation but a public ordinance of the saved. Formula: In the name of the Father, Son, and Holy Spirit (Matthew 28:19). This stands against infant baptism which JCTM identifies as an early doctrinal corruption.`,
  },
  {
    source: "five-fold-ministry",
    content: `JCTM teaches the five-fold ministry from Ephesians 4:11 — Apostles, Prophets, Evangelists, Pastors, and Teachers — as still active and necessary today. Prophet Amos Evomobor holds the office of Prophet — not self-appointed, but confirmed by the fruit of his ministry, prophetic accuracy, and divine revelations. JCTM warns against people giving themselves titles of "Apostle" or "Prophet" without genuine divine calling. True five-fold ministers serve the church for its edification, not personal enrichment or celebrity status.`,
  },
  {
    source: "temple-tv-channel",
    content: `Temple TV is the official YouTube channel of Jesus Christ Temple Ministry (JCTM). Handle: @TEMPLETVJCTM. URL: https://www.youtube.com/channel/UCPFFvkE-KGpR37qJgvYriJg. Content: Sermons, live Sunday services, prophetic teachings, doctrinal lectures, testimonies, and crusade coverage. Popular themes: "The Correction Mandate," "What is Primitive Christianity?", exposing the prosperity gospel, Holy Spirit baptism and tongues, end times prophecy. Sunday services are broadcast live and uploaded afterward. If TempleBots cannot answer a question from JCTM doctrine, users should be directed to Temple TV.`,
  },
  {
    source: "church-location-contact",
    content: `Jesus Christ Temple Ministry (JCTM) Contact Information: Physical Location: Ebrumede, Warri, Delta State, Nigeria. YouTube: Temple TV @TEMPLETVJCTM (https://www.youtube.com/templetvjctm). Facebook: @templetvjctm (https://www.facebook.com/templetvjctm). Email: info@jctm.org.ng. Regular Sunday services held at the Ebrumede temple and broadcast live on Temple TV. The JCTM Digital Sanctuary is the official online platform for ministry resources, sermon streaming, live worship, event registration, and the member portal.`,
  },
  {
    source: "holy-spirit-baptism",
    content: `JCTM teaches that the baptism of the Holy Spirit is a distinct experience from water baptism and salvation, available to all believers. It is evidenced by speaking in tongues (Acts 2:4, Acts 10:46, Acts 19:6). This is an endowment of power for Christian witness (Acts 1:8), not a second salvation. JCTM warns against counterfeit tongues in some charismatic circles. The gifts of the Spirit (1 Corinthians 12) are still operational today. Prophecy must be tested against scripture (1 Thessalonians 5:20-21) — no prophecy can contradict the written Word of God.`,
  },
  {
    source: "end-times-teaching",
    content: `JCTM under Prophet Amos Evomobor teaches urgently on end-times prophecy. The rapture is the catching away of born-again believers living in holiness (1 Thessalonians 4:16-17). The tribulation is a coming period of global suffering (Revelation 6-19). The antichrist will demand worship and enforce the mark of the beast (666) as an economic system (Revelation 13:16-18). Signs of the end: global moral collapse (2 Timothy 3:1-5), apostasy in the church (2 Thessalonians 2:3), wars, famines, earthquakes (Matthew 24:6-8). The Warri Crusade 2026 theme: "Be Ready For Rapture: Tribulation Is Coming! Run For Your Soul!" The call is to repent, live holy, and be watchful.`,
  },
  {
    source: "salvation-gospel",
    content: `Salvation at JCTM is by grace through faith in Jesus Christ alone (Ephesians 2:8-9). The gospel: all have sinned (Romans 3:23), the wages of sin is death (Romans 6:23), but Christ died for sinners (Romans 5:8), and eternal life is a free gift received by faith (Romans 10:9-10). The sinner's prayer: confess you are a sinner, believe Jesus died and rose again, receive Him as Lord and Saviour. After salvation: water baptism, finding a doctrinally sound church, pursuing Holy Spirit baptism, daily Bible reading and prayer. JCTM at Ebrumede Temple Warri welcomes all new believers.`,
  },
  {
    source: "fasting-prayer-teaching",
    content: `JCTM teaches biblical fasting as a core spiritual discipline. Jesus said "when you fast" (Matthew 6:16) not "if" — fasting is assumed for disciples. Types: complete fast (no food/water), water fast, Daniel fast (vegetables and water only), partial/time fast. Purposes: seeking God, spiritual breakthrough (Mark 9:29), intercession, consecration, and repentance (Joel 2:12). Isaiah 58:6 describes the true fast: loosing bonds of wickedness. Practical: set duration, pray at meal times instead, read Scripture during the fast, break with fruits. Corporate fasts are held at JCTM regularly.`,
  },
  {
    source: "spiritual-warfare-teaching",
    content: `JCTM teaches that spiritual warfare is real (Ephesians 6:12). The believer's armour: belt of truth, breastplate of righteousness, gospel of peace, shield of faith, helmet of salvation, sword of the Spirit, and prayer in the Spirit (Ephesians 6:13-18). Generational curses are broken through Christ (Galatians 3:13) and genuine repentance. Binding and loosing (Matthew 18:18) operates under Christ's authority through the local church. Believers can experience demonic oppression; the solution is always prayer, fasting, and the Word. JCTM warns against sensationalized deliverance theatrics — true deliverance comes by the Holy Spirit. Submit prayer requests at jctm.org.ng/prayer.`,
  },
  {
    source: "marriage-family-teaching",
    content: `JCTM teaches biblical marriage as a covenant (Genesis 2:24), not a contract. Ephesians 5:22-33 is the blueprint: husbands love sacrificially as Christ loved the church; wives submit respectfully as to the Lord. Divorce is permitted on grounds of sexual immorality (Matthew 19:9) or abandonment by an unbelieving spouse (1 Corinthians 7:15); outside these, JCTM calls for reconciliation. Christian courtship: pursue purity (1 Thessalonians 4:3-5), choose godly character over attraction, do not be unequally yoked (2 Corinthians 6:14). Raise children in the Word (Deuteronomy 6:6-7, Proverbs 22:6). Establish a family altar of daily prayer. Contact info@jctm.org.ng for pastoral counselling.`,
  },
  {
    source: "healing-miracles-teaching",
    content: `JCTM affirms that God is still a Healer — Jehovah Rapha (Exodus 15:26). Healing is grounded in the atonement: Isaiah 53:5, Matthew 8:16-17. Jesus healed all who came to Him (Matthew 4:23-24) and He is the same yesterday, today, and forever (Hebrews 13:8). JCTM teaches a balanced position: healing is God's will and ability always, but timing is God's sovereignty. JCTM does not teach "guaranteed healing now" as the prosperity gospel teaches. Practical steps: pray and anoint with oil (James 5:14-16), stand on healing scriptures, use available medicine (Luke the physician), seek intercession at jctm.org.ng/prayer. Trust God's deeper purpose when healing seems delayed (2 Corinthians 12:9).`,
  },
];

// ─── Embedding Helpers ────────────────────────────────────────────────────────

async function generateEmbeddingVector(text: string): Promise<string | null> {
  try {
    const result = await embed(text);
    return `[${result.embedding.join(",")}]`;
  } catch {
    return null;
  }
}

// ─── Version-Stamped Bulk Ingestion ───────────────────────────────────────────

export async function ingestKnowledgeIfEmpty(
  _unused: unknown,
  log: Logger,
): Promise<void> {
  const client = await pool.connect();
  try {
    // Check if the current version stamp exists — if so, skip
    const versionCheck = await client.query<{ count: string }>(
      "SELECT COUNT(*) FROM knowledge_chunks WHERE source = $1",
      [VERSION_SOURCE],
    );
    if (parseInt(versionCheck.rows[0]!.count, 10) > 0) {
      log.info({ version: KNOWLEDGE_VERSION }, "Knowledge base is current — skipping static ingestion");
      return;
    }

    // Delete stale version stamps and re-ingest static knowledge
    await client.query("DELETE FROM knowledge_chunks WHERE source LIKE 'jctm-version-%'");
    await client.query(
      "DELETE FROM knowledge_chunks WHERE source IN (" +
      JCTM_KNOWLEDGE.map(k => `'${k.source}'`).join(",") +
      ")",
    );

    log.info({ version: KNOWLEDGE_VERSION, total: JCTM_KNOWLEDGE.length }, "Populating JCTM knowledge base (local embeddings)...");

    for (let i = 0; i < JCTM_KNOWLEDGE.length; i++) {
      const chunk = JCTM_KNOWLEDGE[i]!;
      const vectorStr = await generateEmbeddingVector(chunk.content);
      await client.query(
        `INSERT INTO knowledge_chunks (content, source, chunk_index, embedding)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (source, chunk_index) DO UPDATE
         SET content = EXCLUDED.content, embedding = EXCLUDED.embedding`,
        [chunk.content, chunk.source, i, vectorStr ?? null],
      );
      log.info({ index: i + 1, total: JCTM_KNOWLEDGE.length, source: chunk.source, hasEmbedding: vectorStr !== null }, "Chunk stored");
    }

    // Write version stamp
    await client.query(
      `INSERT INTO knowledge_chunks (content, source, chunk_index, embedding)
       VALUES ($1, $2, 0, NULL)
       ON CONFLICT (source, chunk_index) DO UPDATE SET content = EXCLUDED.content`,
      [`JCTM Knowledge Base version ${KNOWLEDGE_VERSION}`, VERSION_SOURCE],
    );

    const finalCount = await client.query<{ count: string }>("SELECT COUNT(*) FROM knowledge_chunks");
    const embeddedCount = await client.query<{ count: string }>("SELECT COUNT(*) FROM knowledge_chunks WHERE embedding IS NOT NULL");

    log.info(
      { version: KNOWLEDGE_VERSION, total: finalCount.rows[0]!.count, withEmbeddings: embeddedCount.rows[0]!.count },
      "JCTM knowledge base ingestion complete (local embeddings)",
    );
  } catch (err) {
    log.error({ err }, "Knowledge ingestion failed — TempleBots will work without RAG context");
  } finally {
    client.release();
  }
}

// ─── Single Sermon Ingestion ──────────────────────────────────────────────────

export async function ingestSermonSummary(opts: {
  videoId: string;
  title: string;
  summary: string;
  category?: string | null;
  tags?: string[] | null;
  log?: Logger;
}): Promise<void> {
  const { videoId, title, summary, category, tags, log } = opts;
  if (!videoId || !summary) return;

  const source = `sermon-${videoId}`;
  const content = [
    `Sermon: "${title}"`,
    `Category: ${category ?? "teaching"}`,
    tags && tags.length > 0 ? `Tags: ${tags.join(", ")}` : "",
    `Summary: ${summary}`,
    `Watch: https://www.youtube.com/watch?v=${videoId}`,
  ].filter(Boolean).join("\n");

  const client = await pool.connect();
  try {
    const vectorStr = await generateEmbeddingVector(content);
    await client.query(
      `INSERT INTO knowledge_chunks (content, source, chunk_index, embedding)
       VALUES ($1, $2, 0, $3)
       ON CONFLICT (source, chunk_index)
       DO UPDATE SET content = EXCLUDED.content, embedding = EXCLUDED.embedding`,
      [content, source, vectorStr ?? null],
    );
    log?.info({ videoId, source, hasEmbedding: vectorStr !== null }, "Sermon summary ingested");
  } catch (err) {
    log?.warn({ err, source }, "Sermon knowledge ingestion failed (non-fatal)");
  } finally {
    client.release();
  }
}

// ─── Batch Sermon Ingestion — Learn from ALL Synced Sermons ──────────────────
// Processes every sermon in the sermon_data table and upserts a rich
// knowledge chunk so TempleBots can answer questions about specific sermons.

export async function ingestAllSermons(log?: Logger): Promise<void> {
  const client = await pool.connect();
  try {
    const result = await client.query<{
      video_id: string;
      title: string;
      description: string | null;
      view_count: number | null;
      duration: string | null;
      published_at: string | null;
      category: string | null;
      tags: string[] | null;
    }>(
      `SELECT video_id, title, description, view_count, duration, published_at, category, tags
       FROM sermon_data
       WHERE title IS NOT NULL
       ORDER BY published_at DESC NULLS LAST
       LIMIT 200`,
    );

    const sermons = result.rows;
    if (sermons.length === 0) {
      log?.info("No sermons found in DB — skipping sermon batch ingestion");
      return;
    }

    log?.info({ count: sermons.length }, "Starting batch sermon knowledge ingestion...");

    let ingested = 0;
    let skipped = 0;

    for (const sermon of sermons) {
      const source = `sermon-${sermon.video_id}`;
      const descriptionText = sermon.description
        ? sermon.description.slice(0, 600).replace(/\n{3,}/g, "\n\n")
        : "";
      const categoryStr = sermon.category ?? "teaching";
      const tagsStr = Array.isArray(sermon.tags) && sermon.tags.length > 0
        ? `Tags: ${sermon.tags.slice(0, 8).join(", ")}`
        : "";
      const viewStr = sermon.view_count ? `Views: ${sermon.view_count.toLocaleString()}` : "";
      const dateStr = sermon.published_at
        ? `Published: ${new Date(sermon.published_at).toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}`
        : "";

      const content = [
        `Sermon by Prophet Amos Evomobor (JCTM): "${sermon.title}"`,
        `Category: ${categoryStr}`,
        tagsStr,
        viewStr,
        dateStr,
        descriptionText ? `Description: ${descriptionText}` : "",
        `Watch on Temple TV: https://www.youtube.com/watch?v=${sermon.video_id}`,
      ].filter(Boolean).join("\n");

      try {
        const vectorStr = await generateEmbeddingVector(content);
        await client.query(
          `INSERT INTO knowledge_chunks (content, source, chunk_index, embedding)
           VALUES ($1, $2, 0, $3)
           ON CONFLICT (source, chunk_index)
           DO UPDATE SET content = EXCLUDED.content, embedding = EXCLUDED.embedding`,
          [content, source, vectorStr ?? null],
        );
        ingested++;
      } catch {
        skipped++;
      }
    }

    log?.info({ ingested, skipped, total: sermons.length }, "Sermon batch knowledge ingestion complete");
  } catch (err) {
    log?.warn({ err }, "Sermon batch ingestion failed (non-fatal)");
  } finally {
    client.release();
  }
}

// ─── Activity Learning — Learn from Website Activities ───────────────────────
// Ingests prayer themes, approved testimonies, published blog posts,
// and upcoming events so TempleBots is aware of real community activity.

export async function ingestActivityLearning(log?: Logger): Promise<void> {
  const client = await pool.connect();
  try {
    log?.info("Starting activity learning ingestion...");

    // 1. Prayer request categories (learn dominant prayer themes)
    try {
      const prayerResult = await client.query<{ category: string; count: string }>(
        `SELECT category, COUNT(*) AS count
         FROM prayer_requests
         WHERE approved = true OR approved IS NULL
         GROUP BY category
         ORDER BY count DESC
         LIMIT 20`,
      );
      if (prayerResult.rows.length > 0) {
        const categories = prayerResult.rows
          .map(r => `${r.category} (${r.count} requests)`)
          .join(", ");
        const content = `JCTM Community Prayer Focus: The JCTM prayer wall reflects the real needs of the community. Current dominant prayer categories: ${categories}. This shows that believers in this community are actively seeking God for these areas. TempleBots should speak to these themes with pastoral sensitivity. Submit prayer requests at jctm.org.ng/prayer — the JCTM prayer team intercedes daily.`;
        const vectorStr = await generateEmbeddingVector(content);
        await client.query(
          `INSERT INTO knowledge_chunks (content, source, chunk_index, embedding)
           VALUES ($1, 'activity-prayer-themes', 0, $2)
           ON CONFLICT (source, chunk_index) DO UPDATE SET content = EXCLUDED.content, embedding = EXCLUDED.embedding`,
          [content, vectorStr ?? null],
        );
        log?.info({ categories: prayerResult.rows.length }, "Prayer themes ingested");
      }
    } catch { /* non-fatal */ }

    // 2. Recent approved testimonies (learn what God is doing in the community)
    try {
      const testimoniesResult = await client.query<{
        name: string; title: string; content: string; category: string;
      }>(
        `SELECT name, title, content, category
         FROM testimonies
         WHERE approved = true
         ORDER BY created_at DESC NULLS LAST
         LIMIT 15`,
      );
      if (testimoniesResult.rows.length > 0) {
        const testimonySummaries = testimoniesResult.rows
          .map(t => `• "${t.title}" (${t.category}): ${(t.content ?? "").slice(0, 200)}`)
          .join("\n");
        const content = `JCTM Community Testimonies — What God Is Doing: These are recent verified testimonies from the JCTM community:\n${testimonySummaries}\n\nThese testimonies demonstrate God's active work through JCTM's ministry: salvation, healing, deliverance, financial provision, and answered prayer. Share your testimony at jctm.org.ng/testimonies. As Revelation 12:11 teaches, believers overcome by the blood of the Lamb and the word of their testimony.`;
        const vectorStr = await generateEmbeddingVector(content);
        await client.query(
          `INSERT INTO knowledge_chunks (content, source, chunk_index, embedding)
           VALUES ($1, 'activity-testimonies', 0, $2)
           ON CONFLICT (source, chunk_index) DO UPDATE SET content = EXCLUDED.content, embedding = EXCLUDED.embedding`,
          [content, vectorStr ?? null],
        );
        log?.info({ count: testimoniesResult.rows.length }, "Testimonies ingested");
      }
    } catch { /* non-fatal */ }

    // 3. Published blog posts (learn from JCTM written content)
    try {
      const blogResult = await client.query<{
        title: string; excerpt: string; topic: string; tags: string[] | null;
      }>(
        `SELECT title, excerpt, topic, tags
         FROM blog_posts
         WHERE published = true OR published IS NULL
         ORDER BY created_at DESC NULLS LAST
         LIMIT 20`,
      );
      if (blogResult.rows.length > 0) {
        const blogSummaries = blogResult.rows
          .map(b => `• "${b.title}" [${b.topic ?? "doctrine"}]: ${(b.excerpt ?? "").slice(0, 180)}`)
          .join("\n");
        const content = `JCTM Blog & Teaching Articles: These are recent published articles from JCTM's ministry blog, covering JCTM's doctrinal positions and pastoral guidance:\n${blogSummaries}\n\nRead all articles at jctm.org.ng/blog. Each article reflects JCTM's commitment to the Correction Mandate and Primitive Christianity under Prophet Amos Evomobor.`;
        const vectorStr = await generateEmbeddingVector(content);
        await client.query(
          `INSERT INTO knowledge_chunks (content, source, chunk_index, embedding)
           VALUES ($1, 'activity-blog-posts', 0, $2)
           ON CONFLICT (source, chunk_index) DO UPDATE SET content = EXCLUDED.content, embedding = EXCLUDED.embedding`,
          [content, vectorStr ?? null],
        );
        log?.info({ count: blogResult.rows.length }, "Blog posts ingested");
      }
    } catch { /* non-fatal */ }

    // 4. Upcoming events (keep AI current on what's happening)
    try {
      const eventsResult = await client.query<{
        title: string; description: string | null; start_date: string;
        end_date: string | null; location: string | null; event_type: string | null;
      }>(
        `SELECT title, description, start_date, end_date, location, event_type
         FROM event_calendar
         WHERE start_date >= NOW() - INTERVAL '7 days'
         ORDER BY start_date ASC
         LIMIT 10`,
      );
      if (eventsResult.rows.length > 0) {
        const eventSummaries = eventsResult.rows.map(e => {
          const date = new Date(e.start_date).toLocaleDateString("en-GB", {
            weekday: "long", year: "numeric", month: "long", day: "numeric",
          });
          return `• "${e.title}" — ${date}${e.location ? ` at ${e.location}` : ""}${e.description ? `: ${e.description.slice(0, 120)}` : ""}`;
        }).join("\n");
        const content = `JCTM Upcoming Events and Services: Current and upcoming events at Jesus Christ Temple Ministry:\n${eventSummaries}\n\nView the full event calendar at jctm.org.ng/events. Register for specific events at jctm.org.ng. Sunday services are at 8:00 AM – 12:00 PM WAT, Wednesday services at 5:00 PM – 8:00 PM WAT. All services are broadcast live on Temple TV (YouTube @TEMPLETVJCTM).`;
        const vectorStr = await generateEmbeddingVector(content);
        await client.query(
          `INSERT INTO knowledge_chunks (content, source, chunk_index, embedding)
           VALUES ($1, 'activity-events', 0, $2)
           ON CONFLICT (source, chunk_index) DO UPDATE SET content = EXCLUDED.content, embedding = EXCLUDED.embedding`,
          [content, vectorStr ?? null],
        );
        log?.info({ count: eventsResult.rows.length }, "Events ingested");
      }
    } catch { /* non-fatal */ }

    // 5. AI conversation topics (learn what questions users ask most)
    try {
      const feedbackResult = await client.query<{ query_topic: string; count: string }>(
        `SELECT LEFT(user_message, 80) AS query_topic, COUNT(*) AS count
         FROM ai_feedback
         WHERE rating >= 4 OR rating IS NULL
         GROUP BY LEFT(user_message, 80)
         ORDER BY count DESC
         LIMIT 20`,
      );
      if (feedbackResult.rows.length > 0) {
        const topics = feedbackResult.rows
          .map(r => `• ${r.query_topic}`)
          .join("\n");
        const content = `JCTM Community Questions — Most Frequent Topics: These are the most common topics that believers ask TempleBots about:\n${topics}\n\nThis gives TempleBots insight into the spiritual priorities and questions of the JCTM community. TempleBots should be especially prepared to answer these topics with depth, pastoral care, and scriptural grounding. All answers are grounded in JCTM doctrine under Prophet Amos Evomobor.`;
        const vectorStr = await generateEmbeddingVector(content);
        await client.query(
          `INSERT INTO knowledge_chunks (content, source, chunk_index, embedding)
           VALUES ($1, 'activity-popular-topics', 0, $2)
           ON CONFLICT (source, chunk_index) DO UPDATE SET content = EXCLUDED.content, embedding = EXCLUDED.embedding`,
          [content, vectorStr ?? null],
        );
        log?.info({ count: feedbackResult.rows.length }, "Popular topics ingested");
      }
    } catch { /* non-fatal — ai_feedback table may not exist yet */ }

    log?.info("Activity learning ingestion complete");
  } catch (err) {
    log?.warn({ err }, "Activity learning ingestion failed (non-fatal)");
  } finally {
    client.release();
  }
}
