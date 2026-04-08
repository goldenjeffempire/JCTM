/**
 * JCTM Knowledge Ingestion
 *
 * Runs at server startup (non-blocking) to populate the knowledge_chunks
 * table with JCTM-specific content embedded via text-embedding-3-small.
 * Only ingests if the table is empty or explicitly forced.
 */

import OpenAI from "openai";
import pg from "pg";
import type { Logger } from "pino";

const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

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
    content: `The Warri City Crusade 2026 is a major outdoor evangelical crusade organized by Jesus Christ Temple Ministry (JCTM). Event Details: Dates: April 30 – May 1, 2026 (two-day event). Location: Warri, Delta State, Nigeria. Organizer: Jesus Christ Temple Ministry (JCTM) under Prophet Amos Evomobor. Purpose: To bring the message of Primitive Christianity, the Correction Mandate, and the true gospel to the people of Warri and beyond. Features: Open-air gospel preaching, healing and miracle services, worship, testimonies, and doctrinal teachings. All believers, seekers, and the general public are welcome. Expected to draw thousands from across the Niger Delta region.`,
  },
  {
    source: "giving-seed-sowing",
    content: `Seed sowing and giving at JCTM is practiced within biblical stewardship, not the prosperity gospel. JCTM's teaching on giving: Giving is an act of worship and partnership with the ministry's mandate, not a formula for personal enrichment. JCTM does not teach "sow a seed and get a hundredfold return" as a transactional law. Giving supports the spread of the gospel, the Correction Mandate, and Temple TV. Tithes (10% of income) are a covenant principle from Malachi 3:10, given from a heart of love, not compulsion. To give to JCTM: visit the official JCTM website giving portal or contact the ministry via social media. Prophet Amos warns against ministries that use manipulation and false promises to extract money.`,
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
    content: `Jesus Christ Temple Ministry (JCTM) Contact Information: Physical Location: Ebrumede, Warri, Delta State, Nigeria. YouTube: Temple TV @TEMPLETVJCTM (https://www.youtube.com/templetvjctm). Facebook: @templetvjctm (https://www.facebook.com/templetvjctm). Email: info@jctm.org.ng. Regular Sunday services held at the Ebrumede temple and broadcast live on Temple TV. The JCTM Digital Sanctuary is the official online platform for ministry resources, sermon streaming, live worship counting, event registration, and member portal.`,
  },
  {
    source: "holy-spirit-baptism",
    content: `JCTM teaches that the baptism of the Holy Spirit is a distinct experience from water baptism and salvation, available to all believers. It is evidenced by speaking in tongues (Acts 2:4, Acts 10:46, Acts 19:6). This is an endowment of power for Christian witness (Acts 1:8), not a second salvation. JCTM warns against counterfeit tongues in some charismatic circles. The gifts of the Spirit (1 Corinthians 12) are still operational today. Prophecy must be tested against scripture (1 Thessalonians 5:20-21) — no prophecy can contradict the written Word of God.`,
  },
];

export async function ingestKnowledgeIfEmpty(
  openai: OpenAI,
  log: Logger,
): Promise<void> {
  const client = await pool.connect();
  try {
    const countResult = await client.query<{ count: string }>(
      "SELECT COUNT(*) FROM knowledge_chunks WHERE embedding IS NOT NULL",
    );
    const count = parseInt(countResult.rows[0].count, 10);

    if (count >= JCTM_KNOWLEDGE.length) {
      log.info({ count }, "Knowledge base already populated — skipping ingestion");
      return;
    }

    log.info({ existing: count, total: JCTM_KNOWLEDGE.length }, "Populating JCTM knowledge base...");

    await client.query("DELETE FROM knowledge_chunks");

    for (let i = 0; i < JCTM_KNOWLEDGE.length; i++) {
      const chunk = JCTM_KNOWLEDGE[i];
      try {
        const embeddingResponse = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: chunk.content,
        });
        const embedding = embeddingResponse.data[0].embedding;
        const vectorStr = `[${embedding.join(",")}]`;

        await client.query(
          `INSERT INTO knowledge_chunks (content, source, chunk_index, embedding)
           VALUES ($1, $2, $3, $4::vector)`,
          [chunk.content, chunk.source, i, vectorStr],
        );

        log.info({ index: i + 1, total: JCTM_KNOWLEDGE.length, source: chunk.source }, "Chunk embedded");

        if (i < JCTM_KNOWLEDGE.length - 1) {
          await new Promise((r) => setTimeout(r, 300));
        }
      } catch (err) {
        log.warn({ err, source: chunk.source }, "Failed to embed chunk — skipping");
      }
    }

    const finalCount = await client.query<{ count: string }>(
      "SELECT COUNT(*) FROM knowledge_chunks WHERE embedding IS NOT NULL",
    );
    log.info({ embedded: finalCount.rows[0].count }, "JCTM knowledge base ingestion complete");
  } catch (err) {
    log.error({ err }, "Knowledge ingestion failed — TempleBots will work without RAG context");
  } finally {
    client.release();
  }
}
