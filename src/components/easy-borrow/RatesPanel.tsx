import type { ReactNode } from "react";
import { getTokenImagePath } from "@/utils/tokenImageUtils";

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
}: {
  title: string;
  row: RateRow;
  hint?: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold text-white">{title}</h3>
      <div className="flex items-center gap-3 rounded-2xl bg-white/10 px-3.5 py-3">
        <img
          src={getTokenImagePath(row.symbol) || row.logoPath || "/placeholder.svg"}
          alt=""
          className="size-8 rounded-full"
        />
        <span className="flex-1 text-sm font-medium text-white">{row.symbol}</span>
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
  return (
    <aside className="rounded-[28px] bg-zinc-950 p-5 sm:p-6 space-y-8 h-full">
      <RateBlock title="Borrow Rate" row={borrow} hint={borrowHint} />
      <RateBlock title="Supply Rate" row={supply} />
    </aside>
  );
};

export default RatesPanel;
