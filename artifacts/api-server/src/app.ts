import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { rateLimit } from "express-rate-limit";
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes";
import seoRouter from "./routes/seo";
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
    crossOriginResourcePolicy: { policy: "cross-origin" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    strictTransportSecurity: {
      maxAge: 60 * 60 * 24 * 365,
      includeSubDomains: true,
      preload: true,
    },
  }),
);

// Permissions-Policy — explicitly deny browser features the platform never
// uses, so a future XSS or third-party script cannot silently access them.
// `microphone` is allowed because the Voice TempleBots widget records audio.
app.use((_req, res, next) => {
  res.setHeader(
    "Permissions-Policy",
    [
      "accelerometer=()",
      "autoplay=(self)",
      "camera=(self)",
      "display-capture=()",
      "fullscreen=(self)",
      "geolocation=(self)",
      "gyroscope=()",
      "magnetometer=()",
      "microphone=(self)",
      "midi=()",
      "payment=(self)",
      "picture-in-picture=(self)",
      "publickey-credentials-get=()",
      "screen-wake-lock=(self)",
      "sync-xhr=()",
      "usb=()",
      "xr-spatial-tracking=()",
    ].join(", "),
  );
  next();
});

app.use(
  compression({
    level: 7,
    threshold: 512,
    filter(req, res) {
      if (req.headers["x-no-compression"]) return false;
      // Never compress SSE streams — they must be flushed unbuffered in real time.
      // EventSource clients send Accept: text/event-stream.
      const accept = req.headers["accept"] ?? "";
      if (accept.includes("text/event-stream")) return false;
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
      const isProduction = process.env.NODE_ENV === "production";
      const isConfiguredOrigin = ALLOWED_ORIGINS.has(origin);
      const isReplitOrigin = /\.replit\.(dev|app)$/.test(origin);
      const isRenderOrigin = /\.onrender\.com$/.test(origin);
      if (
        isConfiguredOrigin ||
        !isProduction ||
        (isReplitOrigin && process.env.ALLOW_REPLIT_ORIGINS === "true") ||
        (isRenderOrigin && process.env.ALLOW_RENDER_ORIGINS === "true")
      ) {
        return cb(null, true);
      }
      const err = new Error(`CORS: origin '${origin}' not allowed`) as Error & { status?: number };
      err.status = 403;
      cb(err);
    },
    credentials: true,
  }),
);

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 900,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
  skip: (req) => {
    if (req.method === "OPTIONS") return true;
    if (req.headers.accept?.includes("text/event-stream")) return true;
    if (req.method !== "GET") return false;
    return [
      "/api/livestream/status",
      "/api/livestream/viewers",
      "/api/visitors/stream",
      "/api/admin/realtime/stream",
      "/api/sermons/stream",
      "/api/gallery/stream",
      "/api/geo",
    ].some(pathname => req.path.startsWith(pathname));
  },
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

const galleryAdminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many gallery admin attempts. Please try again later." },
});

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use("/api", globalLimiter);
app.use("/api/ai", aiLimiter);
app.use("/api/prayer", aiLimiter);
app.use("/api/chat", aiLimiter);
app.use("/api/devotion", aiLimiter);
app.use("/api/auth", authLimiter);
app.use("/api/gallery/admin", galleryAdminLimiter);

// Render's port-detection probe sends HEAD / before routing to healthCheckPath.
// Handle HEAD only so GET / falls through to the SPA static handler in production.
app.head("/", (_req, res) => res.status(200).end());

// ── Sitemaps served at root (not under /api) for search engine discovery ─────
app.use(seoRouter);

app.use("/api", router);

if (process.env.NODE_ENV === "production") {
  const staticDir = path.resolve(__dirname, "../../jctm-platform/dist/public");

  // Hashed JS/CSS/image assets — cache forever, vary for encoding
  app.use(
    "/assets",
    express.static(path.join(staticDir, "assets"), {
      maxAge: "1y",
      immutable: true,
      etag: false,
      setHeaders(res) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        res.setHeader("Vary", "Accept-Encoding");
      },
    }),
  );

  // Static files (fonts, images, manifest, etc.)
  app.use(
    express.static(staticDir, {
      maxAge: "7d",
      etag: true,
      lastModified: true,
      index: false,
      setHeaders(res, filePath) {
        if (filePath.endsWith(".html") || filePath.endsWith("sw.js")) {
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
          res.setHeader("Pragma", "no-cache");
          res.setHeader("Expires", "0");
        } else if (/\.(png|jpe?g|webp|avif|svg|ico|gif)$/i.test(filePath)) {
          res.setHeader("Cache-Control", "public, max-age=604800, stale-while-revalidate=86400");
          res.setHeader("Vary", "Accept-Encoding");
        } else if (/\.(woff2?|ttf|otf|eot)$/i.test(filePath)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        } else if (/\.(json|xml|txt)$/i.test(filePath)) {
          res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=300");
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
app.use((err: Error & { status?: number; statusCode?: number }, req: Request, res: Response, _next: NextFunction): void => {
  const status = err.status ?? err.statusCode ?? 500;
  const meta = {
    err,
    status,
    requestId: (req as Request & { id?: unknown }).id,
    method: req.method,
    path: req.path,
  };
  if (status >= 500) {
    logger.error(meta, "Unhandled server error");
  } else {
    logger.warn(meta, "Request rejected");
  }
  if (!res.headersSent) {
    res.status(status).json({
      error: process.env.NODE_ENV === "production" && status >= 500
        ? "Internal server error"
        : err.message,
      requestId: (req as Request & { id?: unknown }).id,
    });
  }
});

export default app;
