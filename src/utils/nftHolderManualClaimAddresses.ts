import { MAX_NFT_HOLDER_MANUAL_CLAIMS } from "@/services/paidWorkflowGateway";

/** Parse newline- or comma-separated AVM addresses (up to 100 unique). */
export function parseBeneficiaryAddressesFromText(text: string): {
  addresses: string[];
  errors: string[];
} {
  const errors: string[] = [];
  const parts = text
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    const key = p.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (p.length < 50 || p.length > 60) {
      errors.push(`Skipped invalid address: ${p.slice(0, 12)}…`);
      continue;
    }
    unique.push(p);
    if (unique.length >= MAX_NFT_HOLDER_MANUAL_CLAIMS) break;
  }
  if (parts.length > MAX_NFT_HOLDER_MANUAL_CLAIMS) {
    errors.push(`Only the first ${MAX_NFT_HOLDER_MANUAL_CLAIMS} unique addresses are used.`);
  }
  return { addresses: unique, errors };
}
