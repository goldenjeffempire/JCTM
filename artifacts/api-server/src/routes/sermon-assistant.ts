import { Router, type IRouter, type Request, type Response } from "express";
import { db, sermonsTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { localAIEnhancer } from "../lib/local-ai-enhancer.js";

const router: IRouter = Router();

// ─── Sermon Assistant — local AI, no OpenAI ───────────────────────────────────

router.post("/sermon-assistant", async (req: Request, res: Response): Promise<void> => {
  const { question, conversationHistory = [] } = req.body as {
    question: string;
    conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
  };

  if (!question?.trim()) {
    res.status(400).json({ error: "Question is required" });
    return;
  }

  let sermonContext = "";
  try {
    const sermons = await db
      .select({
        title: sermonsTable.title,
        description: sermonsTable.description,
        publishedAt: sermonsTable.publishedAt,
        videoId: sermonsTable.videoId,
      })
      .from(sermonsTable)
      .orderBy(desc(sermonsTable.publishedAt))
      .limit(8);

    if (sermons.length > 0) {
      sermonContext = sermons
        .map(s =>
          `• "${s.title}" (${s.publishedAt ? new Date(s.publishedAt).getFullYear() : "N/A"})\n` +
          `  ${(s.description ?? "").slice(0, 150)}\n` +
          `  Watch: https://youtube.com/watch?v=${s.videoId}`,
        )
        .join("\n");
    }
  } catch {
    sermonContext = "Core JCTM doctrine library active.";
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    const ragContext = sermonContext
      ? `## RECENT JCTM SERMONS:\n${sermonContext}`
      : undefined;

    const answer = await localAIEnhancer({
      query: question,
      conversationHistory: conversationHistory.slice(-8) as Array<{ role: "user" | "assistant"; content: string }>,
      ragContext,
      additionalContext: "This is a sermon assistant query — answer with specific JCTM doctrinal and sermon context.",
    });

    const words = answer.split(/(\s+)/);
    const CHUNK = 3;

    for (let i = 0; i < words.length; i += CHUNK) {
      const token = words.slice(i, i + CHUNK).join("");
      if (token) res.write(`data: ${JSON.stringify({ token })}\n\n`);
      await new Promise(r => setTimeout(r, 12));
    }

    res.write("data: [DONE]\n\n");
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: "AI temporarily unavailable" })}\n\n`);
  } finally {
    res.end();
  }
});

// ─── Sermon assistant topic suggestions ──────────────────────────────────────

router.get("/sermon-assistant/topics", (_req: Request, res: Response): void => {
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
