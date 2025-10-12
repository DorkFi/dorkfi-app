
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { ExternalLink, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import SupplyBorrowModal from "@/components/SupplyBorrowModal";
import BorrowAPYDisplay from "@/components/BorrowAPYDisplay";
import { useWallet } from "@txnlab/use-wallet-react";
import { useNetwork } from "@/contexts/NetworkContext";
import { fetchUserGlobalData, fetchUserBorrowBalance } from "@/services/lendingService";
import { getAllTokensWithDisplayInfo } from "@/config";
import { APYCalculationResult } from "@/utils/apyCalculations";

interface MarketDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: string;
  marketData: {
    icon: string;
    totalSupply: number;
    totalSupplyUSD: number;
    supplyAPY: number;
    totalBorrow: number;
    totalBorrowUSD: number;
    borrowAPY: number;
    utilization: number;
    collateralFactor: number;
    supplyCap: number;
    supplyCapUSD: number;
    maxLTV: number;
    liquidationThreshold: number;
    liquidationPenalty: number;
    reserveFactor: number;
    collectorContract: string;
    apyCalculation?: APYCalculationResult;
  };
}

const tokenNames: Record<string, string> = {
  VOI: "VOI – Voi Network",
  UNIT: "UNIT – Unit Protocol",
  USDC: "USDC – USD Coin",
  ALGO: "ALGO – Algorand",
  ETH: "ETH – Ethereum",
  BTC: "BTC – Bitcoin"
};

const mockChartData = [
  { time: "1m", rate: 2.1 },
  { time: "2m", rate: 2.3 },
  { time: "3m", rate: 1.9 },
  { time: "4m", rate: 2.0 },
  { time: "5m", rate: 1.8 },
  { time: "6m", rate: 1.9 }
];

