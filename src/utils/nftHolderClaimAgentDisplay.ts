/** Human-readable claimable line from claim-agent JSON (matches Portfolio `nftHolderClaimableDisplayWithSymbol`). */
export function formatNftHolderClaimableDisplayFromAgent(agent: unknown): string {
  if (!agent || typeof agent !== "object") return "—";
  const o = agent as {
    totalClaimableDisplay?: unknown;
    batches?: Array<{ slots?: Array<{ rewardSymbol?: unknown }> }>;
  };
  const raw = o.totalClaimableDisplay;
  if (typeof raw !== "string") return "—";
  const amount = raw.trim();
  if (!amount) return "—";
  const syms = new Set<string>();
  for (const b of o.batches ?? []) {
    for (const s of b.slots ?? []) {
      const sym = typeof s.rewardSymbol === "string" ? s.rewardSymbol.trim() : "";
      if (sym) syms.add(sym);
    }
  }
  if (syms.size === 1) return `${amount} ${[...syms][0]}`;
  if (syms.size > 1) return `${amount} (${[...syms].join(" · ")})`;
  return amount;
}
