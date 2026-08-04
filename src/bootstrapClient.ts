/**
 * Shared client bootstrap for apps that mount DorkFi providers
 * (e.g. chub-hub). Kept in @dorkfi/app so dependency CSS resolves
 * against this package's node_modules.
 */
import { Buffer } from "buffer";
import "@rainbow-me/rainbowkit/styles.css";
import "@txnlab/use-wallet-ui-react/dist/style.css";

(globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
if (!(globalThis as unknown as { TronWebProto?: unknown }).TronWebProto) {
  (globalThis as unknown as { TronWebProto: { Transaction: object } }).TronWebProto =
    { Transaction: {} };
}
