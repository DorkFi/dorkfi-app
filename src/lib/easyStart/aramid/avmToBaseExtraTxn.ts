import algosdk from "algosdk";
import {
  ARAMID_AVM_BRIDGE,
  ARAMID_ALGORAND_USDC_TOKEN_ID,
} from "@/lib/easyStart/aramid/constants";
import { encodeAramidAvmToBaseNote } from "@/lib/easyStart/aramid/note";
import {
  asAlgorandAddressString,
  requireAlgorandAddressString,
} from "@/lib/algorand/addressString";

/**
 * Same beacon `ci.setBeaconId` uses on Algorand mainnet.
 * arccjs `simulateTxn` does not honor `ignore: true`, so the dummy appl in
 * this extraTxn actually runs during simulate. The lending pool rejects
 * `appArgs: [0]`; the beacon `nop()` call does not.
 */
export const ARAMID_AVM_DUMMY_BEACON_APP = 3209233839;
/** arccjs `selNop` — `nop()void` */
export const ARAMID_AVM_DUMMY_NOP_SELECTOR = Uint8Array.of(
  0x58,
  0x75,
  0x9f,
  0xa2
);

/**
 * Standalone arccjs extraTxn: USDC ASA → Aramid AVM bridge (after pool redeem).
 * `ignore: true` omits the dummy appl from the signed group; `xamt` + snd≠arcv
 * emits the axfer.
 */
export function aramidAvmToBaseArccjsExtraTxn(args: {
  userAddress: string;
  sendAtomic: bigint;
  evmAddress: string;
  feeAmount: bigint;
  destinationAmount: bigint;
}): Record<string, unknown> {
  if (args.sendAtomic > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Withdraw amount is too large to bridge in one group.");
  }
  const user = requireAlgorandAddressString(args.userAddress, "user address");
  const note = encodeAramidAvmToBaseNote({
    evmAddress: args.evmAddress,
    feeAmount: args.feeAmount,
    destinationAmount: args.destinationAmount,
  });
  return {
    sender: user,
    appIndex: ARAMID_AVM_DUMMY_BEACON_APP,
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
    appArgs: [ARAMID_AVM_DUMMY_NOP_SELECTOR],
    accounts: [],
    foreignApps: [],
    foreignAssets: [Number(ARAMID_ALGORAND_USDC_TOKEN_ID)],
    fee: 1000,
    xaid: Number(ARAMID_ALGORAND_USDC_TOKEN_ID),
    snd: user,
    arcv: ARAMID_AVM_BRIDGE,
    xamt: Number(args.sendAtomic),
    xano: note,
    note,
    ignore: true,
    desc: "aramid USDC to Base",
  };
}

export function findAramidAxferTxId(txnsB64: string[]): string | undefined {
  for (const b64 of txnsB64) {
    try {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const txn = algosdk.decodeUnsignedTransaction(bytes);
      if (txn.type !== algosdk.TransactionType.axfer || !txn.assetTransfer) {
        continue;
      }
      const recv = asAlgorandAddressString(txn.assetTransfer.receiver);
      if (recv === ARAMID_AVM_BRIDGE) {
        return txn.txID();
      }
    } catch {
      continue;
    }
  }
  return undefined;
}