const MarketDetailModal = ({ isOpen, onClose, asset, marketData }: MarketDetailModalProps) => {
  const [supplyModal, setSupplyModal] = useState({ isOpen: false, asset: null });
  const [borrowModal, setBorrowModal] = useState({ isOpen: false, asset: null });
  const [chartPeriod, setChartPeriod] = useState("6m");
  const [userGlobalData, setUserGlobalData] = useState<{
    totalCollateralValue: number;
    totalBorrowValue: number;
    lastUpdateTime: number;
  } | null>(null);
  const [userBorrowBalance, setUserBorrowBalance] = useState<number>(0);
  const [isLoadingGlobalData, setIsLoadingGlobalData] = useState(false);
  
  const { activeAccount } = useWallet();
  const { currentNetwork } = useNetwork();

  const handleSupplyClick = () => {
    setSupplyModal({ isOpen: true, asset });
  };

  const handleBorrowClick = async () => {
    if (!activeAccount?.address) {
      console.error("No active account for borrowing");
      return;
    }

    setIsLoadingGlobalData(true);
    
    try {
      // Fetch user global data before opening modal
      const globalData = await fetchUserGlobalData(activeAccount.address, currentNetwork);
      setUserGlobalData(globalData);
      
      // Fetch user's current borrow balance for this specific asset
      const tokens = getAllTokensWithDisplayInfo(currentNetwork);
      const token = tokens.find((t) => t.symbol === asset);
      
      if (token && token.poolId && token.underlyingContractId) {
        const borrowBalance = await fetchUserBorrowBalance(
          activeAccount.address,
          token.poolId,
          token.underlyingContractId,
          currentNetwork
        );
        setUserBorrowBalance(borrowBalance || 0);
      } else {
        setUserBorrowBalance(0);
      }
      
      // Open modal after data is fetched
      setBorrowModal({ isOpen: true, asset });
    } catch (error) {
      console.error("Error fetching user data for borrow:", error);
      // Still open modal even if data fetch fails
      setBorrowModal({ isOpen: true, asset });
    } finally {
      setIsLoadingGlobalData(false);
    }
  };

  const handleCloseSupplyModal = () => {
    setSupplyModal({ isOpen: false, asset: null });
  };

  const handleCloseBorrowModal = () => {
    setBorrowModal({ isOpen: false, asset: null });
  };

  // Clear user global data when wallet address changes
  useEffect(() => {
    setUserGlobalData(null);
  }, [activeAccount?.address]);

  const getAssetData = () => ({
    icon: marketData.icon,
    totalSupply: marketData.totalSupply,
    totalSupplyUSD: marketData.totalSupplyUSD,
    supplyAPY: marketData.supplyAPY,
    totalBorrow: marketData.totalBorrow,
    totalBorrowUSD: marketData.totalBorrowUSD,
    borrowAPY: marketData.borrowAPY,
    utilization: marketData.utilization,
    collateralFactor: marketData.collateralFactor,
    liquidity: marketData.totalSupply - marketData.totalBorrow,
    liquidityUSD: marketData.totalSupplyUSD - marketData.totalBorrowUSD,
  });

  const supplyUtilization = (marketData.totalSupplyUSD / marketData.supplyCapUSD) * 100;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 rounded-xl border border-gray-200/50 dark:border-ocean-teal/20 shadow-xl card-hover hover:shadow-lg hover:border-ocean-teal/40 transition-all p-6">
          <DialogHeader className="pb-4">
            <DialogTitle className="sr-only">{tokenNames[asset] || asset} Market Details</DialogTitle>
            <div className="flex items-center gap-3">
              <img src={marketData.icon} alt={asset} className="w-10 h-10 rounded-full" />
              <div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
                  {tokenNames[asset] || asset}
                </h2>
                <p className="text-slate-600 dark:text-slate-300 text-base">Reserve Status & Configuration</p>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4">
            {/* Top Row - Supply, Borrow, Collateral */}
            <div className="grid lg:grid-cols-3 md:grid-cols-2 gap-4">
              {/* Supply Information */}
              <Card className="border-green-200 dark:border-green-800 bg-white/50 dark:bg-slate-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg text-green-700 dark:text-green-400 flex items-center gap-2">
                    🟢 Supply Information
                    <Tooltip>
                       <TooltipTrigger asChild>
                         <Info className="h-4 w-4 text-gray-500" />
                       </TooltipTrigger>
                      <TooltipContent>
                        <p>Information about the total assets supplied to this market</p>
                      </TooltipContent>
                    </Tooltip>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-center">
                    <div className="relative w-20 h-20">
                      <div className="w-full h-full rounded-full border-4 border-gray-200 dark:border-slate-600">
                        <div 
                          className="absolute inset-0 rounded-full border-4 border-green-500"
                          style={{
                            background: `conic-gradient(#10b981 ${supplyUtilization * 3.6}deg, transparent 0deg)`
                          }}
                        />
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                           <div className="text-lg font-bold text-slate-800 dark:text-white">
                             {supplyUtilization.toFixed(1)}%
                          </div>
                          <div className="text-xs text-slate-800 dark:text-white">Used</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-center space-y-2">
                    <div className="text-sm font-semibold text-slate-800 dark:text-white flex items-center justify-center gap-1">
                      ${(marketData.totalSupplyUSD / 1_000_000).toLocaleString()} / ${(marketData.supplyCapUSD / 1_000_000).toLocaleString()}
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-3 w-3 text-gray-500" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Current supply vs maximum supply cap allowed for this asset</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="flex items-center justify-center gap-1">
                      <Badge className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                        APY: {marketData.supplyAPY.toFixed(2)}%
                      </Badge>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-3 w-3 text-gray-500" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Annual Percentage Yield earned by supplying this asset</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Borrow Information */}
              <Card className="border-red-200 dark:border-red-800 bg-white/50 dark:bg-slate-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg text-red-700 dark:text-red-400 flex items-center gap-2">
                    🟥 Borrow Information
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-gray-500" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Information about borrowing activity for this asset</p>
                      </TooltipContent>
                    </Tooltip>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-center">
                    <div className="relative w-20 h-20">
                      <div className="w-full h-full rounded-full border-4 border-gray-200 dark:border-slate-600">
                        <div 
                          className="absolute inset-0 rounded-full border-4 border-red-500"
                          style={{
                            background: `conic-gradient(#ef4444 ${marketData.utilization * 3.6}deg, transparent 0deg)`
                          }}
                        />
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                           <div className="text-lg font-bold text-slate-800 dark:text-white">
                             {marketData.utilization.toFixed(2)}%
                          </div>
                          <div className="text-xs text-slate-800 dark:text-white">Util</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-center space-y-2">
                    <div className="text-sm font-semibold text-slate-800 dark:text-white flex items-center justify-center gap-1">
                      {marketData.totalBorrow.toLocaleString()} {asset}
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-3 w-3 text-gray-500" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Total amount of {asset} currently borrowed from this market</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="flex items-center justify-center gap-1">
                      <Badge className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">
                        APY: <BorrowAPYDisplay 
                          apyCalculation={marketData.apyCalculation}
                          fallbackAPY={marketData.borrowAPY}
                          showTooltip={false}
                        />
                      </Badge>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-3 w-3 text-gray-500" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Annual Percentage Yield paid when borrowing this asset</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Collateral Information */}
              <Card className="border-yellow-200 dark:border-yellow-800 bg-white/50 dark:bg-slate-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg text-yellow-700 dark:text-yellow-400 flex items-center gap-2">
                    🟨 Collateral Info
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-gray-500" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Information about using this asset as collateral for borrowing</p>
                      </TooltipContent>
                    </Tooltip>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-center gap-1">
                    <Badge className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs px-2 py-1">
                      ✅ Usable as collateral
                    </Badge>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3 w-3 text-gray-500" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>This asset can be used as collateral to borrow other assets</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <div className="bg-gray-50 dark:bg-slate-700 p-2 rounded text-center">
                      <div className="text-lg font-bold text-slate-800 dark:text-white flex items-center justify-center gap-1">
                        {marketData.maxLTV}%
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-3 w-3 text-gray-500" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Maximum Loan-to-Value ratio - the maximum you can borrow against this collateral</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-300">Max LTV</div>
                    </div>
                    <div className="bg-gray-50 dark:bg-slate-700 p-2 rounded text-center">
                      <div className="text-lg font-bold text-slate-800 dark:text-white flex items-center justify-center gap-1">
                        {marketData.liquidationThreshold}%
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-3 w-3 text-gray-500" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>When your loan-to-value exceeds this threshold, your position becomes eligible for liquidation</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-300">Liq. Threshold</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Second Row - Charts and Protocol Config */}
            <div className="grid lg:grid-cols-3 md:grid-cols-2 gap-4">
              {/* Supply Chart */}
              <Card className="bg-white/50 dark:bg-slate-800 border-gray-200 dark:border-slate-700">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-sm text-slate-800 dark:text-white">Supply APR History</CardTitle>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-3 w-3 text-gray-500" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Historical supply interest rates for this asset over time</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="flex gap-1">
                      {["1m", "6m", "1y"].map((period) => (
                        <Button
                          key={period}
                          size="sm"
                          variant={chartPeriod === period ? "default" : "outline"}
                          onClick={() => setChartPeriod(period)}
                          className="text-xs h-6 px-2 text-slate-800 dark:text-white border-gray-300 dark:border-slate-600"
                        >
                          {period}
                        </Button>
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="h-20">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={mockChartData}>
                        <XAxis dataKey="time" hide />
                        <YAxis hide />
                        <Line 
                          type="monotone" 
                          dataKey="rate" 
                          stroke="#10b981" 
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Borrow Chart */}
              <Card className="bg-white/50 dark:bg-slate-800 border-gray-200 dark:border-slate-700">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm text-slate-800 dark:text-white">Borrow APR History</CardTitle>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3 w-3 text-gray-500" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Historical borrowing interest rates for this asset over time</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="h-20">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={mockChartData.map(d => ({ ...d, rate: d.rate + 3 }))}>
                        <XAxis dataKey="time" hide />
                        <YAxis hide />
                        <Line 
                          type="monotone" 
                          dataKey="rate" 
                          stroke="#ef4444" 
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Protocol Configuration */}
              <Card className="bg-white/50 dark:bg-slate-800 border-gray-200 dark:border-slate-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-800 dark:text-white flex items-center gap-2">
                    ⚙️ Protocol Config
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-gray-500" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Protocol-level configuration settings for this market</p>
                      </TooltipContent>
                    </Tooltip>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    <div>
                      <div className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1">
                        Reserve Factor
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-3 w-3 text-gray-500" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Percentage of interest that goes to the protocol reserves</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="text-lg font-semibold text-slate-800 dark:text-white">{marketData.reserveFactor}%</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1">
                        Liquidation Penalty
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-3 w-3 text-gray-500" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Additional penalty paid when your position gets liquidated</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="text-lg font-semibold text-slate-800 dark:text-white">{marketData.liquidationPenalty}%</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1">
                        Collector Contract
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-3 w-3 text-gray-500" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Smart contract address that collects protocol fees</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-mono bg-gray-100 dark:bg-slate-700 px-1 py-0.5 rounded text-slate-800 dark:text-white">
                          {marketData.collectorContract}
                        </span>
                        <ExternalLink className="w-3 h-3 text-ocean-teal cursor-pointer" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <Button
                onClick={handleSupplyClick}
                className="bg-ocean-teal hover:bg-ocean-teal/90 text-white h-10 text-base font-semibold"
              >
                Deposit {asset}
              </Button>
              <Button
                onClick={handleBorrowClick}
                variant="outline"
                className="border-ocean-teal text-ocean-teal hover:bg-ocean-teal/10 dark:border-ocean-teal dark:text-ocean-teal h-10 text-base font-semibold"
              >
                Borrow {asset}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Supply Modal */}
      {supplyModal.isOpen && supplyModal.asset && (
        <SupplyBorrowModal
          isOpen={supplyModal.isOpen}
          onClose={handleCloseSupplyModal}
          asset={supplyModal.asset}
          mode="deposit"
          assetData={getAssetData()}
        />
      )}

      {/* Borrow Modal */}
      {borrowModal.isOpen && borrowModal.asset && (
        <SupplyBorrowModal
          isOpen={borrowModal.isOpen}
          onClose={handleCloseBorrowModal}
          asset={borrowModal.asset}
          mode="borrow"
          assetData={getAssetData()}
          userGlobalData={userGlobalData}
          userBorrowBalance={userBorrowBalance}
        />
      )}
     </>
   );
 };

 export default MarketDetailModal;
