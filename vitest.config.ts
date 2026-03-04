import { defineConfig } from "vitest/config";
import path from "path";
import react from "@vitejs/plugin-react-swc";

// Vitest config so CI can run unit tests. Uses same resolve/alias as Vite.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      buffer: "buffer",
    },
  },
  define: {
    global: "globalThis",
  },
  test: {
    environment: "node",
    globals: true,
    // Exclude service tests that depend on runtime config (gas station, envoi API).
    // Re-enable when those tests are updated or run in integration CI.
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/gasStationService.test.ts",
      "**/envoiService.test.ts",
    ],
  },
});
