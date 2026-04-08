/**
 * JCTM Knowledge Ingestion Script
 *
 * Chunks JCTM ministry knowledge, embeds it with text-embedding-3-small,
 * and stores the vectors in the knowledge_chunks table for RAG.
 *
 * Run: node scripts/ingest-jctm-knowledge.mjs
 */

import OpenAI from "openai";
import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

if (!process.env.OPENAI_API_KEY && !process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY is not set");
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const JCTM_KNOWLEDGE = [
  {
    source: "jctm-mission",
    content: `Jesus Christ Temple Ministry (JCTM) is a Christian ministry based in Ebrumede, Warri, Delta State, Nigeria. 
Founded and led by Prophet Amos Evomobor, JCTM operates under a divine mandate called the "Correction Mandate" — a God-given assignment to restore the original, unadulterated gospel of Jesus Christ to the global Body of Christ.
The ministry's mission is to identify, expose, and correct false doctrines that have infiltrated Christianity, and to return believers to Primitive Christianity — the faith as originally delivered to the apostles.
JCTM operates Temple TV, a YouTube channel (@TEMPLETVJCTM) that broadcasts sermons, teachings, and live services to a global audience.`,
  },
  {
    source: "prophet-amos-bio",
    content: `Prophet Amos Evomobor is the founder and senior pastor of Jesus Christ Temple Ministry (JCTM), Warri, Nigeria. 
He is a prophet in the five-fold ministry gifting, called specifically to the office of the prophet in this generation. 
Prophet Amos received the Correction Mandate directly from God — a divine commission to bring doctrinal correction and reformation to the global church.
He teaches with apostolic authority and theological precision, drawing from deep study of the original Greek and Hebrew scriptures.
He is known for his bold, uncompromising stance on holiness, doctrinal purity, and the restoration of Primitive Christianity.
His YouTube channel Temple TV (@TEMPLETVJCTM) reaches believers worldwide with his signature teaching style: methodical, authoritative, and deeply scriptural.`,
  },
  {
    source: "correction-mandate",
    content: `The Correction Mandate is the divine assignment given to Jesus Christ Temple Ministry (JCTM) and Prophet Amos Evomobor.
It is a call to expose and correct five major areas of error in modern Christianity:
1. The Prosperity Gospel / Word of Faith heresy — Teaching that financial prosperity is always God's will and a sign of faith, which distorts the true gospel.
2. Prophetic manipulation — False prophets using spiritual gifts for financial gain and emotional control over believers.
3. Apostolic abuse — People falsely claiming the office of apostle without the genuine call, signs, and suffering that accompany the true apostolic ministry.
4. Sacramental corruption — Distortion of holy sacraments like baptism and communion from their original meaning and practice.
5. Ecumenism without truth — The dangerous blending of Christianity with other religions or compromised doctrines under the guise of unity.
The Correction Mandate is not a criticism of individuals but a prophetic correction of doctrinal error for the health of the global church.`,
  },
  {
    source: "primitive-christianity",
    content: `Primitive Christianity, as taught by JCTM and Prophet Amos Evomobor, refers to the original form of the Christian faith as practiced in the first-century apostolic church.
Key principles of Primitive Christianity according to JCTM:
- The Bible is the supreme and final authority on all matters of faith and practice.
- Salvation is by grace through faith in Jesus Christ alone — not by works, rituals, or financial giving.
- Water baptism by full immersion is the biblical mode of baptism, as practiced by Jesus and the apostles.
- The Holy Spirit gifts are still active today but must operate within proper biblical order.
- Holiness is not optional — believers are called to live separated, consecrated lives unto God.
- The church must return to simplicity of worship, sound doctrine, and genuine community as modeled in Acts 2.
JCTM teaches that much of modern Christianity has drifted from these apostolic foundations through centuries of tradition, cultural compromise, and false teaching.`,
  },
  {
    source: "holiness-doctrine",
    content: `Holiness is a central pillar of JCTM's teaching under Prophet Amos Evomobor.
According to JCTM doctrine, holiness means:
- Personal sanctification — being set apart from the world and unto God in thought, word, and action.
- Moral purity — rejecting sexual immorality, dishonesty, greed, and all forms of worldliness.
- Doctrinal purity — refusing to compromise the truth of God's Word for social acceptance or financial gain.
- Practical consecration — living a life that is visibly different from the world, reflecting the character of Christ.
JCTM teaches that holiness is not about external performance or religion but a genuine transformation of the heart by the Holy Spirit.
Key scripture references used: Hebrews 12:14 ("Without holiness no one will see the Lord"), 1 Peter 1:15-16, Romans 12:1-2.
Prophet Amos frequently warns against the "holiness is legalism" argument used to excuse moral compromise in the modern church.`,
  },
  {
    source: "warri-city-crusade-2026",
    content: `The Warri City Crusade 2026 is a major outdoor evangelical crusade organized by Jesus Christ Temple Ministry (JCTM).
Event Details:
- Event Name: Warri City Crusade 2026
- Dates: April 30 – May 1, 2026 (two-day event)
- Location: Warri, Delta State, Nigeria
- Organizer: Jesus Christ Temple Ministry (JCTM) under Prophet Amos Evomobor
- Purpose: To bring the message of Primitive Christianity, the Correction Mandate, and the true gospel of Jesus Christ to the people of Warri and beyond.
- Features: Open-air gospel preaching, healing and miracle services, worship, testimonies, and doctrinal teachings.
- Who should attend: All believers, seekers, and the general public who desire to encounter the authentic, undiluted gospel of Jesus Christ.
The crusade is a landmark event in JCTM's ministry calendar, expected to draw thousands of attendees from across the Niger Delta region and beyond.
If you want to attend or partner with the crusade, contact JCTM directly through their social media channels or email.`,
  },
  {
    source: "giving-seed-sowing",
    content: `Seed sowing and giving at JCTM is practiced within the context of biblical stewardship, not the prosperity gospel.
JCTM's teaching on giving distinguishes itself from Word of Faith / Prosperity Gospel theology:
- Giving is an act of worship and partnership with the ministry's mandate, not a formula for personal financial enrichment.
- JCTM does not teach "sow a seed and get a hundredfold return" as a transactional spiritual law.
- Giving supports the spread of the gospel, the Correction Mandate, and the operational needs of Temple TV and the ministry.
- Tithes (10% of income) are taught as a covenant principle from Malachi 3:10, but with the caveat that tithing must flow from a heart of love, not compulsion.
How to give to JCTM: Visit the official JCTM website giving portal, or contact the ministry directly through their social media channels.
Prophet Amos frequently preaches against ministries that use manipulation, pressure, and false promises to extract money from believers.`,
  },
  {
    source: "baptism-doctrine",
    content: `JCTM teaches water baptism as a critical ordinance of the Christian faith, practiced by full immersion (not sprinkling).
Key points of JCTM's baptism doctrine:
- Mode: Full immersion in water, following the example of Jesus' baptism in the Jordan River (Matthew 3:16) and the Greek word "baptizo" meaning to immerse.
- Candidate: Baptism is for believing adults who have consciously confessed faith in Jesus Christ — not infants who cannot make a personal decision of faith.
- Purpose: Baptism is an outward declaration of an inward reality — the death to sin and resurrection to new life in Christ (Romans 6:3-4). It is not the means of salvation but a public ordinance of the saved.
- Formula: JCTM baptizes in the name of the Father, Son, and Holy Spirit as commanded by Jesus in Matthew 28:19.
This stands against infant baptism (paedobaptism) practiced in many denominations, which JCTM identifies as one of the early doctrinal corruptions of the primitive church.`,
  },
  {
    source: "five-fold-ministry",
    content: `JCTM teaches the five-fold ministry as outlined in Ephesians 4:11 — Apostles, Prophets, Evangelists, Pastors, and Teachers — as still active and necessary for the church today.
Key JCTM positions on the five-fold ministry:
- All five offices are still operational in the modern church, contrary to cessationist theology.
- Prophet Amos Evomobor holds the office of Prophet — not self-appointed, but confirmed by the fruit of his ministry, prophetic accuracy, and divine revelations.
- The apostolic office is the highest in terms of authority and suffering, often misunderstood and abused in charismatic circles.
- JCTM warns against the modern trend of people giving themselves the title of "Apostle" or "Prophet" without genuine divine calling, confirmed character, and biblical evidence.
- True five-fold ministers serve the church for its edification, not for personal enrichment or celebrity status.`,
  },
  {
    source: "temple-tv-channel",
    content: `Temple TV is the official YouTube channel of Jesus Christ Temple Ministry (JCTM).
Channel details:
- YouTube Handle: @TEMPLETVJCTM
- URL: https://www.youtube.com/channel/UCPFFvkE-KGpR37qJgvYriJg
- Content: Sermons, live Sunday services, prophetic teachings, doctrinal lectures, testimonies, and crusade coverage.
- Language: English (primary), with occasional references to Nigerian Pidgin and local dialects.
- Frequency: Regular uploads — Sunday services are broadcast live and uploaded afterward.
Popular sermon themes on Temple TV:
- "The Correction Mandate" — the ministry's foundational teaching series
- "What is Primitive Christianity?" — doctrinal foundational series
- Exposing the prosperity gospel and Word of Faith movement
- Holy Spirit baptism and speaking in tongues (biblical versus counterfeits)
- End times prophecy and eschatology
If TempleBots cannot answer a question from JCTM doctrine, users should be directed to Temple TV for deeper study.`,
  },
  {
    source: "church-location-contact",
    content: `Jesus Christ Temple Ministry (JCTM) Contact Information:
- Physical Location: Ebrumede, Warri, Delta State, Nigeria
- YouTube: Temple TV @TEMPLETVJCTM (https://www.youtube.com/templetvjctm)
- Facebook: @templetvjctm (https://www.facebook.com/templetvjctm)
- Email: info@jctm.org.ng
Services: JCTM holds regular Sunday services at their Ebrumede temple. Live services are also broadcast on Temple TV YouTube channel.
Online Community: The JCTM Digital Sanctuary is the official online platform for ministry resources, sermon streaming, live worship counting, event registration, and member portal access.`,
  },
  {
    source: "holy-spirit-baptism",
    content: `JCTM teaches that the baptism of the Holy Spirit is a distinct experience from water baptism and salvation, available to all believers.
Key points:
- The Holy Spirit baptism is evidenced primarily by speaking in tongues as a sign, as described in Acts 2:4, Acts 10:46, and Acts 19:6.
- This is not a second salvation but an endowment of power for Christian witness (Acts 1:8).
- JCTM warns against the counterfeit tongues phenomenon in some charismatic circles — empty sound without genuine Spirit baptism.
- The gifts of the Spirit (1 Corinthians 12) are still operational today and are given as the Holy Spirit wills, not as a formula.
- Prophecy in the church must be tested against scripture (1 Thessalonians 5:20-21) — no prophecy can contradict the written Word of God.`,
  },
];

async function embedText(text) {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return response.data[0].embedding;
}

async function ingest() {
  const client = await pool.connect();
  try {
    console.log("🗄️  Clearing existing knowledge chunks...");
    await client.query("DELETE FROM knowledge_chunks");

    console.log(`📚 Processing ${JCTM_KNOWLEDGE.length} knowledge chunks...`);

    for (let i = 0; i < JCTM_KNOWLEDGE.length; i++) {
      const chunk = JCTM_KNOWLEDGE[i];
      console.log(`  [${i + 1}/${JCTM_KNOWLEDGE.length}] Embedding: ${chunk.source}`);

      const embedding = await embedText(chunk.content);
      const vectorStr = `[${embedding.join(",")}]`;

      await client.query(
        `INSERT INTO knowledge_chunks (content, source, chunk_index, embedding)
         VALUES ($1, $2, $3, $4::vector)`,
        [chunk.content, chunk.source, i, vectorStr],
      );

      // Small delay to avoid rate limiting
      if (i < JCTM_KNOWLEDGE.length - 1) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    const result = await client.query("SELECT COUNT(*) FROM knowledge_chunks");
    console.log(`\n✅ Ingestion complete! ${result.rows[0].count} chunks stored in knowledge_chunks table.`);
  } finally {
    client.release();
    await pool.end();
  }
}

ingest().catch((err) => {
  console.error("❌ Ingestion failed:", err);
  process.exit(1);
});
