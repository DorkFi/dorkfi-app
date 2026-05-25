import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
const GUIDANCE_ITEMS = [
  {
    title: "Supply assets",
    body: "Earn interest with interest-bearing tokens that grow in value over time.",
  },
  {
    title: "Borrow against collateral",
    body: "Access liquidity without selling your holdings.",
  },
  {
    title: "Track utilization",
    body: "See how much of each market is borrowed vs. supplied — a signal for demand and rates.",
  },
  {
    title: "Compare risk profiles",
    body: "Different assets have different LTV limits and liquidation thresholds. Use Core (A) vs Boost (B) tabs to compare pools.",
  },
] as const;

const MarketsPageGuidance = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <p className="text-xs text-muted-foreground md:hidden">
        Tap a market for details. Supply earns APY; borrow uses your collateral.
      </p>

      <Collapsible
        open={open}
        onOpenChange={setOpen}
        className="hidden md:block"
      >
        <CollapsibleTrigger className="flex w-full items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          {open ? (
            <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
          )}
          <span>How markets work</span>
        </CollapsibleTrigger>
        <CollapsibleContent className="overflow-hidden">
          <ul className="mt-3 space-y-2 text-xs text-slate-600 dark:text-slate-400 list-none pl-0">
            {GUIDANCE_ITEMS.map((item) => (
              <li key={item.title}>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {item.title}:
                </span>{" "}
                {item.body}
              </li>
            ))}
          </ul>
        </CollapsibleContent>
      </Collapsible>
    </>
  );
};

export default MarketsPageGuidance;
