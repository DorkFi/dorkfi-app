
import { Card, CardContent } from "@/components/ui/card";
import { InfoIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface AssetData {
  supplyAPY: number;
  borrowAPY: number;
  utilization: number;
  collateralFactor: number;
  liquidity: number;
}

interface SupplyBorrowStatsProps {
  mode: "deposit" | "borrow";
  asset: string;
  assetData: AssetData;
}

const SupplyBorrowStats = ({ mode, asset, assetData }: SupplyBorrowStatsProps) => {
  return (
    <Card className="bg-white/50 dark:bg-slate-800 border-gray-200 dark:border-slate-700">
      <CardContent className="p-4 space-y-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {mode === "deposit" ? "Deposit" : "Borrow"} APY
            </span>
            <Tooltip>
              <TooltipTrigger>
                <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Annual percentage yield for {mode === "deposit" ? "depositing" : "borrowing"} {asset}</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <span className={`text-sm font-medium ${mode === "deposit" ? "text-teal-600 dark:text-teal-400" : "text-red-600 dark:text-red-400"}`}>
            {mode === "deposit" ? assetData.supplyAPY : assetData.borrowAPY}%
          </span>
        </div>

        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">Utilization</span>
            <Tooltip>
              <TooltipTrigger>
                <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Percentage of deposited assets being borrowed</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <span className="text-sm font-medium text-slate-800 dark:text-white">{assetData.utilization}%</span>
        </div>

        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">Collateral Factor</span>
            <Tooltip>
              <TooltipTrigger>
                <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Maximum borrowing power from this collateral</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <span className="text-sm font-medium text-slate-800 dark:text-white">{assetData.collateralFactor}%</span>
        </div>

        {mode === "borrow" && (
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500 dark:text-slate-400">Available to Borrow</span>
              <Tooltip>
                <TooltipTrigger>
                  <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Total liquidity available for borrowing</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <span className="text-sm font-medium text-teal-600 dark:text-teal-400">
              {assetData.liquidity.toLocaleString()} {asset}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SupplyBorrowStats;
