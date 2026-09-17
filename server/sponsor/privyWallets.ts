import { getAddress } from "viem";
import { AuthError } from "../offramp/privyAuth.ts";

function asAddress(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(t)) return null;
  try {
    return getAddress(t);
  } catch {
    return null;
  }
}

function pushAddress(into: Set<string>, value: unknown): void {
  const addr = asAddress(value);
  if (addr) into.add(addr);
}

/**
 * Collect checksummed EVM addresses from a Privy user JSON payload.
 * Covers linked_accounts, embedded wallets, and a top-level wallet.
 */
export function collectWalletAddresses(payload: unknown): string[] {
  const found = new Set<string>();
  if (!payload || typeof payload !== "object") return [];
  const root = payload as Record<string, unknown>;

  const walkAccount = (account: unknown) => {
    if (!account || typeof account !== "object") return;
    const row = account as Record<string, unknown>;
    const type = typeof row.type === "string" ? row.type.toLowerCase() : "";
    if (type && type !== "wallet") return;
    pushAddress(found, row.address);
  };

  if (Array.isArray(root.linked_accounts)) {
    for (const account of root.linked_accounts) walkAccount(account);
  }
  if (Array.isArray(root.linkedAccounts)) {
    for (const account of root.linkedAccounts) walkAccount(account);
  }
  if (Array.isArray(root.embedded_wallets)) {
    for (const account of root.embedded_wallets) walkAccount(account);
  }
  if (Array.isArray(root.embeddedWallets)) {
    for (const account of root.embeddedWallets) walkAccount(account);
  }
  if (root.wallet && typeof root.wallet === "object") {
    pushAddress(found, (root.wallet as { address?: unknown }).address);
  }
  pushAddress(found, root.address);

  return [...found];
}

export function assertWalletOwnedByUser(
  evmAddress: string,
  owned: string[]
): void {
  const want = getAddress(evmAddress);
  if (!owned.some((addr) => addr === want)) {
    throw new AuthError(403, "Wallet is not linked to this session");
  }
}

export async function fetchPrivyWalletAddresses(args: {
  userId: string;
  privyAppId: string;
  privyAppSecret: string;
}): Promise<string[]> {
  const basic = Buffer.from(
    `${args.privyAppId}:${args.privyAppSecret}`
  ).toString("base64");
  const res = await fetch(
    `https://api.privy.io/v1/users/${encodeURIComponent(args.userId)}`,
    {
      headers: {
        Authorization: `Basic ${basic}`,
        "privy-app-id": args.privyAppId,
      },
    }
  );
  if (!res.ok) {
    throw new AuthError(503, "Could not verify wallet ownership");
  }
  const data: unknown = await res.json();
  return collectWalletAddresses(data);
}
