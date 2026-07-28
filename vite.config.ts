import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const GOVERNANCE_RAILWAY =
  "https://dorkfi-governance-node-production.up.railway.app";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const governanceLocalTarget =
    env.VITE_GOVERNANCE_LOCAL_TARGET || "http://127.0.0.1:8787";
  const governanceNgrokTarget =
    env.VITE_GOVERNANCE_NGROK_TARGET || "http://127.0.0.1:8787";
  const xShareLocalTarget =
    env.VITE_X_SHARE_LOCAL_TARGET || "http://127.0.0.1:8788";

  return {
  server: {
    host: "::",
    port: 8080,
    hmr: {
      protocol: "ws",
    },
    proxy: {
      '/api/orca': {
        target: 'https://orca-api.nautilus.sh',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/orca/, '/api'),
      },
      "/api/local": {
        target: governanceLocalTarget,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/local/, "") || "/",
      },
      "/api/railway": {
        target: GOVERNANCE_RAILWAY,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/railway/, "") || "/",
      },
      "/api/ngrok": {
        target: governanceNgrokTarget,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/ngrok/, "") || "/",
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            proxyReq.setHeader("ngrok-skip-browser-warning", "true");
          });
        },
      },
      "/api/x-share": {
        target: xShareLocalTarget,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/x-share/, "") || "/",
        configure: (proxy) => {
          proxy.on("proxyRes", (proxyRes) => {
            const cookies = proxyRes.headers["set-cookie"];
            if (!cookies) return;
            proxyRes.headers["set-cookie"] = cookies.map((cookie) =>
              cookie.replace(/;\s*Domain=[^;]+/i, "")
            );
          });
        },
      },
    },
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      buffer: "buffer",
    },
    dedupe: [
      "react",
      "react-dom",
      "@tanstack/react-query",
      "@txnlab/use-wallet-react",
      "wagmi",
      "@wagmi/core",
      "@rainbow-me/rainbowkit",
    ],
  },
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    include: [
      "buffer",
      "@txnlab/use-wallet-react",
      "@walletconnect/modal",
      "@walletconnect/sign-client",
      "@perawallet/connect",
      "lute-connect",
      "algosdk",
      "@algorandfoundation/algokit-utils",
    ],
    force: true, // Force re-optimization on next dev server start
  },
};
});
