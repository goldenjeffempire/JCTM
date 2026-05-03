import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

// PORT is required at runtime (dev / preview) but NOT during `vite build`.
// The dev server never starts in a build, so we default to 3000 when PORT is
// absent so that production CI / deployment build steps don't fail.
const rawPort = process.env.PORT;
const port = rawPort ? Number(rawPort) : 3000;

if (rawPort && (Number.isNaN(port) || port <= 0)) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// BASE_PATH sets the Vite `base` option, which prefixes all asset URLs in the
// built output.  "/" is the correct default for both Replit and Render.
const basePath = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base: basePath,
  cacheDir: path.resolve(import.meta.dirname, "../../.cache/vite-jctm-platform"),
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    target: "es2020",
    cssCodeSplit: true,
    sourcemap: false,
    assetsInlineLimit: 4096,
    reportCompressedSize: false,
    // Three.js alone is ~1.8 MB minified — it cannot be reduced further.
    // It is already lazy-loaded (only fetched when GlobalAltar3D renders),
    // so the large chunk does not affect initial page load.
    chunkSizeWarningLimit: 2600,
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          // Keep react and all its transitive deps together to avoid circular chunks
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/scheduler/") ||
            id.includes("node_modules/react-is/")
          ) return "react-core";
          // Split Three.js core from the react-three ecosystem for better cache granularity
          if (id.includes("node_modules/three/")) return "three-core";
          if (id.includes("node_modules/@react-three/")) return "three-react";
          if (id.includes("node_modules/framer-motion/")) return "framer-motion";
          if (id.includes("node_modules/lucide-react/")) return "lucide-react";
          if (id.includes("node_modules/@radix-ui/")) return "radix-ui";
          if (id.includes("node_modules/wouter/")) return "router";
          if (id.includes("node_modules/@tanstack/")) return "tanstack-query";
          if (id.includes("node_modules/zod") || id.includes("node_modules/zod-to-json-schema/")) return "validation";
          if (id.includes("node_modules/date-fns/")) return "date-fns";
          if (id.includes("node_modules/clsx/") || id.includes("node_modules/class-variance-authority/") || id.includes("node_modules/tailwind-merge/")) return "styling-utils";
          if (id.includes("node_modules/@hookform/") || id.includes("node_modules/react-hook-form/")) return "forms";
          if (id.includes("node_modules/sonner/")) return "notifications";
          if (id.includes("node_modules/recharts/") || id.includes("node_modules/d3-")) return "charts";
          if (id.includes("node_modules/cmdk/")) return "command";
          // No vendor catch-all: let Rollup auto-chunk remaining packages to avoid circular dependencies
        },
      },
    },
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "framer-motion",
      "wouter",
      "@tanstack/react-query",
      "lucide-react",
      "sonner",
      "date-fns",
      "clsx",
      "tailwind-merge",
      "class-variance-authority",
    ],
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    origin: process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : `http://localhost:${port}`,
    hmr: process.env.REPLIT_DEV_DOMAIN
      ? {
          protocol: "wss",
          host: process.env.REPLIT_DEV_DOMAIN,
          port: 443,
          clientPort: 443,
        }
      : true,
    headers: {
      "Cache-Control": "no-store",
    },
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
        secure: false,
        configure(proxy) {
          proxy.on("proxyReq", (_proxyReq, req) => {
            if (req.url?.includes("/stream")) {
              _proxyReq.setHeader("Connection", "keep-alive");
            }
          });
        },
      },
    },
    fs: {
      strict: true,
      allow: [
        path.resolve(import.meta.dirname, "..", ".."),
      ],
      deny: ["**/.*"],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
