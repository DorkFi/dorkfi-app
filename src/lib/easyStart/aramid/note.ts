import {
  ARAMID_BASE_CHAIN_ID,
  ARAMID_BASE_USDC,
  ARAMID_NOTE,
  ARAMID_NOTE_PREFIX,
} from "@/lib/easyStart/aramid/constants";

/** AVM → Base USDC note (`aramid-transfer/v1:j{...}`). */
export function encodeAramidAvmToBaseNote(args: {
  evmAddress: string;
  feeAmount: bigint;
  destinationAmount: bigint;
}): Uint8Array {
  const noteObj = {
    destinationNetwork: ARAMID_BASE_CHAIN_ID,
    destinationAddress: args.evmAddress,
    destinationToken: ARAMID_BASE_USDC,
    feeAmount: Number(args.feeAmount),
    destinationAmount: Number(args.destinationAmount),
    note: ARAMID_NOTE,
    sourceAmount: Number(args.destinationAmount),
  };
  return new TextEncoder().encode(
    ARAMID_NOTE_PREFIX + JSON.stringify(noteObj)
  );
}
