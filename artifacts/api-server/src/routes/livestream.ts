import { Router, type IRouter } from "express";
import {
  GetLivestreamStatusResponse,
  UpdateLivestreamStatusBody,
  UpdateLivestreamStatusResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

// In-memory livestream state (persists for the server process lifetime)
let livestreamState = {
  isLive: false,
  title: null as string | null,
  streamUrl: null as string | null,
  startedAt: null as string | null,
};

router.get("/livestream/status", async (_req, res): Promise<void> => {
  res.json(GetLivestreamStatusResponse.parse(livestreamState));
});

router.post("/livestream/status", async (req, res): Promise<void> => {
  const parsed = UpdateLivestreamStatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { isLive, title, streamUrl } = parsed.data;

  livestreamState = {
    isLive,
    title: title ?? null,
    streamUrl: streamUrl ?? null,
    startedAt: isLive ? (livestreamState.isLive ? livestreamState.startedAt : new Date().toISOString()) : null,
  };

  res.json(UpdateLivestreamStatusResponse.parse(livestreamState));
});

export default router;
