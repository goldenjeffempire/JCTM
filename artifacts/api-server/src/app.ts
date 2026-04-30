import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { rateLimit } from "express-rate-limit";
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "node:crypto";
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
    // CSP: allow YouTube embeds + Google AdSense + webfonts while blocking
    // everything else. 'unsafe-inline' for scripts is required by AdSense.
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",          // Required by Google AdSense
          "'unsafe-eval'",            // Required by some AdSense creatives
          "https://www.youtube.com",
          "https://s.ytimg.com",
          "https://pagead2.googlesyndication.com",
          "https://partner.googleadservices.com",
          "https://adservice.google.com",
          "https://tpc.googlesyndication.com",
          "https://googleads.g.doubleclick.net",
          "https://www.googletagservices.com",
          "https://accounts.google.com",
          "https://cdn.onesignal.com",
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",          // Tailwind & Radix inject inline styles
          "https://fonts.googleapis.com",
        ],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: [
          "'self'",
          "data:",
          "blob:",
          "https://i.ytimg.com",
          "https://img.youtube.com",
          "https://yt3.ggpht.com",
          "https://yt3.googleusercontent.com",
          "https://*.googlesyndication.com",
          "https://*.doubleclick.net",
          "https://lh3.googleusercontent.com",
          "https://www.google.com",
          "https://www.gstatic.com",
        ],
        // Allow YouTube player iframes + AdSense iframes
        frameSrc: [
          "https://www.youtube.com",
          "https://youtube.com",
          "https://tpc.googlesyndication.com",
          "https://googleads.g.doubleclick.net",
          "https://bid.g.doubleclick.net",
        ],
        connectSrc: [
          "'self'",
          "https://www.youtube.com",
          "https://youtube.com",
          "https://*.googlevideo.com",
          "https://pagead2.googlesyndication.com",
          "https://adservice.google.com",
          "wss:",
          "ws:",
        ],
        mediaSrc: [
          "'self'",
          "blob:",
          "https://*.googlevideo.com",
          "https://www.youtube.com",
          "https://rr*.googlevideo.com",
        ],
        workerSrc: ["'self'", "blob:"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
        upgradeInsecureRequests: [],
      },
    },
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

// X-Request-ID — surfaces a stable trace ID in every response so logs
// and client error reports can be correlated without exposing internals.
app.use((req, res, next) => {
  const requestId = (req.headers["x-request-id"] as string) || randomUUID();
  res.setHeader("X-Request-ID", requestId);
  next();
});

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

  // ─── Edge-cache layering strategy ──────────────────────────────────────────
  // We set THREE families of cache headers on every static response:
  //   • Cache-Control               — what the user's browser does
  //   • CDN-Cache-Control           — RFC 9213 standard for any CDN edge
  //   • Cloudflare-CDN-Cache-Control — vendor-specific override for Cloudflare
  // CDNs honour the most-specific header they recognise, so layering is safe:
  // a request that hits Cloudflare uses CF-CDN-Cache-Control, then any other
  // CDN uses the standard CDN-Cache-Control, and finally the browser uses
  // Cache-Control. This lets us cache aggressively at the edge while keeping
  // browsers honest about revalidation, so deploys go live almost instantly.
  // ───────────────────────────────────────────────────────────────────────────

  // Hashed JS/CSS/image assets — cache forever everywhere (filename changes on rebuild)
  app.use(
    "/assets",
    express.static(path.join(staticDir, "assets"), {
      maxAge: "1y",
      immutable: true,
      etag: false,
      setHeaders(res) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        res.setHeader("CDN-Cache-Control", "public, max-age=31536000, immutable");
        res.setHeader("Cloudflare-CDN-Cache-Control", "public, max-age=31536000, immutable");
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
        if (filePath.endsWith("sw.js")) {
          // Service worker MUST always revalidate so users get new versions.
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
          res.setHeader("CDN-Cache-Control", "no-store");
          res.setHeader("Cloudflare-CDN-Cache-Control", "no-store");
          res.setHeader("Pragma", "no-cache");
          res.setHeader("Expires", "0");
        } else if (filePath.endsWith(".html")) {
          // Browser must revalidate so deploys go live; CDN edge keeps a copy
          // for 60s with 10-min stale-while-revalidate window — invisible to
          // users but eliminates origin hits during traffic spikes.
          res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
          res.setHeader("CDN-Cache-Control", "public, s-maxage=60, stale-while-revalidate=600");
          res.setHeader("Cloudflare-CDN-Cache-Control", "public, s-maxage=60, stale-while-revalidate=600");
          res.setHeader("Vary", "Accept-Encoding");
        } else if (/\.(png|jpe?g|webp|avif|svg|ico|gif)$/i.test(filePath)) {
          // Browsers cache 7d, edge caches 30d (images rarely change in place).
          res.setHeader("Cache-Control", "public, max-age=604800, stale-while-revalidate=86400");
          res.setHeader("CDN-Cache-Control", "public, max-age=2592000, stale-while-revalidate=604800");
          res.setHeader("Cloudflare-CDN-Cache-Control", "public, max-age=2592000, stale-while-revalidate=604800");
          res.setHeader("Vary", "Accept-Encoding");
        } else if (/\.(woff2?|ttf|otf|eot)$/i.test(filePath)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          res.setHeader("CDN-Cache-Control", "public, max-age=31536000, immutable");
          res.setHeader("Cloudflare-CDN-Cache-Control", "public, max-age=31536000, immutable");
        } else if (/\.(json|xml|txt|webmanifest)$/i.test(filePath)) {
          // Manifest, robots, sitemaps — short browser cache, longer edge cache.
          res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=300");
          res.setHeader("CDN-Cache-Control", "public, max-age=86400, stale-while-revalidate=3600");
          res.setHeader("Cloudflare-CDN-Cache-Control", "public, max-age=86400, stale-while-revalidate=3600");
          res.setHeader("Vary", "Accept-Encoding");
        }
      },
    }),
  );

  // Express 5: "/*splat" requires ≥1 character after the slash, so GET /
  // falls through.  Use "/{*splat}" (optional group) to also match the root.
  // SPA fallback also gets the layered cache strategy so the homepage benefits
  // from edge caching exactly like every other HTML response above.
  app.get("/{*splat}", (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
    res.setHeader("CDN-Cache-Control", "public, s-maxage=60, stale-while-revalidate=600");
    res.setHeader("Cloudflare-CDN-Cache-Control", "public, s-maxage=60, stale-while-revalidate=600");
    res.setHeader("Vary", "Accept-Encoding");
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
