import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes";
import { logger } from "./lib/logger";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app: Express = express();

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
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));

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
