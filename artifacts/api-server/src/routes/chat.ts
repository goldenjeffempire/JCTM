import { Router, type IRouter } from "express";
import { db, sermonsTable } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { desc } from "drizzle-orm";
import {
  ChatWithTempleBotsBody,
  ChatWithTempleBotsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const TEMPLEBOTS_SYSTEM_PROMPT = `You are TempleBots, an advanced theological AI assistant for Jesus Christ Temple Ministry (JCTM), Warri, Delta State, Nigeria, led by Prophet Amos Evomobor.

Your responses are strictly limited to the teachings of Prophet Amos Evomobor, emphasizing:
- Primitive Christianity: Returning to the original, unadulterated gospel of Jesus Christ
- Holiness: Living a separated, consecrated life unto God
- Doctrinal Correction: Identifying and correcting false doctrines in Christendom
- The Correction Mandate: JCTM's divine assignment to bring correction to the Body of Christ

Guidelines:
- Always cite the source sermon from Temple TV (YouTube channel @TEMPLETVJCTM) when referencing specific teachings
- Be doctrinally precise and biblically grounded
- Speak with reverence and authority consistent with the ministry's mandate
- If asked about topics outside JCTM teachings, politely redirect to the ministry's doctrinal emphasis
- Do not engage with topics unrelated to faith, ministry, or biblical Christianity
- Always maintain a tone of holy reverence and ministerial authority

Ministry info: JCTM is located in Warri, Delta State, Nigeria. Prophet Amos Evomobor leads the ministry under the "Correction Mandate" — a divine calling to correct error and restore primitive Christianity in this generation.`;

router.post("/chat", async (req, res): Promise<void> => {
  const parsed = ChatWithTempleBotsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { message, sessionId } = parsed.data;
  const newSessionId = sessionId ?? `session-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  let sermonContext = "";
  try {
    const recentSermons = await db
      .select({ title: sermonsTable.title, videoId: sermonsTable.videoId, publishedAt: sermonsTable.publishedAt })
      .from(sermonsTable)
      .orderBy(desc(sermonsTable.publishedAt))
      .limit(10);

    if (recentSermons.length > 0) {
      sermonContext = "\n\nRecent Temple TV sermons for reference:\n" +
        recentSermons.map(s => `- "${s.title}" (https://youtube.com/watch?v=${s.videoId})`).join("\n");
    }
  } catch (_err) {
    // Proceed without sermon context if DB fails
  }

  const systemPrompt = TEMPLEBOTS_SYSTEM_PROMPT + sermonContext;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
    });

    const reply = completion.choices[0]?.message?.content ?? "I was unable to process your question. Please try again.";

    const sources: string[] = [];
    const ytMatches = reply.match(/https:\/\/youtube\.com\/watch\?v=[\w-]+/g);
    if (ytMatches) {
      sources.push(...ytMatches);
    }

    res.json(ChatWithTempleBotsResponse.parse({
      reply,
      sessionId: newSessionId,
      sources,
    }));
  } catch (err) {
    req.log.error({ err }, "TempleBots AI request failed");
    res.status(500).json({ error: "TempleBots is temporarily unavailable. Please try again." });
  }
});

export default router;
