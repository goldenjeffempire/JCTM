import { Router, type IRouter } from "express";
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

const router: IRouter = Router();

router.use(healthRouter);
router.use(sermonsRouter);
router.use(websubRouter);
router.use(testimoniesRouter);
router.use(eventsRouter);
router.use(givingRouter);
router.use(membersRouter);
router.use(authRouter);
router.use(chatRouter);
router.use(livestreamRouter);
router.use(altarRouter);
router.use(crusadeRouter);

export default router;
