import express, { type Express } from "express";
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
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));

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

  app.get("*", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(path.join(staticDir, "index.html"));
  });
}

export default app;
