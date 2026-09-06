/**
 * Pure helpers for asset decimal display and oracle price conversion.
 * See docs/ASSET_DECIMALS_AND_DISPLAY.md for context.
 */

import BigNumber from "bignumber.js";
import { normalizeWadUsdPerToken } from "@/lib/utils";

/** Max fraction digits we show for asset amounts (e.g. goBTC has 8). */
const MAX_DISPLAY_DECIMALS = 8;

/**
 * Returns the number of decimal places to show for an asset amount.
 * Used so high-decimal assets (e.g. 8 for goBTC) don't get truncated and users
 * don't think they "lost" dust.
 *
 * @param tokenDecimals - from token config (e.g. 6 or 8)
 * @param defaultDecimals - used when tokenDecimals is undefined (default 6)
 * @returns value in [0, MAX_DISPLAY_DECIMALS]
 */
export function getDisplayDecimals(
  tokenDecimals: number | undefined,
  defaultDecimals: number = 6
): number {
  const decimals = tokenDecimals ?? defaultDecimals;
  return Math.min(Math.max(0, Math.floor(decimals)), MAX_DISPLAY_DECIMALS);
}

/**
 * Oracle stores price in 12-decimal scale. Converts raw price to human-readable
 * token price (USD per 1 token) using the token's decimals.
 *
 * @param rawPrice - from market.price (oracle 12-decimal scale)
 * @param tokenDecimals - from token config (e.g. 6 or 8)
 * @returns USD per 1 token
 */
export function getTokenPriceFromOracle(
  rawPrice: number,
  tokenDecimals: number
): number {
  if (!rawPrice || !Number.isFinite(rawPrice)) return 0;
  const adjustment = 12 - tokenDecimals;
  const divisor = Math.pow(10, adjustment);
  return rawPrice / divisor;
}

/**
 * USD per 1 token from `MarketInfo.price` as returned by `fetchMarketInfo` in lendingService
 * (`formatPrice`: on-chain price ÷ 1e18). Applies the same 12-decimal oracle adjustment as
 * Portfolio `formatPriceFromContract(market.price, tokenDecimals)` — not `getTokenPriceFromOracle`
 * on `priceRaw` (full integer), which would double-apply scaling vs the formatted field.
 */
export function usdPerTokenFromMarketInfoFormattedPrice(
  formattedPrice: string | number,
  tokenDecimals: number
): number {
  const price =
    typeof formattedPrice === "string"
      ? parseFloat(formattedPrice)
      : formattedPrice;
  if (!price || !Number.isFinite(price) || price === 0) return 0;
  const adjustment = 12 - tokenDecimals;
  return price / Math.pow(10, adjustment);
}

/**
 * Human USD per 1 token from a market `price` field (same as Portfolio / chain live).
 *
 * - Normal case: `fetchMarketInfo` sets `price` to on-chain ÷ 1e18 (`formatPrice`); that value
 *   is still on the **12-decimal oracle scale** → apply `÷ 10^(12 − tokenDecimals)` (e.g. ÷1e6
 *   for 6-decimal USDC). See {@link usdPerTokenFromMarketInfoFormattedPrice}.
 * - Raw on-chain uint still present (e.g. some API payloads): if the numeric value is ≥ 1e12,
 *   divide by 1e18 first, then apply the same 12-decimal adjustment.
 *
 * Do **not** return the formatted number as-is when it is below 1e9 — values like `7120000`
 * are common and skipping the oracle divisor inflates USD by ~1e6 for 6-decimal assets.
 */
/**
 * USD per 1 token from the on-chain price oracle contract (`get_price_with_timestamp`).
 * Raw integer uses the same 12-decimal scale as `get_market` (÷ 10^(12 − tokenDecimals)).
 */
export function usdPerTokenFromOracleContractRaw(
  rawPrice: string | number | bigint,
  tokenDecimals: number
): number {
  const rawStr =
    typeof rawPrice === "bigint"
      ? rawPrice.toString()
      : String(rawPrice).replace(/,/g, "").trim();
  if (rawStr === "" || rawStr === "0") return 0;
  const n = Number(rawStr);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return getTokenPriceFromOracle(n, tokenDecimals);
}

