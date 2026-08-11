#!/usr/bin/env node
/**
 * Print the pre-production wallet QA checklist.
 * Manual steps — run on testnet first, then tiny mainnet amounts.
 *
 * Usage: npm run qa:wallet
 */

const steps = [
  "Connect wallet (Pera / Defly / WalletConnect as supported)",
  "Confirm correct network (VOI / Algorand) and address in header",
  "Markets page: rows load; prices and APYs look sane (not all zero/NaN)",
  "Open a market modal: stats + primary actions render",
  "Supply a small amount → sign → wait for confirmation",
  "Portfolio: deposit appears; health / collateral updates",
  "Borrow a small amount → health factor moves as expected",
  "Repay (same asset) → debt decreases",
  "Withdraw (partial) → deposit decreases; wallet balance increases",
  "If swaps enabled: get Haystack/Tinyman quote → execute tiny swap",
  "If migration shown: migrate one position; balances move to new pool",
  "Disconnect / reconnect: portfolio still resolves for the address",
  "View-only portfolio URL /portfolio/:address loads without wallet",
];

console.log("\nDorkFi wallet QA checklist\n");
steps.forEach((s, i) => {
  console.log(`  [ ] ${i + 1}. ${s}`);
});
console.log(`
Tips:
  • Prefer testnet / tiny amounts first.
  • Capture failing tx IDs and console errors.
  • Run \`npm run smoke:apis\` with \`npm run dev\` up before wallet tests.
`);
