import { encodeAddress } from "algosdk";
import { describe, expect, it } from "vitest";
import {
  AlgoOnrampBindError,
  assertEvmOwnsXchainAddress,
  assertSolanaOwnsAlgorandAddress,
  deriveAlgorandAddressFromSolana,
} from "@/lib/easyStart/algorandFromSolana";

describe("deriveAlgorandAddressFromSolana", () => {
  it("encodes the all-zero Solana key as the matching Algorand address", () => {
    expect(
      deriveAlgorandAddressFromSolana("11111111111111111111111111111111")
    ).toBe(encodeAddress(new Uint8Array(32)));
  });

  it("rejects an address that is not 32 bytes", () => {
    expect(() => deriveAlgorandAddressFromSolana("1")).toThrow(/32 bytes/);
  });
});

describe("assertSolanaOwnsAlgorandAddress", () => {
  const solanaAddress = "11111111111111111111111111111111";
  const algorandAddress = deriveAlgorandAddressFromSolana(solanaAddress);

  it("accepts the derived address when the Solana key is on the session", () => {
    expect(
      assertSolanaOwnsAlgorandAddress({
        solanaAddress,
        algorandAddress,
        credentialValues: new Set([solanaAddress]),
      })
    ).toEqual({ solanaAddress, algorandAddress });
  });

  it("rejects a Solana key that Dynamic did not attest", () => {
    expect(() =>
      assertSolanaOwnsAlgorandAddress({
        solanaAddress,
        algorandAddress,
        credentialValues: new Set(),
      })
    ).toThrow(AlgoOnrampBindError);
  });

  it("rejects an Algorand address from a different key", () => {
    expect(() =>
      assertSolanaOwnsAlgorandAddress({
        solanaAddress,
        algorandAddress: encodeAddress(new Uint8Array(32).fill(1)),
        credentialValues: new Set([solanaAddress]),
      })
    ).toThrow(/does not match/);
  });
});

describe("assertEvmOwnsXchainAddress", () => {
  const evm = "0x0000000000000000000000000000000000000001";
  const algorandAddress = encodeAddress(new Uint8Array(32).fill(2));

  it("accepts the address derived from a session EVM wallet", async () => {
    await expect(
      assertEvmOwnsXchainAddress({
        evmAddresses: [evm],
        algorandAddress,
        derive: async () => algorandAddress,
      })
    ).resolves.toBe(algorandAddress);
  });

  it("rejects an address from a different account", async () => {
    await expect(
      assertEvmOwnsXchainAddress({
        evmAddresses: [evm],
        algorandAddress,
        derive: async () => encodeAddress(new Uint8Array(32).fill(3)),
      })
    ).rejects.toThrow(/does not match/);
  });

  it("rejects a session with no EVM wallet", async () => {
    await expect(
      assertEvmOwnsXchainAddress({
        evmAddresses: [],
        algorandAddress,
        derive: async () => algorandAddress,
      })
    ).rejects.toThrow(AlgoOnrampBindError);
  });
});
