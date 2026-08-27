import { defineConfig } from "vitest/config";
import path from "path";
import react from "@vitejs/plugin-react-swc";

// Vitest config so CI can run unit tests. Uses same resolve/alias as Vite.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "./src") },
      { find: "buffer", replacement: "buffer" },
      {
        find: /^algosdk\/unpatched$/,
        replacement: path.resolve(
          __dirname,
          "node_modules/algosdk/dist/esm/index.js"
        ),
      },
      {
        find: /^algosdk$/,
        replacement: path.resolve(
          __dirname,
          "src/lib/algorand/algosdkWithCoerce.ts"
        ),
      },
    ],
  },
  define: {
    global: "globalThis",
  },
  test: {
    environment: "node",
    globals: true,
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
});
