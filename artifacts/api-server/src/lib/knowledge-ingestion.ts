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
const KNOWLEDGE_VERSION = "4.0";
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
        `INSERT INTO knowledge_chunks (content, source, chunk_index, chunk_type, embedding)
         VALUES ($1, $2, $3, 'doctrine', $4)
         ON CONFLICT (source, chunk_index) DO UPDATE
         SET content = EXCLUDED.content, chunk_type = EXCLUDED.chunk_type,
             embedding = EXCLUDED.embedding, updated_at = now()`,
        [chunk.content, chunk.source, i, vectorStr ?? null],
      );
      log.info({ index: i + 1, total: JCTM_KNOWLEDGE.length, source: chunk.source, hasEmbedding: vectorStr !== null }, "Chunk stored");
    }

    // Write version stamp
    await client.query(
      `INSERT INTO knowledge_chunks (content, source, chunk_index, chunk_type, embedding)
       VALUES ($1, $2, 0, 'general', NULL)
       ON CONFLICT (source, chunk_index) DO UPDATE SET content = EXCLUDED.content, updated_at = now()`,
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
      `INSERT INTO knowledge_chunks (content, source, chunk_index, chunk_type, embedding)
       VALUES ($1, $2, 0, 'sermon', $3)
       ON CONFLICT (source, chunk_index)
       DO UPDATE SET content = EXCLUDED.content, chunk_type = EXCLUDED.chunk_type,
                     embedding = EXCLUDED.embedding, updated_at = now()`,
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
      ai_summary: string | null;
    }>(
      `SELECT video_id, title, description, view_count, duration, published_at, category, tags, ai_summary
       FROM sermon_data
       WHERE title IS NOT NULL
       ORDER BY published_at DESC NULLS LAST
       LIMIT 500`,
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
      const categoryStr = sermon.category ?? "teaching";
      const tagsStr = Array.isArray(sermon.tags) && sermon.tags.length > 0
        ? `Tags: ${sermon.tags.slice(0, 8).join(", ")}`
        : "";
      const viewStr = sermon.view_count ? `Views: ${sermon.view_count.toLocaleString()}` : "";
      const dateStr = sermon.published_at
        ? `Published: ${new Date(sermon.published_at).toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}`
        : "";

      // Split long descriptions into two indexed chunks for better RAG coverage
      const fullDesc = sermon.description ? sermon.description.replace(/\n{3,}/g, "\n\n") : "";
      const descPart1 = fullDesc.slice(0, 500);
      const descPart2 = fullDesc.length > 500 ? fullDesc.slice(500, 1200) : "";
      const summaryStr = sermon.ai_summary
        ? `AI Summary: ${sermon.ai_summary.slice(0, 400)}`
        : "";

      const content0 = [
        `Sermon by Prophet Amos Evomobor (JCTM): "${sermon.title}"`,
        `Category: ${categoryStr}`,
        tagsStr,
        viewStr,
        dateStr,
        descPart1 ? `Description: ${descPart1}` : "",
        `Watch on Temple TV: https://www.youtube.com/watch?v=${sermon.video_id}`,
      ].filter(Boolean).join("\n");

      try {
        const vectorStr0 = await generateEmbeddingVector(content0);
        await client.query(
          `INSERT INTO knowledge_chunks (content, source, chunk_index, chunk_type, embedding)
           VALUES ($1, $2, 0, 'sermon', $3)
           ON CONFLICT (source, chunk_index)
           DO UPDATE SET content = EXCLUDED.content, chunk_type = EXCLUDED.chunk_type,
                         embedding = EXCLUDED.embedding, updated_at = now()`,
          [content0, source, vectorStr0 ?? null],
        );
        ingested++;

        // Chunk 1: continuation + AI summary (only for sermons with extra content)
        if (descPart2 || summaryStr) {
          const content1 = [
            `Sermon continued — "${sermon.title}" by Prophet Amos Evomobor (JCTM)`,
            `Watch: https://www.youtube.com/watch?v=${sermon.video_id}`,
            descPart2 ? `Description (continued): ${descPart2}` : "",
            summaryStr,
          ].filter(Boolean).join("\n");

          const vectorStr1 = await generateEmbeddingVector(content1);
          await client.query(
            `INSERT INTO knowledge_chunks (content, source, chunk_index, chunk_type, embedding)
             VALUES ($1, $2, 1, 'sermon', $3)
             ON CONFLICT (source, chunk_index)
             DO UPDATE SET content = EXCLUDED.content, chunk_type = EXCLUDED.chunk_type,
                           embedding = EXCLUDED.embedding, updated_at = now()`,
            [content1, source, vectorStr1 ?? null],
          );
        }
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
          `INSERT INTO knowledge_chunks (content, source, chunk_index, chunk_type, embedding)
           VALUES ($1, 'activity-prayer-themes', 0, 'activity', $2)
           ON CONFLICT (source, chunk_index) DO UPDATE SET content = EXCLUDED.content,
             chunk_type = EXCLUDED.chunk_type, embedding = EXCLUDED.embedding, updated_at = now()`,
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
          `INSERT INTO knowledge_chunks (content, source, chunk_index, chunk_type, embedding)
           VALUES ($1, 'activity-testimonies', 0, 'activity', $2)
           ON CONFLICT (source, chunk_index) DO UPDATE SET content = EXCLUDED.content,
             chunk_type = EXCLUDED.chunk_type, embedding = EXCLUDED.embedding, updated_at = now()`,
          [content, vectorStr ?? null],
        );
        log?.info({ count: testimoniesResult.rows.length }, "Testimonies ingested");
      }
    } catch { /* non-fatal */ }

    // 3. Published blog posts — index + per-article chunks for RAG
    try {
      const blogResult = await client.query<{
        slug: string; title: string; excerpt: string | null; topic: string;
        category: string | null; tags: string[] | null;
      }>(
        `SELECT slug, title, excerpt, topic, category, tags
         FROM blog_posts
         WHERE published = true OR published IS NULL
         ORDER BY generated_at DESC NULLS LAST
         LIMIT 100`,
      );
      if (blogResult.rows.length > 0) {
        // Aggregate index chunk
        const blogSummaries = blogResult.rows
          .map(b => `• "${b.title}" [${b.category ?? b.topic}]: ${(b.excerpt ?? "").slice(0, 160)}`)
          .join("\n");
        const indexContent = `JCTM Blog & Teaching Articles (${blogResult.rows.length} published): ${blogSummaries}\n\nExplore all articles at jctm.org.ng/blog. Topics covered include holiness, salvation, prayer, fasting, testimonies, revival, family, youth, Bible study, and prophetic messages. Each article reflects JCTM's Correction Mandate and Primitive Christianity teaching under Prophet Amos Evomobor.`;
        const indexVector = await generateEmbeddingVector(indexContent);
        await client.query(
          `INSERT INTO knowledge_chunks (content, source, chunk_index, chunk_type, embedding)
           VALUES ($1, 'activity-blog-posts', 0, 'activity', $2)
           ON CONFLICT (source, chunk_index) DO UPDATE SET content = EXCLUDED.content,
             chunk_type = EXCLUDED.chunk_type, embedding = EXCLUDED.embedding, updated_at = now()`,
          [indexContent, indexVector ?? null],
        );

        // Per-article knowledge chunks (up to 80)
        let articleChunks = 0;
        for (const b of blogResult.rows.slice(0, 80)) {
          const articleContent = [
            `JCTM Ministry Article: "${b.title}"`,
            `Category: ${b.category ?? b.topic}`,
            b.tags && b.tags.length > 0 ? `Topics: ${b.tags.join(", ")}` : "",
            b.excerpt ? `Summary: ${b.excerpt}` : "",
            `Read at: https://jctm.org.ng/blog/${b.slug}`,
          ].filter(Boolean).join("\n");
          const articleVector = await generateEmbeddingVector(articleContent);
          await client.query(
            `INSERT INTO knowledge_chunks (content, source, chunk_index, chunk_type, embedding)
             VALUES ($1, $2, 0, 'blog', $3)
             ON CONFLICT (source, chunk_index) DO UPDATE SET content = EXCLUDED.content,
               chunk_type = EXCLUDED.chunk_type, embedding = EXCLUDED.embedding, updated_at = now()`,
            [articleContent, `blog-${b.slug}`, articleVector ?? null],
          );
          articleChunks++;
        }
        log?.info({ total: blogResult.rows.length, articleChunks }, "Blog posts and per-article chunks ingested");
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
          `INSERT INTO knowledge_chunks (content, source, chunk_index, chunk_type, embedding)
           VALUES ($1, 'activity-events', 0, 'event', $2)
           ON CONFLICT (source, chunk_index) DO UPDATE SET content = EXCLUDED.content,
             chunk_type = EXCLUDED.chunk_type, embedding = EXCLUDED.embedding, updated_at = now()`,
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
          `INSERT INTO knowledge_chunks (content, source, chunk_index, chunk_type, embedding)
           VALUES ($1, 'activity-popular-topics', 0, 'activity', $2)
           ON CONFLICT (source, chunk_index) DO UPDATE SET content = EXCLUDED.content,
             chunk_type = EXCLUDED.chunk_type, embedding = EXCLUDED.embedding, updated_at = now()`,
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

// ─── Daily Devotionals Ingestion ─────────────────────────────────────────────
// Indexes the last 45 devotionals (title, scripture, reflection, prayer) so
// TempleBots can answer questions about recent devotionals and point users to
// today's word.

export async function ingestDailyDevotionals(log?: Logger): Promise<void> {
  const client = await pool.connect();
  try {
    const result = await client.query<{
      date: string;
      title: string;
      scripture: string | null;
      reference: string | null;
      reflection: string | null;
      prayer_focus: string | null;
      declaration: string | null;
      prophetic_word: string | null;
    }>(
      `SELECT date, title, scripture, reference, reflection, prayer_focus, declaration, prophetic_word
       FROM daily_devotions
       ORDER BY date DESC
       LIMIT 45`,
    );

    if (result.rows.length === 0) {
      log?.info("No devotionals found — skipping devotional ingestion");
      return;
    }

    // Aggregate index chunk — helps AI know devotionals exist
    const today = result.rows[0]!;
    const todayDate = new Date(today.date).toLocaleDateString("en-GB", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
    const indexContent = [
      `JCTM Daily Devotionals — ${result.rows.length} devotionals available.`,
      `Today's Devotion (${todayDate}): "${today.title}"`,
      today.reference ? `Scripture: ${today.reference}` : "",
      today.scripture ? today.scripture.slice(0, 200) : "",
      today.reflection ? `Reflection: ${today.reflection.slice(0, 300)}` : "",
      today.prayer_focus ? `Prayer Focus: ${today.prayer_focus.slice(0, 150)}` : "",
      today.declaration ? `Declaration: ${today.declaration.slice(0, 150)}` : "",
      `Access daily devotions at jctm.org.ng/devotion. Subscribe by email for daily delivery.`,
    ].filter(Boolean).join("\n");

    const indexVector = await generateEmbeddingVector(indexContent);
    await client.query(
      `INSERT INTO knowledge_chunks (content, source, chunk_index, chunk_type, embedding)
       VALUES ($1, 'activity-devotionals-index', 0, 'devotion', $2)
       ON CONFLICT (source, chunk_index) DO UPDATE SET content = EXCLUDED.content,
         chunk_type = EXCLUDED.chunk_type, embedding = EXCLUDED.embedding, updated_at = now()`,
      [indexContent, indexVector ?? null],
    );

    // Per-devotional chunks for recent devotionals (last 14)
    let ingested = 0;
    for (const devo of result.rows.slice(0, 14)) {
      const dateStr = new Date(devo.date).toLocaleDateString("en-GB", {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
      });
      const content = [
        `JCTM Daily Devotion — ${dateStr}: "${devo.title}"`,
        devo.reference ? `Scripture: ${devo.reference}` : "",
        devo.scripture ? devo.scripture.slice(0, 300) : "",
        devo.reflection ? `Reflection: ${devo.reflection.slice(0, 400)}` : "",
        devo.prayer_focus ? `Prayer Focus: ${devo.prayer_focus.slice(0, 200)}` : "",
        devo.declaration ? `Declaration: ${devo.declaration.slice(0, 150)}` : "",
        devo.prophetic_word ? `Prophetic Word: ${devo.prophetic_word.slice(0, 150)}` : "",
        `Read full devotion at jctm.org.ng/devotion`,
      ].filter(Boolean).join("\n");

      const vector = await generateEmbeddingVector(content);
      const dateKey = devo.date.slice(0, 10).replace(/-/g, "");
      await client.query(
        `INSERT INTO knowledge_chunks (content, source, chunk_index, chunk_type, embedding)
         VALUES ($1, $2, 0, 'devotion', $3)
         ON CONFLICT (source, chunk_index) DO UPDATE SET content = EXCLUDED.content,
           chunk_type = EXCLUDED.chunk_type, embedding = EXCLUDED.embedding, updated_at = now()`,
        [content, `devotion-${dateKey}`, vector ?? null],
      );
      ingested++;
    }

    log?.info({ total: result.rows.length, ingested }, "Daily devotionals ingested into knowledge base");
  } catch (err) {
    log?.warn({ err }, "Devotionals ingestion failed (non-fatal)");
  } finally {
    client.release();
  }
}

// ─── Ministry FAQs Ingestion ──────────────────────────────────────────────────
// Rich static FAQ knowledge base covering practical questions users ask most.
// Ingested once and updated when the FAQ_VERSION changes.

const FAQ_VERSION = "1.2";

const MINISTRY_FAQS = [
  {
    source: "faq-service-times",
    content: `JCTM Service Times & Schedule:
Sunday Service: 8:00 AM – 12:00 PM WAT (West Africa Time) at Ebrumede Temple, Warri, Delta State.
Wednesday Midweek Service: 5:00 PM – 8:00 PM WAT.
All services are broadcast live on Temple TV YouTube channel (@TEMPLETVJCTM).
Services are also uploaded to YouTube after the live broadcast for on-demand viewing.
Special services (crusades, revivals, conferences) are announced on the website and social media.
Check jctm.org.ng/events for the full event calendar and upcoming special services.`,
  },
  {
    source: "faq-location-directions",
    content: `JCTM Physical Location & Directions:
Jesus Christ Temple Ministry is located at Ebrumede, Ebrumede Roundabout, Effurun, Warri, Delta State, Nigeria.
Landmark: Ebrumede Roundabout, near the Effurun area of Warri.
From Warri town centre: take the Effurun road, pass through the Effurun roundabout, turn towards Ebrumede.
For driving directions: search "Jesus Christ Temple Ministry Ebrumede" on Google Maps.
Contact the church office at info@jctm.org.ng or call for specific directions.
For those outside Nigeria: you can attend services online at jctm.org.ng or YouTube @TEMPLETVJCTM.`,
  },
  {
    source: "faq-membership",
    content: `How to Become a JCTM Member:
1. Attend Sunday services at Ebrumede Temple, Warri or watch online via Temple TV.
2. Receive Jesus Christ as Lord and Saviour if you haven't already.
3. Complete water baptism by full immersion (contact info@jctm.org.ng for baptism dates).
4. Attend the new members/foundation class (announced after services).
5. Register at jctm.org.ng/join or email info@jctm.org.ng with your name, phone, and location.
6. Connect with a home cell or life group in your area.
For online/diaspora members: register on the platform and attend via YouTube live stream.
For youth (13-25): Youth Ministry meets separately — ask at the church or email info@jctm.org.ng.`,
  },
  {
    source: "faq-how-to-give",
    content: `How to Give/Donate to JCTM:
Online giving is available at jctm.org.ng/give.
Payment options:
- Paystack: Naira (NGN) payments for Nigeria-based givers — cards, bank transfer, USSD
- Stripe: USD and international currency for diaspora and global givers
Direct bank transfer: contact info@jctm.org.ng for JCTM bank account details.
What your giving supports: Temple TV productions, global Correction Mandate outreach, church operations, crusades, and community ministry.
JCTM's giving teaching: Giving is an act of worship and partnership (not a prosperity formula). Tithes (10%) and freewill offerings are biblical principles from Malachi 3:10 and 2 Corinthians 9:7. All giving is voluntary and from a heart of love.`,
  },
  {
    source: "faq-prayer-requests",
    content: `How to Submit a Prayer Request to JCTM:
Visit jctm.org.ng/prayer to submit your prayer request online.
Or email your prayer request to info@jctm.org.ng with "Prayer Request" in the subject line.
The JCTM prayer team prays over all submitted requests.
Types of prayer available: healing, salvation for family members, deliverance, financial breakthrough, marriage, children, career/purpose, spiritual growth, and restoration.
Corporate prayer happens at every service. You can also request personal prayer ministry by contacting the church office.
Remember: You can be direct with God about your need. Bring your request to God first (Philippians 4:6-7), then seek the support of the JCTM prayer community.`,
  },
  {
    source: "faq-testimonies",
    content: `How to Share Your Testimony at JCTM:
Visit jctm.org.ng/testimonies to submit your testimony online.
Testimony categories include: salvation, healing, deliverance, financial breakthrough, answered prayer, family restoration, and marriage miracles.
You can also email your testimony to info@jctm.org.ng.
Approved testimonies are shared on the website to encourage the global JCTM community.
Why share: Revelation 12:11 says believers overcome "by the blood of the Lamb and the word of their testimony." Your story releases faith for others.
Selected testimonies may be featured in JCTM broadcasts on Temple TV.`,
  },
  {
    source: "faq-contact",
    content: `How to Contact Jesus Christ Temple Ministry (JCTM):
Email (general inquiries): info@jctm.org.ng
Physical address: Ebrumede Temple, Warri, Delta State, Nigeria
YouTube: Temple TV @TEMPLETVJCTM — https://www.youtube.com/channel/UCPFFvkE-KGpR37qJgvYriJg
Facebook: @templetvjctm — https://www.facebook.com/templetvjctm
Website: jctm.org.ng
For pastoral counselling: email info@jctm.org.ng with "Pastoral Counselling Request"
For media inquiries about Temple TV: email info@jctm.org.ng with "Media Inquiry"
For evangelism partnerships or ministry invitations: email info@jctm.org.ng
Response time is typically within 1-3 business days.`,
  },
  {
    source: "faq-viewing-centres",
    content: `JCTM Viewing Centres — For Those Outside Warri:
JCTM has viewing centres and affiliate congregations in several states across Nigeria and in the diaspora.
To find a viewing centre near you: email info@jctm.org.ng with your city/state and request to join a viewing centre.
If there is no centre in your area: you can start one! Contact info@jctm.org.ng for guidelines on starting an official JCTM viewing centre.
Online community: join the JCTM Digital Sanctuary at jctm.org.ng for sermons, devotions, events, testimonies, and live streams — accessible from any country.
Diaspora members can participate fully online and give through jctm.org.ng/give (Stripe for international payments).`,
  },
  {
    source: "faq-temple-tv-youtube",
    content: `Temple TV — JCTM's YouTube Channel:
Channel: Temple TV @TEMPLETVJCTM
URL: https://www.youtube.com/channel/UCPFFvkE-KGpR37qJgvYriJg
Content published: live Sunday services, midweek teachings, prophetic messages, doctrinal lectures, sermon series, crusade coverage, youth teachings, and testimonies.
Subscribers can set notifications to never miss a live stream.
Archive: hundreds of sermons on topics including Correction Mandate, Primitive Christianity, holiness, end times, healing, Holy Spirit baptism, fasting, marriage, and more.
Live streams: Sunday mornings and special events broadcast live.
Subscribe and click the bell icon to receive notifications for upcoming live streams.
Watch on jctm.org.ng/sermons for a curated, searchable sermon library with the latest uploads.`,
  },
  {
    source: "faq-conference-registration",
    content: `JCTM Conference & Event Registration:
JCTM holds an annual Ministers' Conference and other special events throughout the year.
To register: visit jctm.org.ng/conference-registration or jctm.org.ng/events.
Registration is usually free for in-person attendance; some online events may require registration for access links.
Ministers' Conference: a multi-day intensive gathering for ministers, church leaders, and serious believers. Topics focus on the Correction Mandate, prophetic ministry, sound doctrine, and apostolic leadership.
Conference emails with updates are sent to registered attendees.
For accommodation and travel information for out-of-town attendees: email info@jctm.org.ng.`,
  },
  {
    source: "faq-discipleship-bible-study",
    content: `JCTM Discipleship & Bible Study Resources:
Weekly Bible study is integrated into the midweek service (Wednesday 5-8 PM WAT).
Daily devotionals are available at jctm.org.ng/devotion — a new devotion is published every day.
Subscribe to email devotions: visit jctm.org.ng/devotion and enter your email for daily delivery.
Blog and teaching articles: jctm.org.ng/blog — covers holiness, sound doctrine, prayer, fasting, marriage, youth, and spiritual warfare.
Temple TV YouTube playlist: subscribe to @TEMPLETVJCTM for topical sermon series.
Recommended study order for new believers: John → Acts → Romans → Ephesians → then systematic topics.
For personal discipleship mentoring: email info@jctm.org.ng.`,
  },
  {
    source: "faq-water-baptism-schedule",
    content: `Water Baptism at JCTM:
JCTM practices water baptism by full immersion (the biblical mode — Greek "baptizo" = to immerse).
Baptism is for adult believers who have consciously received Jesus Christ as Lord and Saviour.
Baptism dates are announced during Sunday services and on the website.
To schedule your baptism: attend a Sunday service and speak to an usher or church leader, or email info@jctm.org.ng with "Baptism Request".
Pre-baptism counselling is available — you will receive teaching on the meaning and significance of baptism.
JCTM stands against infant baptism as a doctrinal error (you cannot be baptized on behalf of an unconscious infant; faith is personal and conscious).`,
  },
];

export async function ingestMinistryFAQs(log?: Logger): Promise<void> {
  const client = await pool.connect();
  try {
    // Check if FAQ version is current
    const versionCheck = await client.query<{ count: string }>(
      `SELECT COUNT(*) FROM knowledge_chunks WHERE source = $1`,
      [`faq-version-${FAQ_VERSION}`],
    );
    if (parseInt(versionCheck.rows[0]!.count, 10) > 0) {
      log?.info({ version: FAQ_VERSION }, "Ministry FAQs are current — skipping");
      return;
    }

    // Remove old FAQ version stamps
    await client.query(`DELETE FROM knowledge_chunks WHERE source LIKE 'faq-version-%'`);
    // Remove old FAQ chunks
    await client.query(
      `DELETE FROM knowledge_chunks WHERE source IN (${MINISTRY_FAQS.map(f => `'${f.source}'`).join(",")})`,
    );

    log?.info({ count: MINISTRY_FAQS.length, version: FAQ_VERSION }, "Ingesting ministry FAQ knowledge base");
    let ingested = 0;
    for (const faq of MINISTRY_FAQS) {
      const vector = await generateEmbeddingVector(faq.content);
      await client.query(
        `INSERT INTO knowledge_chunks (content, source, chunk_index, chunk_type, embedding)
         VALUES ($1, $2, 0, 'faq', $3)
         ON CONFLICT (source, chunk_index) DO UPDATE SET content = EXCLUDED.content,
           chunk_type = EXCLUDED.chunk_type, embedding = EXCLUDED.embedding, updated_at = now()`,
        [faq.content, faq.source, vector ?? null],
      );
      ingested++;
    }

    // Write FAQ version stamp
    await client.query(
      `INSERT INTO knowledge_chunks (content, source, chunk_index, chunk_type, embedding)
       VALUES ($1, $2, 0, 'general', NULL)
       ON CONFLICT (source, chunk_index) DO UPDATE SET content = EXCLUDED.content, updated_at = now()`,
      [`Ministry FAQ Knowledge Base version ${FAQ_VERSION}`, `faq-version-${FAQ_VERSION}`],
    );

    log?.info({ ingested, version: FAQ_VERSION }, "Ministry FAQs ingestion complete");
  } catch (err) {
    log?.warn({ err }, "Ministry FAQ ingestion failed (non-fatal)");
  } finally {
    client.release();
  }
}

// ─── Ministry Shorts / Ministry Moments Ingestion ─────────────────────────────
// Indexes the Ministry Moments (short videos ≤30 min) so TempleBots can
// reference and recommend short teaching clips.

export async function ingestMinistryShorts(log?: Logger): Promise<void> {
  const client = await pool.connect();
  try {
    // Ministry Moments: typically shorter sermons, stored in sermon_data
    const result = await client.query<{
      video_id: string;
      title: string;
      description: string | null;
      published_at: string | null;
      duration: string | null;
      view_count: number | null;
    }>(
      `SELECT video_id, title, description, published_at, duration, view_count
       FROM sermon_data
       WHERE duration IS NOT NULL
         AND (
           -- ISO 8601 durations ≤ 30 min: PT1M ... PT30M (no hours component)
           duration ~ '^PT([1-9]|[1-2][0-9]|30)M' OR
           duration NOT LIKE '%H%' AND duration != 'P0D'
         )
       ORDER BY published_at DESC NULLS LAST
       LIMIT 50`,
    );

    if (result.rows.length === 0) {
      log?.info("No ministry shorts found — skipping");
      return;
    }

    // Aggregate index chunk
    const summaries = result.rows.slice(0, 20).map(s =>
      `• "${s.title}"${s.view_count ? ` (${s.view_count.toLocaleString()} views)` : ""} → https://youtube.com/watch?v=${s.video_id}`,
    ).join("\n");
    const indexContent = `JCTM Ministry Moments — Short Teaching Clips (${result.rows.length} available):\n${summaries}\n\nMinistry Moments are short, focused teachings by Prophet Amos Evomobor on specific biblical topics. Watch at jctm.org.ng/sermons or YouTube @TEMPLETVJCTM.`;

    const indexVector = await generateEmbeddingVector(indexContent);
    await client.query(
      `INSERT INTO knowledge_chunks (content, source, chunk_index, chunk_type, embedding)
       VALUES ($1, 'activity-ministry-shorts', 0, 'activity', $2)
       ON CONFLICT (source, chunk_index) DO UPDATE SET content = EXCLUDED.content,
         chunk_type = EXCLUDED.chunk_type, embedding = EXCLUDED.embedding, updated_at = now()`,
      [indexContent, indexVector ?? null],
    );

    log?.info({ count: result.rows.length }, "Ministry Shorts ingested");
  } catch (err) {
    log?.warn({ err }, "Ministry Shorts ingestion failed (non-fatal)");
  } finally {
    client.release();
  }
}

// ─── Live Stream Context Ingestion ───────────────────────────────────────────
// Injects the current broadcast/rebroadcast/live state into the knowledge base
// so TempleBots can tell users whether a service is live right now.

export async function ingestLiveStreamContext(log?: Logger): Promise<void> {
  const client = await pool.connect();
  try {
    // Check for manual override state first
    const overrideResult = await client.query<{
      is_live: boolean | null;
      livestream_url: string | null;
      title: string | null;
      updated_at: string | null;
    }>(
      `SELECT is_live, livestream_url, title, updated_at
       FROM livestream_override_state
       ORDER BY id DESC LIMIT 1`,
    );

    // Check for the latest sermon for rebroadcast state
    const latestSermon = await client.query<{
      video_id: string;
      title: string;
      published_at: string | null;
    }>(
      `SELECT video_id, title, published_at
       FROM sermon_data
       WHERE is_live = false OR is_live IS NULL
       ORDER BY published_at DESC NULLS LAST
       LIMIT 1`,
    );

    const override = overrideResult.rows[0];
    const latest = latestSermon.rows[0];

    let statusText: string;
    if (override?.is_live) {
      statusText = `JCTM is CURRENTLY LIVE on Temple TV. ${override.title ? `Current stream: "${override.title}". ` : ""}Watch at: ${override.livestream_url ?? "https://youtube.com/@TEMPLETVJCTM"}`;
    } else {
      // Determine if we're in a rebroadcast window (within 4 days of last Sunday service)
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu
      const isRebroadcastWindow = dayOfWeek >= 0 && dayOfWeek <= 4;

      if (isRebroadcastWindow && latest) {
        const latestDate = latest.published_at ? new Date(latest.published_at).toLocaleDateString("en-GB", {
          weekday: "long", day: "numeric", month: "long",
        }) : "recently";
        statusText = `JCTM Temple TV is currently in REBROADCAST mode. The latest service — "${latest.title}" (${latestDate}) — is streaming on loop. Watch at: https://youtube.com/watch?v=${latest.video_id}. Next live Sunday service: ${dayOfWeek === 0 ? "TODAY at 8 AM WAT" : `Sunday at 8 AM WAT (${7 - dayOfWeek} days away)`}.`;
      } else {
        statusText = `JCTM Temple TV is not currently live. Next live service: Sunday at 8:00 AM WAT from Ebrumede Temple, Warri. Watch on YouTube @TEMPLETVJCTM or jctm.org.ng/sermons.${latest ? ` Latest sermon available: "${latest.title}".` : ""}`;
      }
    }

    const content = `JCTM Live Stream Status (real-time): ${statusText} JCTM broadcasts every Sunday 8 AM - 12 PM WAT and Wednesday 5-8 PM WAT. Live streams run on Temple TV YouTube (@TEMPLETVJCTM). Visit jctm.org.ng/sermons for the full sermon library.`;
    const vector = await generateEmbeddingVector(content);

    await client.query(
      `INSERT INTO knowledge_chunks (content, source, chunk_index, chunk_type, embedding)
       VALUES ($1, 'activity-livestream-status', 0, 'activity', $2)
       ON CONFLICT (source, chunk_index) DO UPDATE SET content = EXCLUDED.content,
         chunk_type = EXCLUDED.chunk_type, embedding = EXCLUDED.embedding, updated_at = now()`,
      [content, vector ?? null],
    );

    log?.info("Live stream context ingested");
  } catch (err) {
    log?.warn({ err }, "Live stream context ingestion failed (non-fatal)");
  } finally {
    client.release();
  }
}

// ─── Conference & Event Promotions Ingestion ──────────────────────────────────
// Ingests active event promotions and conference registration data so TempleBots
// is aware of upcoming campaigns and can encourage sign-ups.

export async function ingestConferenceData(log?: Logger): Promise<void> {
  const client = await pool.connect();
  try {
    // Active event promotions
    const promotions = await client.query<{
      title: string;
      subtitle: string | null;
      description: string | null;
      event_date: string | null;
      cta_text: string | null;
      event_type: string | null;
    }>(
      `SELECT title, subtitle, description, event_date, cta_text, event_type
       FROM event_promotions
       WHERE is_active = true
         AND (event_date IS NULL OR event_date >= NOW() - INTERVAL '7 days')
       ORDER BY event_date ASC
       LIMIT 5`,
    );

    // Conference registration counts (for major conferences)
    const registrations = await client.query<{ event_name: string; count: string }>(
      `SELECT event_name, COUNT(*) AS count
       FROM conference_registrations
       WHERE created_at >= NOW() - INTERVAL '90 days'
       GROUP BY event_name
       ORDER BY count DESC
       LIMIT 5`,
    );

    const parts: string[] = [];

    if (promotions.rows.length > 0) {
      const promoList = promotions.rows.map(p => {
        const date = p.event_date
          ? new Date(p.event_date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
          : "upcoming";
        return `• ${p.title}${p.subtitle ? ` — ${p.subtitle}` : ""} (${date})${p.description ? `: ${p.description.slice(0, 120)}` : ""}`;
      }).join("\n");
      parts.push(`Active JCTM Events & Promotions:\n${promoList}`);
    }

    if (registrations.rows.length > 0) {
      const regList = registrations.rows.map(r =>
        `• ${r.event_name}: ${r.count} registered`,
      ).join("\n");
      parts.push(`Conference Registration Interest:\n${regList}`);
    }

    if (parts.length === 0) {
      log?.info("No active promotions or recent registrations — skipping conference ingestion");
      return;
    }

    const content = `JCTM Conference & Events Intelligence:\n${parts.join("\n\n")}\n\nRegister at jctm.org.ng/conference-registration or visit jctm.org.ng/events. Contact info@jctm.org.ng for more information about any JCTM event.`;
    const vector = await generateEmbeddingVector(content);

    await client.query(
      `INSERT INTO knowledge_chunks (content, source, chunk_index, chunk_type, embedding)
       VALUES ($1, 'activity-conferences', 0, 'event', $2)
       ON CONFLICT (source, chunk_index) DO UPDATE SET content = EXCLUDED.content,
         chunk_type = EXCLUDED.chunk_type, embedding = EXCLUDED.embedding, updated_at = now()`,
      [content, vector ?? null],
    );

    log?.info({ promotions: promotions.rows.length, registrations: registrations.rows.length }, "Conference data ingested");
  } catch (err) {
    log?.warn({ err }, "Conference data ingestion failed (non-fatal)");
  } finally {
    client.release();
  }
}

// ─── Full Content Sync ─────────────────────────────────────────────────────────
// Orchestrates a complete re-ingestion of all content types in the correct order.
// Safe to call at any time — all operations are idempotent upserts.

// ─── Ingest Testimonies ────────────────────────────────────────────────────────
// Pulls approved community testimonies and encodes them as knowledge chunks.
// These help TempleBots answer questions about what God is doing at JCTM and
// encourage users who are seeking testimonies of healing, salvation, provision.

export async function ingestTestimonies(log?: Logger): Promise<void> {
  const client = await pool.connect();
  try {
    const result = await client.query<{
      id: number;
      title: string;
      content: string;
      category: string;
      author_name: string | null;
      created_at: string;
    }>(
      `SELECT id, title, content, category, author_name, created_at
       FROM testimonies
       WHERE approved = true AND content IS NOT NULL AND length(content) > 50
       ORDER BY created_at DESC LIMIT 40`,
    );

    if (result.rows.length === 0) {
      log?.info("No approved testimonies found — skipping testimony ingestion");
      return;
    }

    let upserted = 0;
    for (const row of result.rows) {
      const dateStr = new Date(row.created_at).toLocaleDateString("en-GB", {
        day: "numeric", month: "long", year: "numeric",
      });
      const author = row.author_name ? ` shared by ${row.author_name}` : "";
      const chunkContent = `JCTM Community Testimony [${row.category}]${author} (${dateStr}):\n"${row.title}"\n${row.content.slice(0, 600)}`;
      const vector = await generateEmbeddingVector(chunkContent);
      const source = `testimony-${row.id}`;

      await client.query(
        `INSERT INTO knowledge_chunks (content, source, chunk_index, chunk_type, embedding)
         VALUES ($1, $2, 0, 'testimony', $3)
         ON CONFLICT (source, chunk_index) DO UPDATE
           SET content = EXCLUDED.content, embedding = EXCLUDED.embedding, updated_at = now()`,
        [chunkContent, source, vector ?? null],
      );
      upserted++;
    }

    log?.info({ upserted, total: result.rows.length }, "Community testimonies ingested into knowledge base");
  } catch (err) {
    log?.warn({ err }, "Testimony ingestion failed (non-fatal)");
  } finally {
    client.release();
  }
}

// ─── Ingest Blog Posts ────────────────────────────────────────────────────────
// Pulls published blog posts (Ministry Moments / articles) into the RAG index.

export async function ingestBlogPosts(log?: Logger): Promise<void> {
  const client = await pool.connect();
  try {
    const result = await client.query<{
      id: number;
      title: string;
      content: string;
      excerpt: string | null;
      category: string | null;
      author: string | null;
      published_at: string | null;
    }>(
      `SELECT id, title, content, excerpt, category, author, published_at
       FROM blog_posts
       WHERE published = true AND content IS NOT NULL AND length(content) > 100
       ORDER BY published_at DESC NULLS LAST LIMIT 30`,
    );

    if (result.rows.length === 0) {
      log?.info("No published blog posts found — skipping blog ingestion");
      return;
    }

    let upserted = 0;
    for (const row of result.rows) {
      const dateStr = row.published_at
        ? new Date(row.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
        : "recent";
      const author = row.author ? ` by ${row.author}` : "";
      const category = row.category ? ` [${row.category}]` : "";
      const body = row.excerpt ?? row.content.slice(0, 500);
      const chunkContent = `JCTM Ministry Article${category}${author} (${dateStr}):\n"${row.title}"\n${body}`;
      const vector = await generateEmbeddingVector(chunkContent);
      const source = `blog-${row.id}`;

      await client.query(
        `INSERT INTO knowledge_chunks (content, source, chunk_index, chunk_type, embedding)
         VALUES ($1, $2, 0, 'blog', $3)
         ON CONFLICT (source, chunk_index) DO UPDATE
           SET content = EXCLUDED.content, embedding = EXCLUDED.embedding, updated_at = now()`,
        [chunkContent, source, vector ?? null],
      );
      upserted++;
    }

    log?.info({ upserted, total: result.rows.length }, "Blog posts ingested into knowledge base");
  } catch (err) {
    log?.warn({ err }, "Blog post ingestion failed (non-fatal)");
  } finally {
    client.release();
  }
}

// ─── Full Content Sync ─────────────────────────────────────────────────────────
// Orchestrates a complete re-ingestion of all content types in the correct order.
// Safe to call at any time — all operations are idempotent upserts.

export async function runFullContentSync(log?: Logger): Promise<{
  sermons: boolean;
  activity: boolean;
  devotionals: boolean;
  faqs: boolean;
  shorts: boolean;
  livestream: boolean;
  conferences: boolean;
  testimonies: boolean;
  blogPosts: boolean;
}> {
  const results = {
    sermons: false, activity: false, devotionals: false,
    faqs: false, shorts: false, livestream: false, conferences: false,
    testimonies: false, blogPosts: false,
  };
  log?.info("Starting full AI knowledge content sync (v4 — 9 content types)...");
  const t0 = Date.now();

  await Promise.allSettled([
    ingestAllSermons(log).then(() => { results.sermons = true; }),
    ingestActivityLearning(log).then(() => { results.activity = true; }),
    ingestDailyDevotionals(log).then(() => { results.devotionals = true; }),
    ingestMinistryFAQs(log).then(() => { results.faqs = true; }),
    ingestMinistryShorts(log).then(() => { results.shorts = true; }),
    ingestLiveStreamContext(log).then(() => { results.livestream = true; }),
    ingestConferenceData(log).then(() => { results.conferences = true; }),
    ingestTestimonies(log).then(() => { results.testimonies = true; }),
    ingestBlogPosts(log).then(() => { results.blogPosts = true; }),
  ]);

  log?.info({ ...results, durationMs: Date.now() - t0 }, "Full AI knowledge content sync v4 complete");
  return results;
}
