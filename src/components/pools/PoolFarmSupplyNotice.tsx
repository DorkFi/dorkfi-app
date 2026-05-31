import { POOL_FARM_SUPPLY_NOTICE } from "@/constants/liquidityPools";
import { cn } from "@/lib/utils";

interface PoolFarmSupplyNoticeProps {
  className?: string;
}

const PoolFarmSupplyNotice = ({ className }: PoolFarmSupplyNoticeProps) => (
  <div
    className={cn(
      "rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2",
      className
    )}
  >
    <p className="text-xs leading-relaxed text-amber-900 dark:text-amber-100">
      {POOL_FARM_SUPPLY_NOTICE}
    </p>
  </div>
);

export default PoolFarmSupplyNotice;
