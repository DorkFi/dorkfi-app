import { Activity, Archive } from "lucide-react";
import DorkFiCard from "@/components/ui/DorkFiCard";
import { Caption } from "@/components/ui/Typography";

type GovernanceProposalCountCardsProps = {
  activeCount: number | null;
  closedCount: number | null;
  className?: string;
};

/** Active / closed proposal summary tiles shared by Live and Archives. */
export const GovernanceProposalCountCards = ({
  activeCount,
  closedCount,
  className,
}: GovernanceProposalCountCardsProps) => {
  return (
    <div
      className={
        className ?? "grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4"
      }
    >
      <DorkFiCard className="p-4 sm:p-5" hoverable={false}>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/15 text-primary">
            <Activity className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div>
            <Caption className="text-muted-foreground uppercase tracking-wide text-[10px] sm:text-xs">
              Active proposals
            </Caption>
            <div className="text-3xl sm:text-4xl font-bold text-primary tabular-nums">
              {activeCount === null ? "—" : activeCount}
            </div>
          </div>
        </div>
      </DorkFiCard>
      <DorkFiCard className="p-4 sm:p-5" hoverable={false}>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-green-500/15 text-green-600 dark:text-green-400">
            <Archive className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div>
            <Caption className="text-muted-foreground uppercase tracking-wide text-[10px] sm:text-xs">
              Closed proposals
            </Caption>
            <div className="text-3xl sm:text-4xl font-bold text-green-600 dark:text-green-400 tabular-nums">
              {closedCount === null ? "—" : closedCount}
            </div>
          </div>
        </div>
      </DorkFiCard>
    </div>
  );
};
