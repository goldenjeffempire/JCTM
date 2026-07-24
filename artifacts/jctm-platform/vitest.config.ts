import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

// NOTE: vitest must be run with NODE_ENV=test (not "production").
// react-dom/test-utils branches on NODE_ENV at require() time:
//   - "production" → react-dom-test-utils.production.js  (no React.act → tests crash)
//   - anything else → react-dom-test-utils.development.js (React.act available)
// The test script in package.json prefixes with NODE_ENV=test to ensure this.

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/tests/setup.ts"],
    include: ["src/tests/**/*.test.{ts,tsx}"],
    css: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
  },
});
