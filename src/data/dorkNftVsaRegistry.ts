import vsaData from "@/data/dorkNftVsaRegistry.json";
import { canonicalDorkKey } from "@/data/dorkNftAlgorandRegistry";

const byCanonical = new Map<string, number>();

for (const [key, rawId] of Object.entries(vsaData.byCanonical ?? {})) {
  const id = Number(rawId);
  if (Number.isFinite(id) && id > 0) {
    byCanonical.set(key, id);
  }
}

/** Voi standard asset id for a Dork NFT (for opt-in after Algorand → Voi bridge). */
export function getDorkVsaAssetId(
  voiContractId: number,
  voiTokenId: number
): number | undefined {
  return byCanonical.get(canonicalDorkKey(voiContractId, voiTokenId));
}
