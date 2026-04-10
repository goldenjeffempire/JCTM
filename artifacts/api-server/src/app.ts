import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { rateLimit } from "express-rate-limit";
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes";
import { logger } from "./lib/logger";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app: Express = express();

app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  }),
);

app.use(
  compression({
    level: 6,
    threshold: 1024,
    filter(req, res) {
      if (req.headers["x-no-compression"]) return false;
      return compression.filter(req, res);
    },
  }),
);

const ALLOWED_ORIGINS = new Set([
  "https://jctm.org.ng",
  "https://www.jctm.org.ng",
  "https://jctm.onrender.com",
  ...(process.env.ALLOWED_ORIGINS ?? "").split(",").map(s => s.trim()).filter(Boolean),
]);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (
        ALLOWED_ORIGINS.has(origin) ||
        /\.replit\.dev$/.test(origin) ||
        /\.replit\.app$/.test(origin) ||
        /\.onrender\.com$/.test(origin) ||
        process.env.NODE_ENV !== "production"
      ) {
        return cb(null, true);
      }
      cb(new Error(`CORS: origin '${origin}' not allowed`));
    },
    credentials: true,
  }),
);

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
  skip: (req) => req.method === "OPTIONS",
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "AI request limit reached. Please wait a moment and try again." },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many authentication attempts. Please try again later." },
});

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use("/api", globalLimiter);
app.use("/api/ai", aiLimiter);
app.use("/api/prayer", aiLimiter);
app.use("/api/chat", aiLimiter);
app.use("/api/devotion", aiLimiter);
app.use("/api/auth", authLimiter);

// Render's port-detection probe sends HEAD / before routing to healthCheckPath.
// Handle HEAD only so GET / falls through to the SPA static handler in production.
app.head("/", (_req, res) => res.status(200).end());

app.use("/api", router);

if (process.env.NODE_ENV === "production") {
  const staticDir = path.resolve(__dirname, "../../jctm-platform/dist/public");

  app.use(
    "/assets",
    express.static(path.join(staticDir, "assets"), {
      maxAge: "1y",
      immutable: true,
      etag: false,
      setHeaders(res) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      },
    }),
  );

  app.use(
    express.static(staticDir, {
      maxAge: "1h",
      etag: true,
      index: false,
      setHeaders(res, filePath) {
        if (filePath.endsWith(".html")) {
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        }
      },
    }),
  );

  // Express 5: "/*splat" requires ≥1 character after the slash, so GET /
  // falls through.  Use "/{*splat}" (optional group) to also match the root.
  app.get("/{*splat}", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(path.join(staticDir, "index.html"));
  });
}

// 404 handler — catches any request that fell through all routes
app.use((_req: Request, res: Response): void => {
  res.status(404).json({ error: "Not found" });
});

// Global JSON error handler — must be defined last, after all routes and middleware.
// Express 5 automatically forwards async errors here; no try/catch needed in routes.
app.use((err: Error & { status?: number; statusCode?: number }, _req: Request, res: Response, _next: NextFunction): void => {
  const status = err.status ?? err.statusCode ?? 500;
  logger.error({ err, status }, "Unhandled error");
  if (!res.headersSent) {
    res.status(status).json({
      error: process.env.NODE_ENV === "production" && status >= 500
        ? "Internal server error"
        : err.message,
    });
  }
});

export default app;
