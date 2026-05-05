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
 */

import pg from "pg";
import type { Logger } from "pino";
import { embed, embedBatch } from "./local-embeddings.js";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

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
    content: `The Warri City Crusade 2026 is a major outdoor evangelical crusade organized by Jesus Christ Temple Ministry (JCTM). Event Details: Dates: April 30 – May 1, 2026 (two-day event). Location: Ighogbadu Primary School, Warri, Delta State, Nigeria. Organizer: Jesus Christ Temple Ministry (JCTM) under Prophet Amos Evomobor. Purpose: To bring the message of Primitive Christianity, the Correction Mandate, and the true gospel to the people of Warri and beyond. Features: Open-air gospel preaching, healing and miracle services, worship, testimonies, and doctrinal teachings. All believers, seekers, and the general public are welcome. Expected to draw thousands from across the Niger Delta region.`,
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

// ─── Bulk Ingestion ───────────────────────────────────────────────────────────

export async function ingestKnowledgeIfEmpty(
  _unused: unknown,
  log: Logger,
): Promise<void> {
  const client = await pool.connect();
  try {
    const countResult = await client.query<{ count: string }>(
      "SELECT COUNT(*) FROM knowledge_chunks",
    );
    const count = parseInt(countResult.rows[0]!.count, 10);

    if (count >= JCTM_KNOWLEDGE.length) {
      log.info({ count }, "Knowledge base already populated — skipping ingestion");
      return;
    }

    log.info(
      { existing: count, total: JCTM_KNOWLEDGE.length },
      "Populating JCTM knowledge base with local embeddings...",
    );

    await client.query("DELETE FROM knowledge_chunks");

    for (let i = 0; i < JCTM_KNOWLEDGE.length; i++) {
      const chunk = JCTM_KNOWLEDGE[i]!;
      const vectorStr = await generateEmbeddingVector(chunk.content);

      await client.query(
        `INSERT INTO knowledge_chunks (content, source, chunk_index, embedding)
         VALUES ($1, $2, $3, $4)`,
        [chunk.content, chunk.source, i, vectorStr ?? null],
      );

      log.info(
        { index: i + 1, total: JCTM_KNOWLEDGE.length, source: chunk.source, hasEmbedding: vectorStr !== null },
        "Chunk stored",
      );
    }

    const finalCount = await client.query<{ count: string }>(
      "SELECT COUNT(*) FROM knowledge_chunks",
    );
    const embeddedCount = await client.query<{ count: string }>(
      "SELECT COUNT(*) FROM knowledge_chunks WHERE embedding IS NOT NULL",
    );

    log.info(
      {
        total: finalCount.rows[0]!.count,
        withEmbeddings: embeddedCount.rows[0]!.count,
      },
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
