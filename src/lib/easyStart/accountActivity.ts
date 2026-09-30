import type { NetworkId } from "@/config";
import { appendLocalSavingsTx } from "@/services/savingsTransactionHistory";

export const ACCOUNT_ACTIVITY_EVENT = "simplfi:account-activity";

export function recordAccountActivity(input: {
  id: string;
  address: string;
  networkId: NetworkId;
  title: string;
  amount?: string;
  symbol?: string;
  detail?: string;
}): void {
  const id = input.id.trim();
  const address = input.address.trim();
  if (!id || !address) return;
  appendLocalSavingsTx({
    txId: id,
    networkId: input.networkId,
    address,
    poolId: "account",
    kind: "activity",
    amount: input.amount,
    symbol: input.symbol,
    title: input.title,
    detail: input.detail,
    timestamp: Date.now(),
  });
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(ACCOUNT_ACTIVITY_EVENT));
}
