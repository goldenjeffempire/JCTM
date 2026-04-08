import { Router, type IRouter, type Request, type Response } from "express";
import healthRouter from "./health";
import sermonsRouter from "./sermons";
import websubRouter from "./websub";
import testimoniesRouter from "./testimonies";
import eventsRouter from "./events";
import givingRouter from "./giving";
import membersRouter from "./members";
import authRouter from "./auth";
import chatRouter from "./chat";
import livestreamRouter from "./livestream";
import altarRouter from "./altar";
import crusadeRouter from "./crusade";
import prayerRouter from "./prayer";
import devotionRouter from "./devotion";
import sermonAssistantRouter from "./sermon-assistant";
import livechatRouter from "./livechat";
import translateRouter from "./translate";

const router: IRouter = Router();

router.use(healthRouter);
// websubRouter must come before sermonsRouter — otherwise GET /sermons/websub
// is captured by the /sermons/:id wildcard route in sermonsRouter.
router.use(websubRouter);
router.use(sermonsRouter);
router.use(testimoniesRouter);
router.use(eventsRouter);
router.use(givingRouter);
router.use(membersRouter);
router.use(authRouter);
router.use(chatRouter);
router.use(livestreamRouter);
router.use(altarRouter);
router.use(crusadeRouter);
router.use(prayerRouter);
router.use(devotionRouter);
router.use(sermonAssistantRouter);
router.use(livechatRouter);
router.use(translateRouter);

// API 404 — any /api/* path that matched no route above returns JSON, never HTML
router.use((_req: Request, res: Response): void => {
  res.status(404).json({ error: "API endpoint not found" });
});

export default router;
