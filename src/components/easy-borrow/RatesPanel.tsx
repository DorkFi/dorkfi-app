import type { ReactNode } from "react";
import { getTokenImagePath } from "@/utils/tokenImageUtils";
import { useConsumerCopy } from "@/contexts/ProductFlavorContext";
import { consumerAssetDisplayLabel } from "@/services/savingsRouteResolver";

type RateRow = {
  symbol: string;
  logoPath?: string;
  rateLabel: string;
};

type RatesPanelProps = {
  borrow: RateRow;
  supply: RateRow;
  borrowHint?: ReactNode;
};

function RateBlock({
  title,
  row,
  hint,
  consumerCopy,
}: {
  title: string;
  row: RateRow;
  hint?: ReactNode;
  consumerCopy: boolean;
}) {
  const symbol = consumerCopy
    ? consumerAssetDisplayLabel(row.symbol)
    : row.symbol;
  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold text-white">{title}</h3>
      <div className="flex items-center gap-3 rounded-2xl bg-white/10 px-3.5 py-3">
        <img
          src={getTokenImagePath(row.symbol) || row.logoPath || "/placeholder.svg"}
          alt=""
          className="size-8 rounded-full"
        />
        <span className="flex-1 text-sm font-medium text-white">{symbol}</span>
        <span className="text-sm font-semibold tabular-nums text-white">
          {row.rateLabel}
        </span>
      </div>
      {hint ? (
        <p className="text-xs leading-relaxed text-white/60">{hint}</p>
      ) : null}
    </div>
  );
}

const RatesPanel = ({ borrow, supply, borrowHint }: RatesPanelProps) => {
  const consumerCopy = useConsumerCopy();
  return (
    <aside className="rounded-[28px] bg-[#0c1927] p-5 sm:p-6 space-y-8 h-full">
      <RateBlock
        title={consumerCopy ? "Borrow rate" : "Borrow Rate"}
        row={borrow}
        hint={borrowHint}
        consumerCopy={consumerCopy}
      />
      <RateBlock
        title={consumerCopy ? "Savings APY" : "Supply Rate"}
        row={supply}
        consumerCopy={consumerCopy}
      />
    </aside>
  );
};

export default RatesPanel;
