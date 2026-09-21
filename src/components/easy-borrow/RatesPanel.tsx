import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, Info } from "lucide-react";
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
  net?: RateRow;
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

function SupportingRate({
  icon,
  iconClassName,
  title,
  subtitle,
  value,
  unit,
}: {
  icon: ReactNode;
  iconClassName: string;
  title: string;
  subtitle: string;
  value: string;
  unit: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`flex size-10 shrink-0 items-center justify-center rounded-full text-white ${iconClassName}`}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold leading-tight text-foreground">
          {title}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">{subtitle}</div>
      </div>
      <div className="text-right">
        <div className="text-lg font-semibold leading-none tabular-nums text-foreground">
          {value}
        </div>
        <div className="mt-1 text-[11px] text-muted-foreground">{unit}</div>
      </div>
    </div>
  );
}

function ConsumerRatesPanel({ borrow, supply, net }: RatesPanelProps) {
  return (
    <aside className="rounded-[24px] border border-[#d7e2f0] bg-[#f4f7fb] p-4 dark:border-border dark:bg-card sm:p-5">
      <h2 className="text-lg font-semibold tracking-tight text-foreground">
        Current rates
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Rates vary with borrowing demand
      </p>

      <div className="mt-4 rounded-2xl bg-white px-4 py-4 shadow-sm dark:bg-background">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground">
              Net cost to borrow
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Your borrow rate minus your savings rate
            </p>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[1.75rem] font-semibold leading-none tabular-nums tracking-tight text-[#1a5278] dark:text-white">
              {net?.rateLabel ?? "—"}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">APR</div>
          </div>
        </div>

        <div className="my-4 h-px bg-border/70" />

        <div className="space-y-4">
          <SupportingRate
            icon={<ArrowDown className="size-4" strokeWidth={2.5} />}
            iconClassName="bg-[#1a5278]"
            title="Borrow rate"
            subtitle="Annual interest rate"
            value={borrow.rateLabel}
            unit="APR"
          />
          <SupportingRate
            icon={<ArrowUp className="size-4" strokeWidth={2.5} />}
            iconClassName="bg-[#3dcea0]"
            title="Savings rate"
            subtitle="Earn on your deposits"
            value={supply.rateLabel}
            unit="APY"
          />
        </div>
      </div>

      <div className="mt-3 rounded-2xl bg-[#e7f0ff] px-4 py-3.5 dark:bg-blue-500/10">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Info className="size-4 text-[#3b6fd8]" strokeWidth={2.25} />
          How it works
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Your deposits earn yield while you borrow. The net cost is your
          borrow rate minus your savings rate.
        </p>
      </div>
    </aside>
  );
}

const RatesPanel = (props: RatesPanelProps) => {
  const consumerCopy = useConsumerCopy();
  if (consumerCopy) {
    return <ConsumerRatesPanel {...props} />;
  }

  const { borrow, supply, net, borrowHint } = props;
  return (
    <aside className="h-full space-y-8 rounded-[28px] bg-[#0c1927] p-5 sm:p-6">
      <RateBlock
        title="Borrow Rate"
        row={borrow}
        hint={borrowHint}
        consumerCopy={false}
      />
      <RateBlock title="Supply Rate" row={supply} consumerCopy={false} />
      {net ? (
        <RateBlock title="Net Borrow Rate" row={net} consumerCopy={false} />
      ) : null}
    </aside>
  );
};

export default RatesPanel;
