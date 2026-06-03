import type { OnDemandMarketData } from "@/hooks/useOnDemandMarketData";
import { marketPoolBadgeBgClassName } from "@/constants/marketUi";
import LpPairIconStack from "@/components/pools/LpPairIconStack";
import type { NetworkId } from "@/config";
import { resolveLpTokenPairIcons } from "@/utils/lpTokenIconUtils";
import { handleTokenImageError } from "@/utils/tokenImageUtils";

export type MarketRowTokenIconProps = {
  market: Pick<OnDemandMarketData, "icon" | "asset" | "iconBadgeUrl">;
  /** Pool letter (e.g. A/B) — top-right; omit when null. */
  poolLetterLabel: string | null;
  imgClassName?: string;
  iconBadgeTitle?: string;
  /** When set, resolves Tinyman LP pair icons from config (e.g. `LP_TMPOOL2_WAD_UNIT`). */
  configSymbol?: string;
  networkId?: NetworkId;
  /** Explicit pair icons (overrides config-based LP resolution). */
  assetPairIcons?: { asset1Icon: string; asset2Icon: string };
};

/** Market row / card token icon with optional pool letter (top-right) and optional `iconBadgeUrl`. */
export function MarketRowTokenIcon({
  market,
  poolLetterLabel,
  imgClassName = "w-10 h-10 flex-shrink-0 rounded-full object-contain",
  iconBadgeTitle = "Folks Finance",
  configSymbol,
  networkId,
  assetPairIcons,
}: MarketRowTokenIconProps) {
  const resolvedPairIcons =
    assetPairIcons ??
    (networkId
      ? resolveLpTokenPairIcons(networkId, { configSymbol })
      : null);

  const iconContent =
    resolvedPairIcons != null ? (
      <LpPairIconStack
        asset1Icon={resolvedPairIcons.asset1Icon}
        asset2Icon={resolvedPairIcons.asset2Icon}
        fallbackIcon={market.icon}
        alt={market.asset}
        imgClassName={imgClassName}
      />
    ) : (
      <img
        src={market.icon}
        alt={market.asset}
        className={imgClassName}
        onError={handleTokenImageError}
      />
    );

  return (
    <div className="relative flex-shrink-0">
      {iconContent}
      {poolLetterLabel ? (
        <div
          className={`absolute -top-1 -right-1 z-[11] flex h-5 w-5 items-center justify-center rounded-full border-2 border-white dark:border-slate-800 ${marketPoolBadgeBgClassName(poolLetterLabel)}`}
        >
          <span className="text-xs font-bold text-white">{poolLetterLabel}</span>
        </div>
      ) : null}
      {market.iconBadgeUrl ? (
        <div
          className="absolute -bottom-1 -right-1 z-10 flex h-5 w-5 overflow-hidden rounded-full border-2 border-white bg-white dark:border-slate-800 dark:bg-slate-900"
          title={iconBadgeTitle}
        >
          <img
            src={market.iconBadgeUrl}
            alt=""
            className="h-full w-full object-cover"
            aria-hidden
            onError={handleTokenImageError}
          />
        </div>
      ) : null}
    </div>
  );
}
