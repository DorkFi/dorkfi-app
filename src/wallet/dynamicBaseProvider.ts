import { createPublicClient, http, type Address, type Hex, type WalletClient } from "viem";
import { base } from "viem/chains";

const BASE_CHAIN_HEX = "0x2105";

type JsonRpcRequest = { method: string; params?: unknown[] };

export type DynamicEip1193Provider = {
  request(args: JsonRpcRequest): Promise<unknown>;
};

function asBigInt(value: unknown): bigint | undefined {
  if (value == null || value === "") return undefined;
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (typeof value === "string") return BigInt(value);
  return undefined;
}

/**
 * EIP-1193 provider for Allbridge. Signing and sends go through the Dynamic
 * embedded wallet; reads go to Base public RPC.
 */
export function createDynamicBaseProvider(args: {
  address: Address;
  getWalletClient: () => Promise<WalletClient>;
}): DynamicEip1193Provider {
  const publicClient = createPublicClient({
    chain: base,
    transport: http("https://mainnet.base.org"),
  });

  return {
    async request({ method, params = [] }) {
      switch (method) {
        case "eth_chainId":
          return BASE_CHAIN_HEX;
        case "eth_accounts":
        case "eth_requestAccounts":
          return [args.address];
        case "wallet_switchEthereumChain": {
          const requested = (
            params[0] as { chainId?: string } | undefined
          )?.chainId?.toLowerCase();
          if (requested && requested !== BASE_CHAIN_HEX && requested !== "8453") {
            throw Object.assign(
              new Error("Easy Start wallet is on Base"),
              { code: 4902 }
            );
          }
          return null;
        }
        case "eth_sendTransaction": {
          const tx = (params[0] ?? {}) as {
            to?: Address;
            data?: Hex;
            value?: Hex | string | number | bigint;
            gas?: Hex | string | number | bigint;
          };
          if (!tx.to) throw new Error("Transaction is missing a recipient");
          const walletClient = await args.getWalletClient();
          const gas = asBigInt(tx.gas);
          return walletClient.sendTransaction({
            account: walletClient.account,
            to: tx.to,
            data: tx.data,
            value: asBigInt(tx.value) ?? 0n,
            ...(gas != null ? { gas } : {}),
          } as unknown as Parameters<WalletClient["sendTransaction"]>[0]);
        }
        case "eth_signTypedData_v4": {
          const raw = params[1];
          const typed =
            typeof raw === "string"
              ? (JSON.parse(raw) as {
                  domain: Record<string, unknown>;
                  types: Record<string, unknown>;
                  primaryType: string;
                  message: Record<string, unknown>;
                })
              : (raw as {
                  domain: Record<string, unknown>;
                  types: Record<string, unknown>;
                  primaryType: string;
                  message: Record<string, unknown>;
                });
          const walletClient = await args.getWalletClient();
          const { EIP712Domain: _domainType, ...types } = typed.types ?? {};
          return walletClient.signTypedData({
            account: walletClient.account,
            domain: typed.domain,
            types,
            primaryType: typed.primaryType,
            message: typed.message,
          } as Parameters<WalletClient["signTypedData"]>[0]);
        }
        case "wallet_sendCalls":
          throw new Error("wallet_sendCalls is not supported");
        default:
          return publicClient.request({
            method: method as "eth_chainId",
            params: params as never,
          });
      }
    },
  };
}
