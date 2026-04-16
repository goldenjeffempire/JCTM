import { Router, type IRouter, type Request, type Response } from "express";
import { ensureDevotionForDate, getDevotionHistory } from "../lib/devotion-engine.js";

const router: IRouter = Router();

router.get("/devotion/daily", async (_req: Request, res: Response): Promise<void> => {
  const today = new Date().toISOString().split("T")[0]!;
  try {
    const result = await ensureDevotionForDate(today);
    res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Devotion generation failed";
    res.status(500).json({ error: msg });
  }
});

router.get("/devotion/history", async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(Number(req.query.limit) || 7, 30);
    const devotions = await getDevotionHistory(limit);
    res.json({ devotions });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch devotion history";
    res.status(500).json({ error: msg });
  }
});

export default router;
