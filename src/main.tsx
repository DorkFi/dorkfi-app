import { Buffer } from "buffer";
import "@rainbow-me/rainbowkit/styles.css";
import "@txnlab/use-wallet-ui-react/dist/style.css";

// xChain / Allbridge-related polyfills (see docs/XCHAIN_ACCOUNTS_INTEGRATION_PLAN.md)
(globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
if (!(globalThis as unknown as { TronWebProto?: unknown }).TronWebProto) {
  (globalThis as unknown as { TronWebProto: { Transaction: object } }).TronWebProto =
    { Transaction: {} };
}

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
