import type { OnDemandMarketData } from "@/hooks/useOnDemandMarketData";
import { marketPoolBadgeBgClassName } from "@/constants/marketUi";
import { resolveLpPairIcons } from "@/constants/liquidityPools";
import LpPairIconStack from "@/components/pools/LpPairIconStack";
import type { NetworkId } from "@/config";
import { cn } from "@/lib/utils";

export type MarketRowTokenIconProps = {
  market: Pick<OnDemandMarketData, "icon" | "asset" | "iconBadgeUrl"> & {
    configSymbol?: string;
    network?: string;
  };
  /** Pool letter (e.g. A/B) — top-right; omit when null. */
  poolLetterLabel: string | null;
  imgClassName?: string;
  iconBadgeTitle?: string;
};

/** Market row / card token icon with optional pool letter (top-right) and optional `iconBadgeUrl`. */
export function MarketRowTokenIcon({
  market,
  poolLetterLabel,
  imgClassName = "w-10 h-10 flex-shrink-0 rounded-full object-contain",
  iconBadgeTitle = "Folks Finance",
}: MarketRowTokenIconProps) {
  const pairIcons = resolveLpPairIcons(
    market.network as NetworkId | undefined,
    market.configSymbol,
    market.asset
  );

  return (
    <div className="relative inline-flex flex-shrink-0">
      {pairIcons ? (
        <LpPairIconStack
          asset1Icon={pairIcons.asset1Icon}
          asset2Icon={pairIcons.asset2Icon}
          fallbackIcon={market.icon}
          alt={market.asset}
          layout="mashup"
          className={imgClassName}
        />
      ) : (
        <img src={market.icon} alt={market.asset} className={imgClassName} />
      )}
      {poolLetterLabel ? (
        <div
          className={`absolute -top-1 -right-1 z-[11] flex h-5 items-center justify-center rounded-full border-2 border-white dark:border-slate-800 ${
            poolLetterLabel.length > 1 ? "min-w-5 px-0.5" : "w-5"
          } ${marketPoolBadgeBgClassName(poolLetterLabel)}`}
        >
          <span
            className={`font-bold leading-none text-white ${
              poolLetterLabel.length > 1 ? "text-[9px]" : "text-xs"
            }`}
          >
            {poolLetterLabel}
          </span>
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
          />
        </div>
      ) : null}
    </div>
  );
}
