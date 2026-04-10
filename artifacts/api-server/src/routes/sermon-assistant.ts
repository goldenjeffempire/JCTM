import { Router, type IRouter, type Request, type Response } from "express";
import { db, sermonsTable } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { desc, like, or } from "drizzle-orm";

const router: IRouter = Router();

const SYSTEM_PROMPT = `You are the JCTM Sermon Assistant — a specialized AI trained exclusively on the sermons and teachings of Prophet Amos Evomobor of Jesus Christ Temple Ministry (JCTM), Warri, Nigeria.

Your role is to answer questions ONLY from the content of Prophet Amos's sermons and JCTM teachings. You draw from sermon transcripts, titles, descriptions, and documented JCTM doctrine.

GUIDELINES:
- Answer from a first-person pastoral perspective grounded in JCTM sermons
- Always cite specific JCTM sermon themes, scripture references, or doctrine
- If a question falls outside JCTM sermon content, gently redirect to what Prophet Amos has taught
- Use language that reflects Prophet Amos's teaching style: clear, authoritative, deeply scriptural
- Reference specific sermon topics when relevant (Correction Mandate, Primitive Christianity, Holiness, etc.)
- Always include at least one scripture reference per response
- Format responses with clear headers where helpful

SERMON LIBRARY CONTEXT:
{SERMON_CONTEXT}

DOCTRINAL FOUNDATION:
- The Bible is the supreme authority (Sola Scriptura)
- Primitive Christianity: return to first-century apostolic faith
- The Correction Mandate: 5 key doctrinal errors being corrected
- Holiness is not optional but essential (Hebrews 12:14)
- Water baptism by full immersion for believing adults
- Holy Spirit baptism evidenced by speaking in tongues
- All five-fold ministry offices are still active today`;

router.post("/sermon-assistant", async (req: Request, res: Response): Promise<void> => {
  const { question, conversationHistory = [] } = req.body as {
    question: string;
    conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
  };

  if (!question?.trim()) {
    res.status(400).json({ error: "Question is required" });
    return;
  }

  // Fetch relevant sermons from DB based on question keywords
  const keywords = question.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const searchTerms = keywords.slice(0, 3);

  let sermonContext = "";
  try {
    const sermons = await db
      .select({
        title: sermonsTable.title,
        description: sermonsTable.description,
        publishedAt: sermonsTable.publishedAt,
      })
      .from(sermonsTable)
      .orderBy(desc(sermonsTable.publishedAt))
      .limit(8);

    if (sermons.length > 0) {
      sermonContext = sermons
        .map(s => `• "${s.title}" (${s.publishedAt ? new Date(s.publishedAt).getFullYear() : "N/A"})\n  ${(s.description ?? "").slice(0, 200)}`)
        .join("\n");
    }
  } catch {
    sermonContext = "Sermon database temporarily unavailable — responding from core JCTM doctrine.";
  }

  const systemPrompt = SYSTEM_PROMPT.replace("{SERMON_CONTEXT}", sermonContext || "Core JCTM doctrine library active.");

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemPrompt },
      ...conversationHistory.slice(-8).map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user", content: question },
    ];

    const stream = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      stream: true,
      max_completion_tokens: 8192,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        res.write(`data: ${JSON.stringify({ token: delta })}\n\n`);
      }
    }
    res.write("data: [DONE]\n\n");
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: "AI temporarily unavailable" })}\n\n`);
  } finally {
    res.end();
  }
});

// Get sermon topics for suggestions
router.get("/sermon-assistant/topics", async (_req: Request, res: Response): Promise<void> => {
  const topics = [
    "What is the Correction Mandate?",
    "How does JCTM define Primitive Christianity?",
    "What does Prophet Amos teach about holiness?",
    "What are the five errors in modern Christianity?",
    "How should Christians respond to prosperity gospel?",
    "What is the biblical mode of water baptism?",
    "How can I receive the Holy Spirit baptism?",
    "What are the five-fold ministry offices?",
    "How should believers handle spiritual manipulation?",
    "What scriptures ground the Correction Mandate?",
  ];
  res.json({ topics });
});

export default router;