/** Encode human USD/token as `MarketInfo.price` (post-÷1e18 oracle scale) for existing callers. */
export function marketInfoFormattedPriceFromUsdPerToken(
  usdPerToken: number,
  tokenDecimals: number
): string {
  if (!Number.isFinite(usdPerToken) || usdPerToken <= 0) return "0";
  return new BigNumber(usdPerToken)
    .multipliedBy(new BigNumber(10).pow(12 - tokenDecimals))
    .toFixed(12);
}

/**
 * Prefer fresher price-oracle USD when `fetchMarketInfo` attached it; otherwise decode
 * `marketInfo.price` from the lending pool `get_market` field.
 */
export function resolveUsdPerTokenFromMarketInfo(
  marketInfo: { price: string; oracleUsdPerToken?: number },
  tokenDecimals: number
): number {
  const oracle = marketInfo.oracleUsdPerToken;
  if (typeof oracle === "number" && Number.isFinite(oracle) && oracle > 0) {
    return oracle;
  }
  return usdPerTokenFromMarketInfoPrice(marketInfo.price, tokenDecimals);
}

/**
 * Portfolio / list-row helper: resolve USD per token from a marketData row.
 * Returns 0 when price is missing or invalid — never invents $1.
 * For WAD, applies {@link normalizeWadUsdPerToken} (micro-USD → $1) like MarketsTable.
 */
export function usdPerTokenFromPortfolioMarketRow(
  market: unknown,
  tokenDecimals: number,
  options?: { displaySymbol?: string | null }
): number {
  if (!market || typeof market !== "object") return 0;
  const m = market as {
    price?: string | number | null;
    oracleUsdPerToken?: number;
    symbol?: string;
  };
  const priceStr =
    m.price !== undefined && m.price !== null ? String(m.price) : "";
  let usd = resolveUsdPerTokenFromMarketInfo(
    {
      price: priceStr,
      oracleUsdPerToken:
        typeof m.oracleUsdPerToken === "number"
          ? m.oracleUsdPerToken
          : undefined,
    },
    tokenDecimals
  );

  const sym = String(options?.displaySymbol ?? m.symbol ?? "").toUpperCase();
  if (sym === "WAD") {
    // Markets-style: treat decoded / oracle USD as possibly micro-USD, then normalize.
    if (!(usd > 0) && priceStr !== "") {
      const raw = Number.parseFloat(priceStr.replace(/,/g, ""));
      if (Number.isFinite(raw) && raw > 0) {
        usd = normalizeWadUsdPerToken(raw);
      }
    } else if (usd > 0) {
      usd = normalizeWadUsdPerToken(usd);
    }
  }

  return Number.isFinite(usd) && usd > 0 ? usd : 0;
}

export function usdPerTokenFromMarketInfoPrice(
  priceField: string | number | undefined | null,
  tokenDecimals: number
): number {
  if (priceField === undefined || priceField === null || priceField === "") {
    return 0;
  }
  const rawStr = String(priceField).replace(/,/g, "").trim();
  if (rawStr === "") return 0;
  const p = parseFloat(rawStr);
  if (!Number.isFinite(p) || p <= 0) return 0;

  let postWadStr = rawStr;
  if (p >= 1e12) {
    postWadStr = new BigNumber(rawStr)
      .div(new BigNumber(10).pow(18))
      .toFixed(12);
  }

  return usdPerTokenFromMarketInfoFormattedPrice(postWadStr, tokenDecimals);
}

/**
 * USD value for a **human** token amount (not smallest units) × USD per token from
 * `useTokenPrice`. Used by SupplyBorrowForm for the "≈ $…" line above the wallet balance.
 *
 * Regression: never multiply by `10^(tokenDecimals − 6)` — that inflated 8-decimal assets
 * (e.g. UNIT) by 100×.
 */
export function usdValueForHumanTokenAmount(
  humanAmount: number,
  usdPerToken: number
): number {
  if (
    !Number.isFinite(humanAmount) ||
    !Number.isFinite(usdPerToken) ||
    humanAmount <= 0 ||
    usdPerToken <= 0
  ) {
    return 0;
  }
  return humanAmount * usdPerToken;
}
