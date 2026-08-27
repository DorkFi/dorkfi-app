/**
 * Single algosdk entry used by the app and ulujs/arccjs.
 * Stringifies Address-like fields before make*Txn so a second algosdk copy
 * cannot trip `ensureAddress` (`Not an address`).
 *
 * Vite aliases `algosdk` → this file and `algosdk/unpatched` → the real package.
 */
import * as orig from "algosdk/unpatched";
import { coerceTxnAddressFields } from "@/lib/algorand/addressString";

const MAKE_TXN_FNS = [
  "makeApplicationCallTxnFromObject",
  "makeApplicationCreateTxnFromObject",
  "makeApplicationUpdateTxnFromObject",
  "makeApplicationDeleteTxnFromObject",
  "makePaymentTxnWithSuggestedParamsFromObject",
  "makeAssetTransferTxnWithSuggestedParamsFromObject",
  "makeAssetCreateTxnFromObject",
  "makeAssetConfigTxnFromObject",
  "makeAssetDestroyTxnFromObject",
  "makeAssetFreezeTxnFromObject",
  "makeKeyRegistrationTxnFromObject",
] as const;

type MakeTxnFn = (opts: Record<string, unknown>, ...rest: unknown[]) => unknown;

function wrapMakeTxn(fn: MakeTxnFn): MakeTxnFn {
  return (opts, ...rest) => fn(coerceTxnAddressFields(opts), ...rest);
}

const wrapped = { ...orig } as typeof orig;
for (const name of MAKE_TXN_FNS) {
  const fn = orig[name];
  if (typeof fn === "function") {
    (wrapped as Record<string, unknown>)[name] = wrapMakeTxn(
      fn as MakeTxnFn
    );
  }
}

export default wrapped;
export * from "algosdk/unpatched";
