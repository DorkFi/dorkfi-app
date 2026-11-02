/**
 * Shared client bootstrap for apps that mount DorkFi providers
 * (e.g. chub-hub). Kept in @dorkfi/app so dependency CSS resolves
 * against this package's node_modules.
 *
 * RainbowKit / wallet-ui CSS is loaded from XchainPrefiWalletUI so SimplFi
 * first paint is not blocked on that graph.
 */
import { Buffer } from "buffer";

(globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
if (!(globalThis as unknown as { TronWebProto?: unknown }).TronWebProto) {
  (globalThis as unknown as { TronWebProto: { Transaction: object } }).TronWebProto =
    { Transaction: {} };
}
