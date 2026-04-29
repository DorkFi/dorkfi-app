import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
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
}));
