import { Router, type IRouter } from "express";
import healthRouter from "./health";
import sermonsRouter from "./sermons";
import testimoniesRouter from "./testimonies";
import eventsRouter from "./events";
import givingRouter from "./giving";
import membersRouter from "./members";
import chatRouter from "./chat";
import livestreamRouter from "./livestream";

const router: IRouter = Router();

router.use(healthRouter);
router.use(sermonsRouter);
router.use(testimoniesRouter);
router.use(eventsRouter);
router.use(givingRouter);
router.use(membersRouter);
router.use(chatRouter);
router.use(livestreamRouter);

export default router;
