import { Router, type IRouter, type Request, type Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { pool } from "@workspace/db";

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

const PRAYER_NEED_MAX_LEN  = 2000;
const PRAYER_NAME_MAX_LEN  = 80;
const ALLOWED_CATEGORIES   = new Set(["general","healing","provision","protection","family","ministry","salvation","deliverance","guidance","thanksgiving","other"]);

router.post("/prayer/generate", async (req: Request, res: Response): Promise<void> => {
  const raw = req.body as { need?: unknown; category?: unknown; name?: unknown };

  const need     = typeof raw.need     === "string" ? raw.need.trim()     : "";
  const name     = typeof raw.name     === "string" ? raw.name.trim().slice(0, PRAYER_NAME_MAX_LEN) : "";
  const category = typeof raw.category === "string" && ALLOWED_CATEGORIES.has(raw.category.toLowerCase())
    ? raw.category.toLowerCase()
    : "General";

  if (!need) {
    res.status(400).json({ error: "Please describe your prayer need." });
    return;
  }

  if (need.length > PRAYER_NEED_MAX_LEN) {
    res.status(400).json({ error: `Prayer need must be ${PRAYER_NEED_MAX_LEN} characters or less.` });
    return;
  }

  const safePrayerNeed = need.slice(0, PRAYER_NEED_MAX_LEN);

  const userPrompt = `Generate a personalized, scriptural prayer for the following need:

Prayer Category: ${category}
${name ? `Person's Name: ${name}` : ""}
Prayer Need: ${safePrayerNeed}

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

router.get("/prayer/requests", async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT id, name, category, request, pray_count, created_at
       FROM prayer_requests
       WHERE is_public = true
       ORDER BY created_at DESC
       LIMIT 30`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to load prayer requests" });
  }
});

router.post("/prayer/requests", async (req: Request, res: Response): Promise<void> => {
  const { name, category, request: reqText, visitorId } = req.body as {
    name?: string; category?: string; request?: string; visitorId?: string;
  };

  if (!reqText || !reqText.trim()) {
    res.status(400).json({ error: "Prayer request text is required." });
    return;
  }

  if (reqText.trim().length > 500) {
    res.status(400).json({ error: "Prayer request must be 500 characters or less." });
    return;
  }

  try {
    const result = await pool.query(
      `INSERT INTO prayer_requests (name, category, request, visitor_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, category, request, pray_count, created_at`,
      [
        (name?.trim() || "Anonymous").slice(0, 60),
        category || "general",
        reqText.trim(),
        visitorId || null,
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to submit prayer request" });
  }
});

router.post("/prayer/requests/:id/pray", async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(String(req.params["id"] ?? "0"), 10);
  if (!id || isNaN(id)) {
    res.status(400).json({ error: "Invalid prayer request ID" });
    return;
  }

  try {
    await pool.query(
      `UPDATE prayer_requests SET pray_count = pray_count + 1 WHERE id = $1`,
      [id]
    );
    const updated = await pool.query(
      `SELECT pray_count FROM prayer_requests WHERE id = $1`,
      [id]
    );
    res.json({ prayCount: updated.rows[0]?.pray_count ?? 0 });
  } catch (err) {
    res.status(500).json({ error: "Failed to update prayer count" });
  }
});

export default router;
