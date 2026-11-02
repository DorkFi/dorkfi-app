import { generateAccount, makePaymentTxnWithSuggestedParamsFromObject } from "algosdk";
import { describe, expect, it } from "vitest";
import {
  ONRAMP_PROOF_PREFIX,
  partnerUserRefFromAlgorandAddress,
  verifyAlgorandOnrampProof,
} from "./walletProof";

const suggestedParams = {
  fee: 1000,
  minFee: 1000,
  flatFee: true,
  firstValid: 1,
  lastValid: 1000,
  genesisID: "mainnet-v1.0",
  genesisHash: new Uint8Array(32).fill(1),
};

function signedProof(args?: {
  amount?: number;
  expiry?: number;
  receiver?: string;
  group?: boolean;
}): string {
  const acct = generateAccount();
  const expiry = args?.expiry ?? Date.now() + 10 * 60 * 1000;
  const sender = acct.addr.toString();
  const note = new TextEncoder().encode(
    `${ONRAMP_PROOF_PREFIX}\n${expiry}\n${sender}`
  );
  const txn = makePaymentTxnWithSuggestedParamsFromObject({
    sender,
    receiver: args?.receiver ?? sender,
    amount: args?.amount ?? 0,
    note,
    suggestedParams,
  });
  if (args?.group) txn.group = new Uint8Array(32).fill(2);
  return Buffer.from(txn.signTxn(acct.sk)).toString("base64");
}

describe("verifyAlgorandOnrampProof", () => {
  it("accepts a signed zero payment to the same account", () => {
    const proof = signedProof();
    const address = verifyAlgorandOnrampProof(proof);
    expect(address).toMatch(/^[A-Z2-7]{58}$/);
  });

  it("rejects a payment that moves ALGO", () => {
    expect(() => verifyAlgorandOnrampProof(signedProof({ amount: 1 }))).toThrow(
      /zero-amount/
    );
  });

  it("rejects a payment to another account", () => {
    const other = generateAccount().addr.toString();
    expect(() =>
      verifyAlgorandOnrampProof(signedProof({ receiver: other }))
    ).toThrow(/same account/);
  });

  it("rejects an expired proof", () => {
    expect(() =>
      verifyAlgorandOnrampProof(signedProof({ expiry: Date.now() - 1000 }))
    ).toThrow(/expired/);
  });

  it("rejects a grouped transaction", () => {
    expect(() => verifyAlgorandOnrampProof(signedProof({ group: true }))).toThrow(
      /grouped/
    );
  });
});

describe("partnerUserRefFromAlgorandAddress", () => {
  it("stays within Coinbase’s 50 character limit", () => {
    const ref = partnerUserRefFromAlgorandAddress(
      "47YPQTIGQEO7T4Y4RWDYWEKV6RTR2UNBQXBABEEGM72ESWDQNCQ52OPASU"
    );
    expect(ref.startsWith("algo-")).toBe(true);
    expect(ref.length).toBeLessThanOrEqual(50);
  });
});
