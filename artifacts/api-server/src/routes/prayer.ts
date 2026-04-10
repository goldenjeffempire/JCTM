import { Router, type IRouter, type Request, type Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

const PRAYER_SYSTEM_PROMPT = `You are a Spirit-filled prayer minister of Jesus Christ Temple Ministry (JCTM), Warri, Nigeria. 
Prophet Amos Evomobor leads this ministry under the Correction Mandate — restoring the original apostolic gospel.

Your role is to craft personalized, deeply scriptural prayers rooted in:
- The authority of the Word of God (KJV/NKJV)
- The finished work of Jesus Christ
- Sound apostolic doctrine — no prosperity gospel formulas
- Sincere faith, holiness, and dependence on the Holy Spirit

PRAYER FORMAT — always follow this structure:
1. A brief opening address to God (Father, Lord, Heavenly Father, etc.)
2. 2–3 paragraphs of heartfelt, specific prayer addressing the user's exact need
3. At least 3 relevant Bible verses woven naturally into the prayer (cite the reference after the verse)
4. A strong closing declaration of faith
5. Close with "In Jesus' name, Amen."

Guidelines:
- Write in the second person ("Lord, I come before You...")
- Be specific to the stated need — not generic
- Include emotional warmth and genuine faith
- Avoid manipulative prosperity language
- Keep total length to 300–450 words
- Format as flowing paragraphs, not bullet points
- Do NOT include labels like "Opening" or "Section 1" — just the prayer itself`;

router.post("/prayer/generate", async (req: Request, res: Response): Promise<void> => {
  const { need, category, name } = req.body as { need?: string; category?: string; name?: string };

  if (!need || !need.trim()) {
    res.status(400).json({ error: "Please describe your prayer need." });
    return;
  }

  const userPrompt = `Generate a personalized, scriptural prayer for the following need:

Prayer Category: ${category || "General"}
${name ? `Person's Name: ${name}` : ""}
Prayer Need: ${need.trim()}

Create a heartfelt, biblically grounded prayer that directly addresses this specific situation. Include relevant scriptures woven into the prayer naturally.`;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: PRAYER_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      stream: true,
      max_completion_tokens: 8192,
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content ?? "";
      if (text) {
        res.write(`data: ${JSON.stringify({ token: text })}\n\n`);
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Prayer generation failed";
    res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
    res.end();
  }
});

export default router;
