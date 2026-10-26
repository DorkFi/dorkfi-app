import algosdk from "algosdk";
import type { NftBridgeDirection } from "@/config/nftBridge";
import envoiService, {
  type EnvoiAddressResponse,
} from "@/services/envoiService";
import { resolveDorkAvatarEntry } from "@/services/algorandNftService";
import { normalizeBridgeAddressInput } from "@/services/nftBridgeService";

const NFD_API = "https://api.nf.domains/nfd";

export type BridgeDestinationResolved = {
  address: string;
  matched: "address" | "envoi" | "nfd";
  displayName: string;
  avatarUrl?: string;
  nftLabel?: string;
};

export type BridgeDestinationResolveResult =
  | ({ ok: true } & BridgeDestinationResolved)
  | { ok: false; message: string };

function pickEnvoiAddress(data: EnvoiAddressResponse): string | null {
  const fromResult = (data as { results?: EnvoiAddressResponse[] }).results?.[0];
  const row = fromResult ?? data;
  return row.address ?? row.addr ?? row.wallet ?? row.owner ?? null;
}

function envoiHintsFromMetadata(metadata: unknown): {
  avatarUrl?: string;
  nftLabel?: string;
} {
  if (!metadata || typeof metadata !== "object") return {};
  const meta = metadata as Record<string, unknown>;
  const avatarUrl =
    typeof meta.avatar === "string"
      ? meta.avatar
      : typeof meta.image === "string"
        ? meta.image
        : undefined;
  const avatarDorkfi =
    typeof meta["avatar_dorkfi"] === "string" ? meta["avatar_dorkfi"] : undefined;
  const entry = resolveDorkAvatarEntry(avatarDorkfi);
  return {
    avatarUrl: entry?.imageUrl ?? avatarUrl,
    nftLabel: entry?.name,
  };
}

async function resolveEnvoiName(name: string): Promise<BridgeDestinationResolveResult> {
  const lookup = name.toLowerCase().endsWith(".voi") ? name : `${name}.voi`;
  if (!envoiService.isValidNameFormat(lookup)) {
    return { ok: false, message: "Enter a valid enVoi name (e.g. haroof.voi)." };
  }
  const data = await envoiService.resolveAddress(lookup);
  const address = data ? pickEnvoiAddress(data) : null;
  if (!address || !algosdk.isValidAddress(address)) {
    return { ok: false, message: `Could not resolve ${lookup} on enVoi.` };
  }
  const metadata = (data as { metadata?: unknown })?.metadata
    ?? (data as { results?: Array<{ metadata?: unknown }> })?.results?.[0]?.metadata;
  const hints = envoiHintsFromMetadata(metadata);
  return {
    ok: true,
    address: normalizeBridgeAddressInput(address),
    matched: "envoi",
    displayName: lookup,
    ...hints,
  };
}

async function resolveNfdName(name: string): Promise<BridgeDestinationResolveResult> {
  const lookup = name.toLowerCase().endsWith(".algo") ? name : `${name}.algo`;
  if (!/^[a-z0-9-]+\.algo$/i.test(lookup)) {
    return { ok: false, message: "Enter a valid NFD name (e.g. haroof.algo)." };
  }
  try {
    const res = await fetch(`${NFD_API}/${encodeURIComponent(lookup)}`);
    if (!res.ok) {
      return { ok: false, message: `Could not resolve ${lookup} on NFD.` };
    }
    const data = (await res.json()) as {
      owner?: string;
      depositAccount?: string;
      caAlgo?: string[];
      name?: string;
    };
    const address =
      data.owner ??
      data.depositAccount ??
      data.caAlgo?.[0] ??
      null;
    if (!address || !algosdk.isValidAddress(address)) {
      return { ok: false, message: `No wallet found for ${lookup}.` };
    }
    return {
      ok: true,
      address: normalizeBridgeAddressInput(address),
      matched: "nfd",
      displayName: data.name ?? lookup,
    };
  } catch {
    return { ok: false, message: `Could not reach NFD to resolve ${lookup}.` };
  }
}

/**
 * Resolve a bridge destination field: 58-char address, enVoi (.voi), or NFD (.algo).
 */
export async function resolveBridgeDestinationInput(
  rawInput: string,
  direction: NftBridgeDirection
): Promise<BridgeDestinationResolveResult> {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { ok: false, message: "Enter a destination address or name." };
  }

  const asAddress = normalizeBridgeAddressInput(trimmed);
  if (algosdk.isValidAddress(asAddress)) {
    return {
      ok: true,
      address: asAddress,
      matched: "address",
      displayName: asAddress,
    };
  }

  const lower = trimmed.toLowerCase();
  const destIsVoi = direction === "algorand-to-voi";

  if (lower.endsWith(".algo")) {
    if (destIsVoi) {
      return {
        ok: false,
        message:
          "This bridge leg receives on Voi. Use a .voi name or Voi wallet address, not .algo.",
      };
    }
    return resolveNfdName(trimmed);
  }

  if (lower.endsWith(".voi") || envoiService.isValidNameFormat(trimmed)) {
    if (!destIsVoi) {
      return {
        ok: false,
        message:
          "This bridge leg receives on Algorand. Use a .algo name or Algorand wallet address, not .voi.",
      };
    }
    return resolveEnvoiName(trimmed);
  }

  if (destIsVoi) {
    return resolveEnvoiName(trimmed);
  }
  return resolveNfdName(trimmed);
}
