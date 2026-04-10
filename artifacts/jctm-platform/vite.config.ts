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
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/") || id.includes("node_modules/react-dom/")) return "react-core";
          if (id.includes("node_modules/three/") || id.includes("node_modules/@react-three/")) return "three-d";
          if (id.includes("node_modules/framer-motion/")) return "framer-motion";
          if (id.includes("node_modules/lucide-react/")) return "lucide-react";
          if (id.includes("node_modules/@radix-ui/")) return "radix-ui";
          if (id.includes("node_modules/wouter/")) return "router";
          if (id.includes("node_modules/@tanstack/")) return "tanstack-query";
          if (id.includes("node_modules/zod/") || id.includes("node_modules/zod-to-json-schema/")) return "validation";
          if (id.includes("node_modules/")) return "vendor";
        },
      },
    },
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
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
        path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
        path.resolve(import.meta.dirname),
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
