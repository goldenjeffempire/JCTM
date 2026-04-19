import { Router, type IRouter } from "express";

const router: IRouter = Router();

function clean(value: unknown, max = 1200): string | null {
  if (typeof value !== "string") return null;
  return value.replace(/\s+/g, " ").trim().slice(0, max) || null;
}

router.post("/client-errors", (req, res): void => {
  const body = req.body as Record<string, unknown>;
  req.log.warn({
    source: clean(body.source, 80) ?? "frontend",
    message: clean(body.message, 500),
    stack: clean(body.stack, 2000),
    componentStack: clean(body.componentStack, 2000),
    path: clean(body.path, 300),
    userAgent: clean(body.userAgent, 300),
  }, "Frontend runtime error reported");
  res.status(202).json({ ok: true });
});

export default router;