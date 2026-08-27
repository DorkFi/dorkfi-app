import {
  ARAMID_BASE_CHAIN_ID,
  ARAMID_BASE_USDC,
  ARAMID_NOTE,
  ARAMID_NOTE_PREFIX,
} from "@/lib/easyStart/aramid/constants";

/** AVM → Base USDC note (`aramid-transfer/v1:j{...}`). Amounts are integer strings. */
export function encodeAramidAvmToBaseNote(args: {
  evmAddress: string;
  feeAmount: bigint;
  destinationAmount: bigint;
}): Uint8Array {
  const dest = args.destinationAmount.toString();
  const noteObj = {
    destinationNetwork: ARAMID_BASE_CHAIN_ID,
    destinationAddress: args.evmAddress,
    destinationToken: ARAMID_BASE_USDC,
    feeAmount: args.feeAmount.toString(),
    destinationAmount: dest,
    note: ARAMID_NOTE,
    sourceAmount: dest,
  };
  return new TextEncoder().encode(
    ARAMID_NOTE_PREFIX + JSON.stringify(noteObj)
  );
}
