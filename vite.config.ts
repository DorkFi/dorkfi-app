import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const GOVERNANCE_RAILWAY =
  "https://dorkfi-governance-node-production.up.railway.app";

const DEFAULT_CLAIM_AGENT_UPSTREAM =
  "https://claim-agent-production.up.railway.app";

/**
 * Dev-only proxy for the NFT claim agent (secrets stay here — never use `VITE_*` for API keys):
 * - `NFT_CLAIM_AGENT_API_KEY` — optional Bearer token forwarded to the upstream.
 * - `CLAIM_AGENT_UPSTREAM_URL` — optional; default Railway host above.
 * - `CLAIM_AGENT_PROXY_PATH` — optional; default `/api/claim-agent` (must match `VITE_CLAIM_AGENT_PROXY_PATH` when using the proxy in the app).
 * Production static hosts must mirror this route (reverse proxy or edge) + the same env as server-side secrets.
 */

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const governanceLocalTarget =
    env.VITE_GOVERNANCE_LOCAL_TARGET || "http://127.0.0.1:8787";
  const governanceNgrokTarget =
    env.VITE_GOVERNANCE_NGROK_TARGET || "http://127.0.0.1:8787";
  const claimAgentProxyPath =
    env.CLAIM_AGENT_PROXY_PATH?.trim() || "/api/claim-agent";
  const claimAgentUpstream =
    env.CLAIM_AGENT_UPSTREAM_URL?.trim() || DEFAULT_CLAIM_AGENT_UPSTREAM;

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
      [claimAgentProxyPath]: {
        target: claimAgentUpstream,
        changeOrigin: true,
        rewrite: (reqPath) => {
          if (!reqPath.startsWith(claimAgentProxyPath)) return reqPath;
          return "/claim" + reqPath.slice(claimAgentProxyPath.length);
        },
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            const key = env.NFT_CLAIM_AGENT_API_KEY?.trim();
            if (key) proxyReq.setHeader("Authorization", `Bearer ${key}`);
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
