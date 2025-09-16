import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Wallet,
  Coins,
  ArrowDownCircle,
  ArrowUpCircle,
  CheckCircle2,
  AlertCircle,
  Clock,
  TrendingUp,
  BarChart3,
  RefreshCcw,
  ExternalLink,
  InfoIcon,
  ShoppingCart,
  ChevronDown,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import DorkFiButton from "@/components/ui/DorkFiButton";
import { Link } from "react-router-dom";
import WalletNetworkButton from "@/components/WalletNetworkButton";
import DorkFiCard from "@/components/ui/DorkFiCard";
import { H1, Body } from "@/components/ui/Typography";
import MultiNetworkTLV from "@/components/MultiNetworkTLV";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import SupplyBorrowCongrats from "@/components/SupplyBorrowCongrats";
import WithdrawModal from "@/components/WithdrawModal";
import { getTokenImagePath } from "@/utils/tokenImageUtils";
import VersionDisplay from "@/components/VersionDisplay";
import {
  getCurrentNetworkConfig,
  getNetworkConfig,
  getAllTokens,
  NetworkId,
  isCurrentNetworkEVM,
  isCurrentNetworkAlgorandCompatible,
  TokenStandard,
  getEnabledNetworks,
} from "@/config";
import { useNetwork } from "@/contexts/NetworkContext";
import { deposit, withdraw, fetchMarketInfo } from "@/services/lendingService";
import { useWallet } from "@txnlab/use-wallet-react";
import algorandService, { AlgorandNetwork } from "@/services/algorandService";
import { waitForConfirmation } from "algosdk";
import { ARC200Service } from "@/services/arc200Service";
import BigNumber from "bignumber.js";
import { ARC200TokenService } from "@/services/mimirApi/arc200TokenService";

/**
 * PreFi Frontend – Single-file MVP Dashboard
 * ------------------------------------------------------------
 * What this provides out of the box:
 *  - Clean, modern Tailwind UI with animated interactions
 *  - Markets dashboard (VOI, aUSD, UNIT, BTC, ETH, ALGO)
 *  - Wallet connect placeholder + fully functional Mock Mode
 *  - Deposit flows (with thresholds + validation)
 *  - Balance & deposit tracking per market (mock + pluggable)
 *  - Time‑weighted reward *estimate* preview until launch
 *
 * What you must wire up:
 *  - Replace MOCK adapters with real on‑chain calls in `chainApi`
 *  - Provide correct contract addresses & asset IDs per market
 *  - Set the LAUNCH_TIMESTAMP when Phase 0 closes / markets launch
 *  - Implement wallet connection for VOI/AVM (e.g., Pera/Vera/WalletConnect)
 *
 * Notes:
 *  - This file is self‑contained for easy drop‑in. Move into your app structure
 *    (e.g., /src/pages/PreFi.tsx) and replace the chainApi with real calls.
 *  - Time‑weighted rewards use stake‑seconds (amount × seconds until launch).
 *    We **estimate** user share using a placeholder total stake function.
 *  - All numbers are illustrative in Mock Mode.
 */

/*************************
 * Program Configuration  *
 *************************/
const PROGRAM = {
  VOI_ALLOCATION_TOTAL: 5_000_000, // VOI total rewards for Phase 0 (5M VOI)
  LAUNCH_TIMESTAMP: Date.UTC(2025, 8, 13, 0, 29, 0), // Sep 12, 2025 5:29 PM PDT
  // PreFi Phase 0 ends and markets launch on this date.
};

type Market = {
  id: string;
  poolId?: string; // lending pool ID for this token
  marketId?: string; // lending market ID for this token
  contractId?: string; // prefunding contract / app id (placeholder)
  nTokenId?: string; // nToken ID for this token
  name: string;
  symbol: string;
  min: number; // minimum qualifying deposit for Phase 0
  tokenStandard: TokenStandard;
  assetId?: string; // ASA/ARC‑200 ID if applicable
  decimals: number;
};

// Get markets from configuration - now reactive to network changes
const getMarketsFromConfig = (networkId: NetworkId): Market[] => {
  const networkConfig = getNetworkConfig(networkId);
  const tokens = getAllTokens(networkId);

  return tokens.map((token) => {
    // Use token standard from config
    const tokenStandard = token.tokenStandard;

    // Set minimum deposit requirements
    const minDeposits: { [key: string]: number } = {
      VOI: 10_000,
      USDC: 20,
      UNIT: 10,
      BTC: 0.0002,
      cbBTC: 0.0002,
      acbBTC: 0.0002,
      aBTC: 0.0002,
      goBTC: 0.0002,
      wBTC: 0.0002,
      ETH: 0.005,
      aETH: 0.005,
      goETH: 0.005,
      wETH: 0.005,
      ALGO: 100,
      POW: 5000,
      TINY: 1500,
      FINITE: 1500,
      LINK: 1,
      SOL: 0.1,
      AVAX: 1,
      HAY: 500,
      COMPX: 20000,
      COOP: 2000,
      MONKO: 20e6, // 20M
      ALPHA: 2000,
      AKTA: 20000,
      BRO: 1e6, // 1M
      PEPE: 2e6, // 2M
      HOG: 5,
    };

    return {
      id: token.symbol.toLowerCase(),
      poolId: token.poolId,
      marketId: token.contractId,
      nTokenId: token.nTokenId,
      name: token.name,
      symbol: token.symbol,
      min: minDeposits[token.symbol] || 10,
      tokenStandard,
      assetId: token.assetId,
      contractAddress: `APP_ID_${token.symbol}_PREFUND`, // TODO: Get from config when available
      decimals: token.decimals,
    };
  });
};

/*************************
 * Utilities              *
 *************************/
const fmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 });
const fmt0 = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const fmtCompact = new Intl.NumberFormat(undefined, {
  notation: "compact",
  maximumFractionDigits: 1,
});
const fmtPrecise = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 4,
  minimumFractionDigits: 0,
});
const shortAddr = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—");
const nowSec = () => Math.floor(Date.now() / 1000);
const toBase = (amt: number, decimals: number) =>
  BigInt(Math.round(amt * 10 ** decimals));
const fromBase = (amt: bigint, decimals: number) =>
  Number(amt) / 10 ** decimals;

// Format pool capacity numbers for better readability
const formatPoolCapacity = (current: number, max: number) => {
  // Determine precision based on the max value
  let currentFormatted: string;
  let maxFormatted: string;

  if (max >= 1_000_000_000) {
    // Very large values (billions) - use B/M/K formatting
    currentFormatted =
      current >= 1_000_000_000
        ? fmtCompact.format(current / 1_000_000_000) + "B"
        : current >= 1_000_000
        ? fmtCompact.format(current / 1_000_000) + "M"
        : current >= 1_000
        ? fmtCompact.format(current / 1_000) + "K"
        : fmt0.format(current);

    maxFormatted = fmtCompact.format(max / 1_000_000_000) + "B";
  } else if (max >= 1_000_000) {
    // Large values (millions) - use M/K formatting
    currentFormatted =
      current >= 1_000_000
        ? fmtCompact.format(current / 1_000_000) + "M"
        : current >= 1_000
        ? fmtCompact.format(current / 1_000) + "K"
        : fmt0.format(current);

    maxFormatted = fmtCompact.format(max / 1_000_000) + "M";
  } else if (max >= 1_000) {
    // Medium values - use K formatting
    currentFormatted =
      current >= 1_000
        ? fmtCompact.format(current / 1_000) + "K"
        : current < 10 && current > 0
        ? fmtPrecise.format(current)
        : fmt0.format(current);

    maxFormatted = fmtCompact.format(max / 1_000) + "K";
  } else {
    // Small values - show high precision
    // For very small max values, show more decimal places
    const precision = max < 1 ? 6 : max < 10 ? 4 : 2;
    const smallFmt = new Intl.NumberFormat(undefined, {
      maximumFractionDigits: precision,
      minimumFractionDigits: 0,
    });

    currentFormatted = smallFmt.format(current);
    maxFormatted = smallFmt.format(max);
  }

  return `${currentFormatted} / ${maxFormatted}`;
};

/*************************
 * APY Calculation Utils  *
 *************************/

// Market allocation percentages (how much of total VOI rewards each market gets)
const getMarketAllocation = (marketId: string): number => {
  const allocations: Record<string, number> = {
    voi: 0.25, // 25% of total VOI rewards
    ausd: 0.15, // 15% of total VOI rewards
    unit: 0.2, // 20% of total VOI rewards
    btc: 0.12, // 12% of total VOI rewards
    cbbtc: 0.1, // 10% of total VOI rewards
    eth: 0.1, // 10% of total VOI rewards
    algo: 0.05, // 5% of total VOI rewards
    pow: 0.03, // 3% of total VOI rewards
  };
  return allocations[marketId] || 0.05; // Default 5%
};

// Risk adjustment factors based on token stability and adoption
const getRiskAdjustmentFactor = (marketId: string): number => {
  const riskFactors: Record<string, number> = {
    voi: 1.0, // Native token, lowest risk
    ausd: 0.95, // Stablecoin, very low risk
    unit: 0.9, // Established token
    btc: 0.85, // High value, moderate risk
    cbbtc: 0.85, // High value, moderate risk
    eth: 0.8, // High value, moderate risk
    algo: 0.75, // Cross-chain token, higher risk
    pow: 0.7, // Newer token, highest risk
  };
  return riskFactors[marketId] || 0.8;
};

// Calculate raw reward APR from deposit caps or actual deposits
const calculateRewardAPR = (
  market: Market,
  voiPrice: number,
  userDeposit: number,
  timeRemaining: number,
  marketPrices: Record<string, number>,
  actualDeposits?: number // Optional actual deposits vs cap
): number => {
  if (voiPrice <= 0 || userDeposit <= 0 || timeRemaining <= 0) {
    return 0;
  }

  // Get market allocation percentage
  const marketAllocation = getMarketAllocation(market.id);

  // Calculate monthly VOI rewards value
  const monthlyVOIRewards =
    (PROGRAM.VOI_ALLOCATION_TOTAL * marketAllocation) / 12; // Monthly allocation
  const monthlyRewardsValueUSD = monthlyVOIRewards * voiPrice;

  // Use actual deposits if provided, otherwise use user deposit as proxy
  const depositCap = actualDeposits || userDeposit;

  // Raw APR calculation: (Monthly VOI Rewards Value ÷ Deposit Cap) × 12
  const rawAPR = (monthlyRewardsValueUSD / depositCap) * 12;

  return Math.max(0, rawAPR);
};

// Normalize raw APR into user-friendly display ranges
const normalizeAPR = (
  rawAPR: number,
  marketId: string
): { min: number; max: number } => {
  // Define display ranges based on market type
  const ranges: Record<string, { min: number; max: number }> = {
    // Stable anchors (USDC, BTC, ETH)
    ausd: { min: 2, max: 4 },
    btc: { min: 2, max: 4 },
    cbbtc: { min: 2, max: 4 },
    eth: { min: 2, max: 4 },

    // Governance / derivative tokens
    unit: { min: 5, max: 8 },

    // Boosted or community tokens
    voi: { min: 10, max: 15 },
    pow: { min: 10, max: 15 },

    // High-risk / microcap experimental markets
    algo: { min: 20, max: 20 }, // Will show as 20%+
  };

  const range = ranges[marketId] || { min: 5, max: 8 }; // Default range

  // If raw APR is within range, use it
  if (rawAPR >= range.min && rawAPR <= range.max) {
    return { min: rawAPR, max: rawAPR };
  }

  // If raw APR is below range, use minimum
  if (rawAPR < range.min) {
    return { min: range.min, max: range.min };
  }

  // If raw APR is above range, cap at maximum
  return { min: range.max, max: range.max };
};

// Get display APY (high end of range for app display)
const getDisplayAPY = (rawAPR: number, marketId: string): number => {
  const normalized = normalizeAPR(rawAPR, marketId);
  return normalized.max;
};

// Fallback APY values matching documentation examples
const getFallbackAPY = (marketId: string): number => {
  const fallbackAPYs: Record<string, number> = {
    // Voi A Market
    voi: 12, // VOI → 12%
    ausd: 8, // aUSD → 8%
    unit: 15, // UNIT → 15%
    algo: 20, // ALGO → 20%+
    eth: 12, // ETH → 12%
    btc: 8, // WBTC / cbBTC → 8%
    cbbtc: 8, // WBTC / cbBTC → 8%
    pow: 15, // POW → 15%

    // Algorand A Market
    usdc: 4, // USDC → 4%
    tiny: 15, // TINY → 15%
    compx: 20, // COMPX → 20%+
    finite: 15, // FINITE → 15%
  };
  return fallbackAPYs[marketId] || 10.0;
};

// Main APY calculation function using normalization layer approach
const calculateMarketAPY = (
  market: Market,
  voiPrice: number,
  userDeposit: number,
  timeRemaining: number,
  marketPrices: Record<string, number>,
  marketInfo?: any, // Optional real market data
  actualDeposits?: number // Optional actual deposits vs cap
): number => {
  try {
    // Base APY from lending protocol (if available)
    const baseAPY = marketInfo?.supplyRate ? marketInfo.supplyRate * 100 : 0;

    // Calculate raw reward APR
    const rawRewardAPR = calculateRewardAPR(
      market,
      voiPrice,
      userDeposit,
      timeRemaining,
      marketPrices,
      actualDeposits
    );

    // Apply risk adjustment to raw APR
    const riskFactor = getRiskAdjustmentFactor(market.id);
    const adjustedRawAPR = rawRewardAPR * riskFactor;

    // Combine base APY with adjusted reward APR
    const totalRawAPR = baseAPY + adjustedRawAPR;

    // Normalize and get display APY
    const displayAPY = getDisplayAPY(totalRawAPR, market.id);

    // Ensure minimum APY and cap maximum APY
    return Math.max(0.1, Math.min(displayAPY, 50.0)); // Cap at 50% APY
  } catch (error) {
    console.error(`Error calculating APY for ${market.symbol}:`, error);
    return getFallbackAPY(market.id);
  }
};

/*************************
 * Minimal State & Types  *
 *************************/
interface WalletState {
  address?: string;
  connected: boolean;
  network: NetworkId;
  mockMode: boolean;
}

interface MarketState {
  walletBalanceBase: bigint; // user wallet token balance
  depositedBase: bigint; // user deposited (prefunded) balance
  totalStakeSecondsBase: bigint; // global stake‑seconds from chain (placeholder)
}

interface MarketBalance {
  balance: bigint;
  deposited: bigint;
}

/*************************
 * Chain API (Pluggable)  *
 *************************/
/**
 * Replace this MOCK implementation with production adapters.
 * Suggested approach:
 *  - Use algosdk and your VOI RPC or Indexer endpoints
 *  - Implement wallet adapters (Pera/Vera/WalletConnect) to sign & send
 *  - Implement app call to your prefunding smart contracts
 */
const chainApi = {
  // ====== WALLET ======
  async connectWalletMock(): Promise<WalletState> {
    // In production: open wallet modal and return address/network
    const addrs = [
      "VOI2PREFUND6USER7ADDR8DEMO9AAAAAAA1111",
      "VOI2PREFUND6USER7ADDR8DEMO9BBBBBBB2222",
    ];
    const address = addrs[Math.floor(Math.random() * addrs.length)];
    return {
      address,
      connected: true,
      network: "voi-testnet",
      mockMode: true,
    };
  },

  async disconnectWallet(): Promise<void> {
    // Close session if using WalletConnect, etc.
    return;
  },

  // ====== READS ======
  async getMarketBalance(
    address: string,
    market: Market
  ): Promise<MarketBalance> {
    // Get real wallet balance from blockchain
    if (!address) return { balance: 0n, deposited: 0n };

    try {
      const networkConfig = getCurrentNetworkConfig();
      const algorandClients = algorandService.initializeClients(
        networkConfig.walletNetworkId as AlgorandNetwork
      );
      ARC200Service.initialize(algorandClients);

      // For network tokens (like VOI), use assetId "0"
      // For other tokens, use their contractId
      const [assetType, tokenId] =
        market.assetId === "0"
          ? ["network", "0"]
          : !isNaN(Number(market.assetId))
          ? ["asa", market.assetId]
          : ["arc200", market.marketId];

      const nTokenId = market.nTokenId;

      let balance = 0n;
      if (assetType === "network") {
        // For network VOI, get account balance minus minimum balance
        const accInfo = await algorandClients.algod
          .accountInformation(address)
          .do();
        balance = BigInt(
          Math.max(0, accInfo.amount - accInfo["min-balance"] - 1e6)
        );
      } else if (assetType === "asa") {
        const accAssetInfo = await algorandClients.algod
          .accountAssetInformation(address, Number(market.assetId))
          .do();
        console.log("accAssetInfo", accAssetInfo);
        balance = BigInt(accAssetInfo["asset-holding"].amount);
      } else if (assetType === "arc200") {
        // For other tokens, get balance from ARC200Service
        console.log("tokenId", tokenId);
        const tokenBalance = await ARC200Service.getBalance(address, tokenId);
        console.log("tokenBalance", tokenBalance);
        balance = tokenBalance ? BigInt(tokenBalance) : 0n;
      } else {
        throw new Error(`Unsupported asset type: ${assetType}`);
      }

      let deposited = 0n;
      if (nTokenId) {
        // Get deposited balance (nToken balance)
        const nTokenBalance = await ARC200Service.getBalance(address, nTokenId);
        deposited = nTokenBalance ? BigInt(nTokenBalance) : 0n;
      }

      console.log(`Balance for ${market.symbol}:`, {
        tokenId,
        nTokenId,
        balance: balance.toString(),
        deposited: deposited.toString(),
      });

      return {
        balance,
        deposited,
      };
    } catch (error) {
      console.error(
        `Error fetching wallet balance for ${market.symbol}:`,
        error
      );
      return {
        balance: 0n,
        deposited: 0n,
      };
    }
  },

  async getTotalStakeSecondsBase(_market: Market): Promise<bigint> {
    // Replace with global stake‑seconds aggregation from contract/global state
    // Mock: pretend 10M stake‑seconds in base units
    return 10_000_000n;
  },

  // ====== WRITES ======
  async depositToPrefund(
    wallet: WalletState,
    market: Market,
    amountBase: bigint
  ): Promise<{ txId: string }> {
    // TODO: implement actual app call / token transfer into prefund vault contract
    // For now, simulate success with a fake tx id and small delay
    await new Promise((r) => setTimeout(r, 850));
    return { txId: `TX-${market.id}-${Number(amountBase)}-${Date.now()}` };
  },
};

/*************************
 * UI Components          *
 *************************/
function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | React.ReactNode;
  icon: any;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-ocean-teal/20 bg-gradient-to-br from-slate-900 to-slate-800 p-4 shadow-sm dark-glow-card">
      <div className="rounded-xl border border-ocean-teal/30 bg-slate-800/60 p-2">
        <Icon className="h-5 w-5 text-aqua-glow" />
      </div>
      <div>
        <div className="text-xs uppercase tracking-wide text-slate-400">
          {label}
        </div>
        <div className="text-lg font-semibold text-white">{value}</div>
      </div>
    </div>
  );
}

function Countdown({ launchTs }: { launchTs: number }) {
  const [t, setT] = useState(launchTs - Date.now());
  useEffect(() => {
    const id = setInterval(() => setT(launchTs - Date.now()), 1000);
    return () => clearInterval(id);
  }, [launchTs]);
  if (t <= 0) return <div className="text-accent font-medium">Launching…</div>;
  const sec = Math.floor(t / 1000);
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return (
    <div className="font-semibold tabular-nums text-card-foreground">
      {d}d {h}h {m}m {s}s
    </div>
  );
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));

  // More exaggerated non-linear progress: much more progress shown at earlier stages
  // Using a more aggressive curve: sqrt(percentage) * 12
  // This makes 0-30% show dramatically more visual progress, compresses 70-100% heavily
  const visualPct = Math.sqrt(pct) * 12;

  return (
    <div className="h-3 w-full rounded-md border-2 border-border bg-secondary">
      <div
        className="h-3 rounded-md transition-all duration-500 shadow-lg"
        style={{
          width: `${Math.min(100, visualPct)}%`,
          background: "linear-gradient(90deg, #7091b1 0%, #e2b342 100%)",
        }}
      />
    </div>
  );
}

/*************************
 * Main Component         *
 *************************/
export default function PreFiDashboard() {
  const { activeAccount, activeWallet, signTransactions } = useWallet();
  const isMobile = useIsMobile();
  const { currentNetwork, switchNetwork } = useNetwork();

  // Get markets for current network
  const markets = useMemo(() => {
    const marketList = getMarketsFromConfig(currentNetwork);
    console.log(
      `Created ${marketList.length} markets for network ${currentNetwork}:`,
      marketList
    );
    return marketList;
  }, [currentNetwork]);

  const [wallet, setWallet] = useState<WalletState>({
    connected: false,
    network: currentNetwork,
    mockMode: true,
  });
  const [marketsState, setMarketsState] = useState<Record<string, MarketState>>(
    {}
  );
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [txLog, setTxLog] = useState<
    Array<{ ts: number; marketId: string; amount: number; txId: string }>
  >([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Modal state
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [modalAmount, setModalAmount] = useState("");
  const [modalFiatValue, setModalFiatValue] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [withdrawModalPrice, setWithdrawModalPrice] = useState(0);
  const [voiPrice, setVoiPrice] = useState(0);
  const [marketPrices, setMarketPrices] = useState<Record<string, number>>({});
  const [marketTotalDeposits, setMarketTotalDeposits] = useState<
    Record<string, number>
  >({});
  const [marketMaxTotalDeposits, setMarketMaxTotalDeposits] = useState<
    Record<string, number>
  >({});
  const [isBuyModalOpen, setIsBuyModalOpen] = useState(false);

  // Multi-network configuration - memoized to prevent recreation
  const enabledNetworks: NetworkId[] = useMemo(
    () => ["voi-mainnet", "algorand-mainnet"],
    []
  );

  const launchTs = PROGRAM.LAUNCH_TIMESTAMP;

  // Fetch VOI price for reward calculations
  const fetchVoiPrice = async () => {
    try {
      // Find VOI market from the markets list
      const voiMarket = markets.find(
        (m) => m.symbol === "VOI" || m.symbol === "Voi"
      );
      if (voiMarket && voiMarket.poolId && voiMarket.marketId) {
        const marketInfo = await fetchMarketInfo(
          voiMarket.poolId,
          voiMarket.marketId,
          currentNetwork
        );

        if (marketInfo && marketInfo.price) {
          // The price from fetchMarketInfo is already scaled by 10^18, but we need to scale by 10^(18 + token.decimals)
          // So we need to scale down by an additional 10^token.decimals
          const partiallyScaledPrice = parseFloat(marketInfo.price);
          const additionalScaling = Math.pow(10, voiMarket.decimals);
          const finalPrice = partiallyScaledPrice / additionalScaling;
          setVoiPrice(finalPrice);
          console.log(`VOI price: $${finalPrice}`);
        }
      }
    } catch (error) {
      console.error("Error fetching VOI price:", error);
      // Fallback to mock price
      setVoiPrice(0.05); // $0.05 fallback
    }
  };

  const connect = async () => {
    const s = await chainApi.connectWalletMock();
    setWallet({ ...s, network: currentNetwork });

    // Initialize ARC200Service with Algorand clients
    if (isCurrentNetworkAlgorandCompatible()) {
      const networkConfig = getCurrentNetworkConfig();
      const algorandClients = algorandService.initializeClients(
        networkConfig.walletNetworkId as AlgorandNetwork
      );
      ARC200Service.initialize(algorandClients);
    }

    setRefreshKey((k) => k + 1);
  };
  const disconnect = async () => {
    await chainApi.disconnectWallet();
    setWallet({ connected: false, network: currentNetwork, mockMode: true });
  };

  // Update wallet network when currentNetwork changes
  useEffect(() => {
    setWallet((prev) => ({ ...prev, network: currentNetwork }));
    // Clear markets state when network changes
    setMarketsState({});
    setTxLog([]);
    setIsInitialLoad(true); // Reset initial load flag for new network
    setRefreshKey((k) => k + 1);
  }, [currentNetwork]);

  const loadMarket = async (m: Market, isInitialLoad = false) => {
    // Only show loading indicators on initial load
    if (isInitialLoad) {
      setLoadingMap((x) => ({ ...x, [m.id]: true }));
    }
    console.log("Loading market:", m);
    try {
      // Get wallet balance from chainApi (for wallet balance)
      const wb = await chainApi.getMarketBalance(
        activeAccount?.address || "",
        m
      );

      console.log("Market balance result:", wb);
      console.log("Market:", m);

      // Get total stake seconds from chainApi
      const totalSS = await chainApi.getTotalStakeSecondsBase(m);

      setMarketsState((s) => ({
        ...s,
        [m.id]: {
          walletBalanceBase: wb.balance,
          depositedBase: wb.deposited,
          totalStakeSecondsBase: totalSS,
        },
      }));

      // Fetch market price and total deposits for USD calculations
      if (m.poolId && m.marketId) {
        try {
          const marketInfo = await fetchMarketInfo(
            m.poolId,
            m.marketId,
            currentNetwork
          );

          if (marketInfo && marketInfo.price) {
            // The price from fetchMarketInfo is already scaled by 10^18, but we need to scale by 10^(18 + token.decimals)
            // So we need to scale down by an additional 10^token.decimals
            const partiallyScaledPrice = parseFloat(marketInfo.price);
            const additionalScaling = Math.pow(10, 6);
            const finalPrice = partiallyScaledPrice / additionalScaling;
            setMarketPrices((prev) => ({ ...prev, [m.id]: finalPrice }));
            console.log(
              `Market price for ${m.symbol}: $${finalPrice} (scaled by 10^${m.decimals})`
            );
          }

          // Store total deposits for this market
          if (marketInfo && marketInfo.totalDeposits) {
            const totalDeposits = parseFloat(marketInfo.totalDeposits);
            setMarketTotalDeposits((prev) => ({
              ...prev,
              [m.id]: totalDeposits,
            }));
            console.log(`Total deposits for ${m.symbol}: ${totalDeposits}`);
          }

          // Store max total deposits for this market
          if (marketInfo && marketInfo.maxTotalDeposits) {
            const maxTotalDeposits = parseFloat(marketInfo.maxTotalDeposits);
            setMarketMaxTotalDeposits((prev) => ({
              ...prev,
              [m.id]: maxTotalDeposits,
            }));
            console.log(
              `Max total deposits for ${m.symbol}: ${maxTotalDeposits}`
            );
          }
        } catch (error) {
          console.error(`Error fetching price for ${m.symbol}:`, error);
          // Set fallback prices
          const fallbackPrices: Record<string, number> = {
            voi: 0.05,
            ausd: 1.0,
            unit: 7.0,
            btc: 65000,
            cbbtc: 65000,
            eth: 3000,
            algo: 0.25,
            pow: 0.1,
          };
          setMarketPrices((prev) => ({
            ...prev,
            [m.id]: fallbackPrices[m.id] || 1.0,
          }));
          // Set fallback total deposits (0 for now)
          setMarketTotalDeposits((prev) => ({ ...prev, [m.id]: 0 }));
        }
      }
    } finally {
      if (isInitialLoad) {
        setLoadingMap((x) => ({ ...x, [m.id]: false }));
      }
    }
  };

  // Load market data for connected users
  useEffect(() => {
    if (!activeAccount?.address) return;
    console.log("Loading markets for address:", activeAccount.address);

    // Load all markets with initial load flag
    const loadPromises = markets.map((market) =>
      loadMarket(market, isInitialLoad)
    );

    // When all markets are loaded, mark initial load as complete
    Promise.all(loadPromises).then(() => {
      if (isInitialLoad) {
        setIsInitialLoad(false);
      }
    });

    // Fetch VOI price for reward calculations
    fetchVoiPrice();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAccount?.address, markets, refreshKey]);

  // Load pool progress data even when not connected (for pool progress display)
  useEffect(() => {
    if (activeAccount?.address) return; // Skip if user is connected (handled above)

    console.log("Loading pool progress data for unconnected users");

    const loadPoolData = async () => {
      const loadPromises = markets.map(async (market) => {
        try {
          // Fetch market info for pool progress data
          if (market.poolId && market.marketId) {
            const marketInfo = await fetchMarketInfo(
              market.poolId,
              market.marketId,
              currentNetwork
            );

            if (marketInfo) {
              // Store total deposits for pool progress
              if (marketInfo.totalDeposits) {
                const totalDeposits = parseFloat(marketInfo.totalDeposits);
                setMarketTotalDeposits((prev) => ({
                  ...prev,
                  [market.id]: totalDeposits,
                }));
              }

              // Store max total deposits for pool progress
              if (marketInfo.maxTotalDeposits) {
                const maxTotalDeposits = parseFloat(
                  marketInfo.maxTotalDeposits
                );
                setMarketMaxTotalDeposits((prev) => ({
                  ...prev,
                  [market.id]: maxTotalDeposits,
                }));
              }

              // Store market price for USD conversion
              if (marketInfo.price) {
                const partiallyScaledPrice = parseFloat(marketInfo.price);
                const additionalScaling = Math.pow(10, 6);
                const finalPrice = partiallyScaledPrice / additionalScaling;
                setMarketPrices((prev) => ({
                  ...prev,
                  [market.id]: finalPrice,
                }));
              }
            }
          }
        } catch (error) {
          console.error(
            `Error fetching pool data for ${market.symbol}:`,
            error
          );
        }
      });

      await Promise.all(loadPromises);
    };

    loadPoolData();
  }, [markets, currentNetwork, activeAccount?.address]);

  // Handle network changes
  const handleNetworkChange = async (networkId: NetworkId) => {
    console.log("Network changed to:", networkId);
    try {
      await switchNetwork(networkId);
      console.log("Successfully switched to network:", networkId);
    } catch (error) {
      console.error("Failed to switch network:", error);
    }
  };

  // Modal handlers
  const openDepositModal = (market: Market) => {
    console.log("Opening deposit modal for", market.symbol);
    setSelectedMarket(market);
    setModalAmount("");
    setModalFiatValue(0);
    setShowSuccess(false);
    setIsDepositModalOpen(true);
    console.log("Modal should be open now, isDepositModalOpen:", true);
  };

  const closeDepositModal = () => {
    setIsDepositModalOpen(false);
    setSelectedMarket(null);
    setModalAmount("");
    setModalFiatValue(0);
    setShowSuccess(false);
  };

  // Withdraw modal handlers
  const openWithdrawModal = async (market: Market) => {
    console.log("=== OPENING WITHDRAW MODAL ===");
    console.log("Opening withdraw modal for", market.symbol);
    console.log("Current isWithdrawModalOpen state:", isWithdrawModalOpen);
    console.log("Market object:", market);
    console.log("Market object keys:", Object.keys(market));
    console.log("Market.nTokenId:", market.nTokenId);
    console.log("Market.marketId:", market.marketId);
    console.log("Market.poolId:", market.poolId);
    console.log("Market.contractId:", market.contractId);
    console.log("Active account address:", activeAccount?.address);
    console.log("Current network:", currentNetwork);

    // Set loading state for this market
    setLoadingMap((prev) => ({ ...prev, [market.id]: true }));

    try {
      if (!activeAccount?.address) {
        console.error("Wallet not connected");
        alert("Please connect your wallet first.");
        return;
      }

      // Check if nTokenId is missing and try to get it
      let nTokenId = market.nTokenId;
      if (!nTokenId) {
        console.log("=== nTokenId MISSING - TRYING TO FETCH ===");
        console.log(
          "market.nTokenId is undefined, trying to fetch from marketInfo"
        );

        try {
          const marketInfo = await fetchMarketInfo(
            market.poolId || "1",
            market.marketId || market.symbol,
            currentNetwork
          );
          nTokenId = marketInfo.ntokenId;
          console.log(
            "Successfully fetched nTokenId from marketInfo:",
            nTokenId
          );
        } catch (error) {
          console.error("Failed to fetch marketInfo:", error);
          console.log("Using marketId as fallback for nTokenId");
          nTokenId = market.marketId;
        }
      }

      console.log("=== FINAL nTokenId ===");
      console.log("Using nTokenId:", nTokenId);

      const networkConfig = getCurrentNetworkConfig();
      const algorandClients = algorandService.initializeClients(
        networkConfig.walletNetworkId as AlgorandNetwork
      );
      ARC200Service.initialize(algorandClients);
      const balance = await ARC200Service.getBalance(
        activeAccount.address,
        nTokenId
      );
      console.log("balance", balance);

      // Set the market and open the modal
      console.log("=== OPENING MODAL ===");
      console.log("Setting selectedMarket to:", market.symbol);
      setSelectedMarket(market);
      setModalAmount("1000000000000000000"); // here
      setModalFiatValue(0);
      setShowSuccess(false);

      // Fetch real market price for withdraw modal
      try {
        if (market.poolId && market.marketId) {
          const marketInfo = await fetchMarketInfo(
            market.poolId,
            market.marketId,
            currentNetwork
          );

          if (marketInfo && marketInfo.price) {
            // The price from fetchMarketInfo is already scaled by 10^18, but we need to scale by 10^(18 + token.decimals)
            // So we need to scale down by an additional 10^token.decimals
            const partiallyScaledPrice = parseFloat(marketInfo.price);
            const additionalScaling = Math.pow(10, 6);
            const finalPrice = partiallyScaledPrice / additionalScaling;
            console.log(
              `Withdraw modal price for ${market.symbol}: $${finalPrice}`
            );
            setWithdrawModalPrice(finalPrice);
          } else {
            console.warn(`No price data for ${market.symbol}, using fallback`);
            setWithdrawModalPrice(0);
          }
        } else {
          console.warn(`Missing poolId or marketId for ${market.symbol}`);
          setWithdrawModalPrice(0);
        }
      } catch (error) {
        console.error(
          `Error fetching price for withdraw modal ${market.symbol}:`,
          error
        );
        setWithdrawModalPrice(0);
      }

      console.log("About to set isWithdrawModalOpen to true");
      setIsWithdrawModalOpen(true);
      console.log("Set isWithdrawModalOpen to true");

      // Force a re-render check
      setTimeout(() => {
        console.log("=== STATE CHECK AFTER TIMEOUT ===");
        console.log("isWithdrawModalOpen:", isWithdrawModalOpen);
        console.log("selectedMarket:", selectedMarket?.symbol);
        console.log(
          "Modal should render:",
          isWithdrawModalOpen && selectedMarket
        );
      }, 100);
    } catch (error) {
      console.error(
        `Error fetching deposited balance for ${market.symbol}:`,
        error
      );
      alert(`Error fetching balance for ${market.symbol}. Please try again.`);
    } finally {
      // Clear loading state
      setLoadingMap((prev) => ({ ...prev, [market.id]: false }));
    }
  };

  const closeWithdrawModal = () => {
    setIsWithdrawModalOpen(false);
    setSelectedMarket(null);
    setModalAmount("");
    setModalFiatValue(0);
    setShowSuccess(false);
    setWithdrawModalPrice(0);
  };

  // Update fiat value when amount changes
  useEffect(() => {
    const updateFiatValue = async () => {
      if (modalAmount && selectedMarket) {
        const numAmount = parseFloat(modalAmount);

        try {
          // Get real market price from lending service
          if (selectedMarket.poolId && selectedMarket.marketId) {
            const marketInfo = await fetchMarketInfo(
              selectedMarket.poolId,
              selectedMarket.marketId,
              currentNetwork
            );

            if (marketInfo && marketInfo.price) {
              // The price from fetchMarketInfo is already scaled by 10^18, but we need to scale by 10^(18 + token.decimals)
              // So we need to scale down by an additional 10^token.decimals
              const partiallyScaledPrice = parseFloat(marketInfo.price);
              //const additionalScaling = Math.pow(10, selectedMarket.decimals);
              const additionalScaling = Math.pow(10, 6);
              const finalPrice = partiallyScaledPrice / additionalScaling;
              console.log(
                `Partially scaled price: ${partiallyScaledPrice}, Token decimals: ${selectedMarket.decimals}, Final price for ${selectedMarket.symbol}: $${finalPrice}`
              );
              setModalFiatValue(numAmount * finalPrice);
            } else {
              throw new Error("No price data from market info");
            }
          } else {
            throw new Error("Missing poolId or marketId");
          }
        } catch (error) {
          console.error(
            `Error fetching market price for ${selectedMarket.symbol}:`,
            error
          );
          // Fallback to mock prices if API fails
          const mockPrice =
            selectedMarket.id === "ausd"
              ? 1
              : selectedMarket.id === "voi"
              ? 0.05
              : selectedMarket.id === "btc"
              ? 65000
              : selectedMarket.id === "cbbtc"
              ? 65000
              : selectedMarket.id === "eth"
              ? 3000
              : selectedMarket.id === "algo"
              ? 0.25
              : selectedMarket.id === "pow"
              ? 0.1
              : 1;
          setModalFiatValue(numAmount * mockPrice);
        }
      } else {
        setModalFiatValue(0);
      }
    };

    updateFiatValue();
  }, [modalAmount, selectedMarket, currentNetwork]);

  const handleMaxClick = () => {
    if (selectedMarket && marketsState[selectedMarket.id]) {
      const balance = fromBase(
        marketsState[selectedMarket.id].walletBalanceBase,
        selectedMarket.decimals
      );
      setModalAmount(balance.toString());
    }
  };

  const handleViewTransaction = () => {
    window.open("https://testnet.algoexplorer.io/", "_blank");
  };

  const handleGoToPortfolio = () => {
    closeDepositModal();
    // Navigate to portfolio or main page
  };

  const handleMakeAnother = () => {
    setShowSuccess(false);
    setModalAmount("");
    setModalFiatValue(0);
  };

  const handleConfirmDeposit = async () => {
    if (!selectedMarket || !modalAmount || Number(modalAmount) <= 0) return;

    const amount = new BigNumber(modalAmount)
      .multipliedBy(10 ** selectedMarket.decimals)
      .toFixed(0);

    console.log("balance", amount);

    console.log(`[DEPOSIT] ${amount} ${selectedMarket.symbol}`);

    setLoadingMap((prev) => ({ ...prev, [selectedMarket.id]: true }));

    try {
      let depositResult;

      if (isCurrentNetworkAlgorandCompatible()) {
        if (!activeAccount) {
          console.error("Wallet not connected");
          return;
        }
        console.log("selectedMarket", selectedMarket);
        console.log("Deposit parameters:", {
          poolId: selectedMarket.poolId || "",
          marketId: selectedMarket.marketId || "",
          amount: modalAmount,
          userAddress: activeAccount.address,
          networkId: currentNetwork,
        });
        // Call the lending service deposit method
        depositResult = await deposit(
          selectedMarket.poolId || "", // poolId - use token's poolId or fallback
          selectedMarket.marketId || "", // marketId
          selectedMarket.tokenStandard, // assetType - pass the token standard
          amount, // amount as string
          activeAccount.address, // userAddress
          currentNetwork // networkId
        );

        if (!depositResult.success) {
          throw new Error(depositResult.error || "Deposit failed");
        }

        console.log("depositResult", { depositResult });

        const stxns = await signTransactions(
          depositResult.txns.map((txn: string) =>
            Uint8Array.from(atob(txn), (c) => c.charCodeAt(0))
          )
        );

        const networkConfig = getCurrentNetworkConfig();
        const algorandClients = algorandService.initializeClients(
          networkConfig.walletNetworkId as AlgorandNetwork
        );

        const res = await algorandClients.algod.sendRawTransaction(stxns).do();

        await waitForConfirmation(algorandClients.algod, res.txId, 4);

        console.log("Transaction confirmed:", res);
      } else if (isCurrentNetworkEVM()) {
        // TODO: Implement EVM deposit
        depositResult = {
          success: true,
          txId: `TXN_${Math.random().toString(36).substring(2, 15)}`,
        };
      } else {
        throw new Error("Unsupported network");
      }

      // Calculate amountBase for state update (amount is already in atomic units)
      const amountBase = BigInt(amount);

      // Update tx log with actual transaction ID
      setTxLog((prev) => [
        {
          ts: Date.now(),
          marketId: selectedMarket.id,
          amount: Number(modalAmount), // Use user-friendly amount, not atomic units
          txId:
            depositResult?.txId ||
            `TXN_${Math.random().toString(36).substring(2, 15)}`,
        },
        ...prev,
      ]);

      // Refresh balances (optimistic update)
      setMarketsState((prev) => {
        const current = prev[selectedMarket.id];
        return {
          ...prev,
          [selectedMarket.id]: {
            walletBalanceBase: (current?.walletBalanceBase ?? 0n) - amountBase, // Subtract deposited amount from wallet
            depositedBase: (current?.depositedBase ?? 0n) + amountBase,
            totalStakeSecondsBase:
              current?.totalStakeSecondsBase ?? 10_000_000n,
          },
        };
      });

      // Show success screen
      setTimeout(() => {
        setShowSuccess(true);
        setLoadingMap((prev) => ({ ...prev, [selectedMarket.id]: false }));
      }, 500);

      // Refresh balances from blockchain to ensure accuracy (silent refresh)
      setTimeout(() => {
        if (selectedMarket) {
          loadMarket(selectedMarket, false); // false = no loading indicators
        }
      }, 2000); // Delay to allow success screen to show first
    } catch (error) {
      console.error("Deposit failed:", error);
      setLoadingMap((prev) => ({ ...prev, [selectedMarket.id]: false }));

      // You could add a toast notification here to show the error to the user
      // For now, we'll just log it
      if (error instanceof Error) {
        console.error("Deposit error:", error.message);
      }
    }
  };

  // Debug withdraw modal state
  useEffect(() => {
    console.log("=== MODAL STATE CHANGE ===");
    console.log("Withdraw modal state:", {
      isWithdrawModalOpen,
      selectedMarket: selectedMarket?.symbol,
      selectedMarketId: selectedMarket?.id,
    });
    console.log("Modal should render:", isWithdrawModalOpen && selectedMarket);
  }, [isWithdrawModalOpen, selectedMarket]);

  const globalDeposited = useMemo(() => {
    let sum = 0;
    for (const m of markets) {
      const st = marketsState[m.id];
      if (!st) continue;
      const tokenAmount = fromBase(st.depositedBase, m.decimals);
      const price = marketPrices[m.id] || 0;
      sum += tokenAmount * price;
    }
    return sum;
  }, [marketsState, markets, marketPrices]);

  // Memoize pool progress calculations for better performance
  const poolProgressData = useMemo(() => {
    // Fallback max deposits map for when real data isn't available yet
    // These are more realistic USD values for max total deposits
    const fallbackMaxDepositsMap: Record<string, number> = {
      voi: 200_000_000, // $200M VOI
      ausd: 50_000_000, // $50M aUSD
      unit: 100_000_000, // $100M UNIT
      btc: 500_000_000, // $500M BTC (was 75M)
      cbbtc: 500_000_000, // $500M cbBTC (was 75M)
      eth: 300_000_000, // $300M ETH (was 100M)
      algo: 25_000_000, // $25M ALGO
      pow: 30_000_000, // $30M POW
      monko: 10_000_000_000, // $10B MONKO
    };

    return markets.map((market) => {
      // Use real maxTotalDeposits from market info if available, otherwise fallback
      const realMaxDeposits = marketMaxTotalDeposits[market.id];
      const maxDeposits =
        realMaxDeposits || fallbackMaxDepositsMap[market.id] || 50_000_000;

      // Debug logging to see what values we're getting
      if (realMaxDeposits !== undefined) {
        console.log(
          `${market.symbol} max deposits: real=${realMaxDeposits}, fallback=${
            fallbackMaxDepositsMap[market.id]
          }, using=${maxDeposits}`
        );
      }

      // Use real totalScaledDeposits from market info if available
      // totalScaledDeposits is already in USD values
      const totalDepositsUSD = marketTotalDeposits[market.id] || 0;
      const percentage = Math.min(100, (totalDepositsUSD / maxDeposits) * 100);

      return {
        marketId: market.id,
        maxDeposits,
        totalDepositsUSD,
        percentage,
        formattedCapacity: formatPoolCapacity(totalDepositsUSD, maxDeposits),
      };
    });
  }, [markets, marketTotalDeposits, marketMaxTotalDeposits]);

  return (
    <div className="min-h-screen bg-background relative">
      {/* Light Mode Beach Background */}
      <div className="absolute inset-0 light-mode-beach-bg dark:hidden" />
      <div className="absolute inset-0 beach-overlay dark:hidden" />

      {/* Dark Mode Surf Background */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center"
        style={{
          backgroundImage: "url('/lovable-uploads/dark_surf_prefi.png')",
        }}
      />

      {/* Dark overlay */}
      <div className="absolute inset-0 z-0 bg-black/40"></div>

      {/* PreFi Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-white/80 dark:header-nav-bg backdrop-blur-md supports-[backdrop-filter]:bg-white/70 dark:supports-[backdrop-filter]:header-nav-bg shadow-sm dark:shadow-none">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link
              to="/"
              className="flex items-center space-x-3 cursor-pointer hover:opacity-80 transition-opacity"
              aria-label="Go to DorkFi dashboard"
            >
              <div className="flex flex-col">
                <img
                  src="/lovable-uploads/dork_fi_logo_edit1_light.png"
                  alt="DorkFi logo"
                  className="h-8 sm:h-9 md:h-10 lg:h-11 w-auto object-contain flex-shrink-0"
                  fetchPriority="high"
                  decoding="async"
                  onError={(e) => {
                    console.error("Logo failed to load, using placeholder");
                    (e.currentTarget as HTMLImageElement).src =
                      "/placeholder.svg";
                  }}
                />
              </div>
            </Link>

            {/* Theme Toggle, Buy Button, and Wallet */}
            <div className="flex items-center gap-2">
              {activeAccount && (
                <button
                  className="p-2 rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors"
                  onClick={() => {
                    console.log("Buy tokens clicked from navigation");
                    setIsBuyModalOpen(true);
                  }}
                  title="Buy Tokens"
                >
                  <ShoppingCart className="h-5 w-5" />
                </button>
              )}
              <WalletNetworkButton onNetworkChange={handleNetworkChange} />
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="mx-auto max-w-6xl px-4 pt-8 relative z-10">
        <DorkFiCard
          hoverable
          className="relative text-center overflow-hidden p-6 md:p-8 mb-8 !bg-gradient-to-br !from-slate-900 !to-slate-800 border-slate-700"
        >
          {/* Decorative elements */}
          {/* Moon decoration - left side */}
          <div
            className="absolute top-4 left-8 opacity-80 pointer-events-none z-0 animate-bubble-float hidden md:block"
            style={{ animationDelay: "0s" }}
          >
            <img
              src="/lovable-uploads/moon_dorkfi.png"
              alt="Decorative DorkFi moon - top left"
              className="w-[2.844844rem] h-[2.844844rem] md:w-[3.793125rem] md:h-[3.793125rem] select-none"
              loading="lazy"
              decoding="async"
            />
          </div>
          {/* Star decorations - right side */}
          <div
            className="absolute top-6 right-8 opacity-80 pointer-events-none z-0 animate-bubble-float hidden md:block"
            style={{ animationDelay: "0.3s" }}
          >
            <img
              src="/lovable-uploads/star_dorkfi.png"
              alt="Decorative DorkFi star - top right"
              className="w-[1.5rem] h-[1.5rem] md:w-[2rem] md:h-[2rem] select-none"
              loading="lazy"
              decoding="async"
            />
          </div>
          <div
            className="absolute top-16 right-12 opacity-70 pointer-events-none z-0 animate-bubble-float hidden md:block"
            style={{ animationDelay: "0.7s" }}
          >
            <img
              src="/lovable-uploads/star_dorkfi.png"
              alt="Decorative DorkFi star - middle right"
              className="w-[1.2rem] h-[1.2rem] md:w-[1.5rem] md:h-[1.5rem] select-none"
              loading="lazy"
              decoding="async"
            />
          </div>
          <div
            className="absolute top-4 right-16 opacity-60 pointer-events-none z-0 animate-bubble-float hidden md:block"
            style={{ animationDelay: "1s" }}
          >
            <img
              src="/lovable-uploads/star_dorkfi.png"
              alt="Decorative DorkFi star - far right"
              className="w-[1rem] h-[1rem] md:w-[1.2rem] md:h-[1.2rem] select-none"
              loading="lazy"
              decoding="async"
            />
          </div>

          <div className="relative z-1 text-center">
            <H1 className="m-0 text-4xl md:text-5xl text-center text-white">
              <span className="hero-header">PreFi Deposits</span>
            </H1>
            <p className="text-sm sm:text-base md:text-lg lg:text-xl max-w-2xl md:max-w-none mx-auto text-center text-muted-foreground">
              <span className="block md:inline md:whitespace-nowrap">
                Connect Wallet / Deposit Now
              </span>
              <br className="hidden md:block" />
              <span className="block md:inline md:whitespace-nowrap">
                Earlier, larger deposits earn a greater share.
              </span>
            </p>
          </div>
        </DorkFiCard>
      </div>

      {/* Stats */}
      <header className="mx-auto max-w-6xl px-4 relative z-10">
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <MultiNetworkTLV
            enabledNetworks={enabledNetworks}
            showBreakdown={false}
            refreshInterval={300000}
            autoRefresh={true}
          />

          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <Stat
                  label="Your Total Deposited"
                  value={`$${fmt.format(globalDeposited)}`}
                  icon={TrendingUp}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                Combined value of all your deposits across all markets. Earlier
                deposits earn more rewards.
              </p>
            </TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="flex items-center gap-3 rounded-2xl border border-ocean-teal/20 bg-gradient-to-br from-slate-900 to-slate-800 p-4 shadow-sm dark-glow-card cursor-pointer hover:border-ocean-teal/40 transition-all hover:scale-105">
                <div className="rounded-xl border border-ocean-teal/30 bg-slate-800/60 p-2">
                  <BarChart3 className="h-5 w-5 text-aqua-glow" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-400">
                    Current Network
                  </div>
                  <div className="text-lg font-semibold text-white">
                    {currentNetwork.startsWith("voi")
                      ? "Voi Network"
                      : currentNetwork.startsWith("algorand")
                      ? "Algorand"
                      : getCurrentNetworkConfig().name}
                    <ChevronDown className="h-4 w-4 text-slate-400 ml-2 inline" />
                  </div>
                </div>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <div className="px-2 py-1.5">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Switch Network
                </div>
              </div>
              <DropdownMenuSeparator />
              {getEnabledNetworks().map((networkId) => {
                const networkConfig = getNetworkConfig(networkId);
                const isCurrentNetwork = currentNetwork === networkId;
                const isOnline = true; // You can implement actual network status checking here

                return (
                  <DropdownMenuItem
                    key={networkId}
                    onClick={() => handleNetworkChange(networkId)}
                    className={`cursor-pointer flex items-center justify-between ${
                      isCurrentNetwork ? "bg-accent" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {isOnline ? (
                        <Wifi className="w-4 h-4 text-green-500" />
                      ) : (
                        <WifiOff className="w-4 h-4 text-red-500" />
                      )}
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">
                          {networkConfig.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {networkConfig.networkType.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    {isCurrentNetwork && (
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                    )}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Wallet Compatibility Warning */}
      {activeAccount &&
        activeWallet &&
        (() => {
          const walletId = activeWallet.id.toLowerCase();
          const walletName = activeWallet.metadata?.name?.toLowerCase() || "";
          const isIncompatible =
            (currentNetwork === "voi-mainnet" && walletId === "pera") ||
            (currentNetwork === "voi-mainnet" && walletId === "defly") ||
            (currentNetwork === "algorand-mainnet" && walletId === "vera") ||
            (currentNetwork === "algorand-mainnet" && walletId === "biatec");

          return isIncompatible ? (
            <section className="mx-auto max-w-6xl px-4 py-4 relative z-10">
              <div className="rounded-2xl border border-yellow-500/20 bg-gradient-to-br from-yellow-900/20 to-orange-900/20 p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl border border-yellow-500/30 bg-yellow-800/20 p-2 flex-shrink-0">
                    <AlertCircle className="h-5 w-5 text-yellow-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-yellow-200 mb-1">
                      Wallet Compatibility Notice
                    </h3>
                    <p className="text-sm text-yellow-100/80 mb-2">
                      Your current wallet ({activeWallet.name}) is not
                      compatible with{" "}
                      {currentNetwork.startsWith("voi") ? "VOI" : "Algorand"}{" "}
                      network. For the best experience, we recommend using:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-md bg-yellow-800/40 text-xs font-medium text-yellow-200 border border-yellow-500/30">
                        Kibisis (Universal)
                      </span>
                      <span className="inline-flex items-center px-2 py-1 rounded-md bg-yellow-800/40 text-xs font-medium text-yellow-200 border border-yellow-500/30">
                        Lute (Universal)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          ) : null;
        })()}

      {/* Markets */}
      <main className="mx-auto max-w-6xl px-4 py-8 relative z-10">
        <div className="overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-slate-900 to-slate-800 dark-glow-card">
          {/* Market Overview Header */}
          <div className="border-b border-border/60 bg-card/60 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <h2 className="text-xl font-bold text-card-foreground">
                What is PreFi?
              </h2>
              <DorkFiButton
                variant="secondary"
                className="text-sm inline-flex items-center gap-2 self-start sm:self-auto"
                onClick={() => window.open("https://docs.dork.fi/", "_blank")}
              >
                Learn More
                <ExternalLink className="h-3 w-3" />
              </DorkFiButton>
            </div>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                PreFi lets early supporters earn VOI rewards by pre-depositing
                into upcoming DorkFi markets.
              </p>
              <p>
                Deposits are non-custodial, tracked on-chain, and earn a share
                of 5,000,000 VOI incentives.
              </p>
              <p>
                The pool is time-weighted—earlier, larger deposits earn more at
                launch.
              </p>
            </div>
          </div>
          {isMobile ? (
            // Mobile Card Layout
            <div className="space-y-3 p-4">
              {markets.map((m, index) => {
                const st = marketsState[m.id];
                const loading = !!loadingMap[m.id];
                const dep = st ? fromBase(st.depositedBase, m.decimals) : 0;
                const wal = st ? fromBase(st.walletBalanceBase, m.decimals) : 0;
                console.log(
                  `Market ${m.symbol}: dep=${dep}, wal=${wal}, st=`,
                  st
                );
                const minOk = dep >= m.min;

                return (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                  >
                    <DorkFiCard className="p-4 space-y-3 dark-glow-card">
                      {/* Asset Header */}
                      <div className="flex items-center gap-3">
                        <img
                          src={getTokenImagePath(m.symbol)}
                          alt={m.symbol}
                          className="w-9 h-9 rounded-full flex-shrink-0"
                          onError={(e) => {
                            e.currentTarget.src = "/placeholder.svg";
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-card-foreground">
                            {m.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Wallet:{" "}
                            {loading ? "…" : `${fmt.format(wal)} ${m.symbol}`}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Min:{" "}
                            {m.id === "btc" ||
                            m.id === "cbbtc" ||
                            m.id === "eth" ||
                            m.id === "ausd" ||
                            m.id === "pow"
                              ? "" // removed $ sign
                              : ""}
                            {fmt.format(m.min)} {m.symbol}
                          </div>
                        </div>
                        <div className="text-xs font-medium text-accent">
                          Est. APY{" "}
                          {loading
                            ? "…"
                            : (() => {
                                const timeRemaining = Math.max(
                                  0,
                                  (launchTs - Date.now()) / 1000
                                );
                                const currentDeposit = st
                                  ? fromBase(st.depositedBase, m.decimals)
                                  : 0;
                                const apy = calculateMarketAPY(
                                  m,
                                  voiPrice,
                                  currentDeposit,
                                  timeRemaining,
                                  marketPrices
                                );
                                // Show "20%+" for volatile microcap markets
                                return m.id === "algo" && apy >= 20
                                  ? "20%+"
                                  : `${apy.toFixed(1)}%`;
                              })()}
                        </div>
                      </div>

                      {/* Deposited Section */}
                      <div>
                        <div className="text-xs text-muted-foreground">
                          Deposited
                        </div>
                        <div className="space-y-1">
                          <div className="text-sm font-semibold tabular-nums text-card-foreground">
                            {loading
                              ? "…"
                              : marketPrices[m.id]
                              ? `$${fmt.format(dep * marketPrices[m.id])}`
                              : `${fmt.format(dep)} ${m.symbol}`}
                          </div>
                          {!loading && dep > 0 && (
                            <div className="text-xs text-muted-foreground">
                              {fmt.format(dep)} {m.symbol}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Pool Progress Section */}
                      {(() => {
                        const poolData = poolProgressData.find(
                          (p) => p.marketId === m.id
                        );
                        if (!poolData) return null;

                        // Show qualification progress if not qualified AND has deposits
                        // Otherwise show pool progress (including when deposited = 0)
                        if (
                          !minOk &&
                          st &&
                          fromBase(st.depositedBase, m.decimals) > 0
                        ) {
                          const dep = st
                            ? fromBase(st.depositedBase, m.decimals)
                            : 0;
                          const progressPct = Math.min(
                            100,
                            (dep / m.min) * 100
                          );

                          return (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="space-y-2 cursor-help">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1">
                                      <AlertCircle className="h-3 w-3 text-orange-500" />
                                      <span className="text-xs font-medium text-orange-600 dark:text-orange-400">
                                        Needs more
                                      </span>
                                    </div>
                                    <div className="text-xs font-semibold tabular-nums text-card-foreground">
                                      {fmt.format(Math.min(dep, m.min))} /{" "}
                                      {fmt.format(m.min)}
                                    </div>
                                  </div>
                                  <ProgressBar value={progressPct} max={100} />
                                  <div className="text-xs text-muted-foreground">
                                    Deposit {fmt.format(m.min - dep)} more
                                  </div>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="space-y-1">
                                  <p className="font-semibold">
                                    {m.name} Qualification
                                  </p>
                                  <p>
                                    Current: {fmt.format(dep)} {m.symbol}
                                  </p>
                                  <p>
                                    Required: {fmt.format(m.min)} {m.symbol}
                                  </p>
                                  <p>Progress: {progressPct.toFixed(1)}%</p>
                                  <p className="text-xs text-muted-foreground">
                                    Meet minimum to qualify for VOI rewards
                                  </p>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          );
                        }

                        // Show pool progress (total deposits vs max deposits)
                        // This includes: qualified users, not connected, or deposited = 0
                        return (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="space-y-2 cursor-help">
                                <ProgressBar
                                  value={poolData.percentage}
                                  max={100}
                                />
                                <div className="text-left">
                                  <div className="text-sm font-semibold tabular-nums text-card-foreground">
                                    {poolData.formattedCapacity}
                                    <span className="text-xs text-muted-foreground ml-1">
                                      ($
                                      {fmtCompact.format(
                                        poolData.totalDepositsUSD *
                                          (marketPrices[m.id] || 0)
                                      )}
                                      )
                                    </span>
                                  </div>
                                  <div className="text-xs text-muted-foreground/60">
                                    {poolData.percentage.toFixed(1)}% full
                                  </div>
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="space-y-1">
                                <p className="font-semibold">
                                  {m.name} Pool Status
                                </p>
                                <p>
                                  Current: $
                                  {fmt.format(poolData.totalDepositsUSD)}
                                </p>
                                <p>
                                  Maximum: ${fmt.format(poolData.maxDeposits)}
                                </p>
                                <p>
                                  Capacity: {poolData.percentage.toFixed(1)}%
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {poolData.percentage < 20
                                    ? "Low capacity"
                                    : poolData.percentage < 50
                                    ? "Medium capacity"
                                    : poolData.percentage < 80
                                    ? "Good capacity"
                                    : poolData.percentage < 95
                                    ? "High capacity"
                                    : "Near full"}
                                </p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })()}

                      {/* Deposit Button */}
                      <div className="flex gap-2">
                        <DorkFiButton
                          variant="secondary"
                          disabled={loading}
                          onClick={() => {
                            console.log("Deposit clicked for", m.symbol);
                            openDepositModal(m);
                          }}
                          className="flex-1 justify-center text-sm"
                        >
                          <ArrowDownCircle className="h-4 w-4" /> Deposit
                        </DorkFiButton>
                        <DorkFiButton
                          variant="danger-outline"
                          disabled={loading}
                          onClick={async () => {
                            console.log(
                              "Withdraw clicked for",
                              m.symbol,
                              "dep:",
                              dep
                            );
                            await openWithdrawModal(m);
                          }}
                          className="flex-1 justify-center text-sm"
                        >
                          <ArrowUpCircle className="h-4 w-4" /> Withdraw
                        </DorkFiButton>
                      </div>
                    </DorkFiCard>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            // Desktop/Tablet Table Layout
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-slate-800/80 to-slate-700/80 backdrop-blur-sm text-card-foreground font-semibold border-b border-border/50">
                  <tr>
                    <th className="px-6 py-4 text-sm font-medium text-left">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help inline-flex items-center gap-1">
                            Asset
                            <InfoIcon className="h-3 w-3" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            Available tokens for PreFi deposits. Each asset has
                            a minimum deposit requirement to qualify for VOI
                            rewards.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </th>
                    <th className="px-6 py-4 text-sm font-medium text-right">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help inline-flex items-center gap-1">
                            Deposited
                            <InfoIcon className="h-3 w-3" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            Amount you've already deposited for this asset.
                            Deposits are non-custodial and tracked on-chain.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </th>
                    <th className="px-6 py-4 text-sm font-medium text-right">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help inline-flex items-center gap-1">
                            Est. APY
                            <InfoIcon className="h-3 w-3" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            Estimated APY based on dynamic time-weighted
                            distributions.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </th>
                    <th className="px-6 py-4 text-sm font-medium text-center w-48">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help inline-flex items-center justify-center gap-1">
                            Pool Progress
                            <InfoIcon className="h-3 w-3" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            Shows the total pool capacity utilization. Displays
                            how much of the maximum deposit limit has been
                            reached across all participants.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </th>
                    <th className="px-6 py-4 text-sm font-medium text-center">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {markets.map((m, index) => {
                    const st = marketsState[m.id];
                    const loading = !!loadingMap[m.id];
                    const dep = st ? fromBase(st.depositedBase, m.decimals) : 0;
                    const wal = st
                      ? fromBase(st.walletBalanceBase, m.decimals)
                      : 0;
                    console.log(
                      `Desktop Market ${m.symbol}: dep=${dep}, wal=${wal}, st=`,
                      st
                    );
                    const minOk = dep >= m.min;

                    // Reward estimate (very rough): user's stake‑seconds vs global
                    const secondsRemaining = Math.max(
                      0,
                      Math.floor((launchTs - Date.now()) / 1000)
                    );
                    const myStakeSeconds = BigInt(
                      Math.floor(dep * secondsRemaining)
                    );
                    const totalSS = st?.totalStakeSecondsBase ?? 10_000_000n; // placeholder global
                    const share =
                      totalSS > 0n
                        ? Number(myStakeSeconds) / Number(totalSS)
                        : 0;
                    const yourEstReward =
                      PROGRAM.VOI_ALLOCATION_TOTAL * share * 0.25; // 25% rough portion to this market — adjust once split is known

                    return (
                      <motion.tr
                        key={m.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.1 }}
                        className="border-t border-border hover:bg-secondary/20 transition-colors card-hover cursor-pointer"
                      >
                        {/* Asset */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={getTokenImagePath(m.symbol)}
                              alt={m.symbol}
                              className="w-10 h-10 rounded-full"
                              onError={(e) => {
                                e.currentTarget.src = "/placeholder.svg";
                              }}
                            />
                            <div className="space-y-1">
                              <div className="text-sm font-semibold text-card-foreground">
                                {m.name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Wallet:{" "}
                                {loading
                                  ? "…"
                                  : `${fmt.format(wal)} ${m.symbol}`}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Min:{" "}
                                {m.id === "btc" ||
                                m.id === "cbbtc" ||
                                m.id === "eth" ||
                                m.id === "ausd" ||
                                m.id === "pow"
                                  ? "" // removed $ sign
                                  : ""}
                                {fmt.format(m.min)} {m.symbol}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Deposited */}
                        <td className="px-6 py-4 text-right">
                          <div className="space-y-1">
                            <div className="text-sm font-semibold tabular-nums text-card-foreground">
                              {loading
                                ? "…"
                                : marketPrices[m.id]
                                ? `$${fmt.format(dep * marketPrices[m.id])}`
                                : `${fmt.format(dep)} ${m.symbol}`}
                            </div>
                            {!loading && dep > 0 && (
                              <div className="space-y-1">
                                <div className="text-xs text-muted-foreground">
                                  {fmt.format(dep)} {m.symbol}
                                </div>
                                {(() => {
                                  const poolData = poolProgressData.find(
                                    (p) => p.marketId === m.id
                                  );
                                  if (
                                    poolData &&
                                    poolData.totalDepositsUSD > 0
                                  ) {
                                    const userShare =
                                      (dep / poolData.totalDepositsUSD) * 100;
                                    return userShare > 0.01 ? (
                                      <div className="text-xs text-accent">
                                        {userShare.toFixed(2)}% share
                                      </div>
                                    ) : null;
                                  }
                                  return null;
                                })()}
                              </div>
                            )}
                            {minOk && (
                              <div className="flex items-center justify-end gap-1">
                                <CheckCircle2 className="h-3 w-3 text-green-500" />
                                <span className="text-xs font-medium text-green-600 dark:text-green-400">
                                  Qualified
                                </span>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Est. APY */}
                        <td className="px-6 py-4 text-right">
                          <div className="text-sm font-semibold tabular-nums text-accent">
                            {loading
                              ? "…"
                              : (() => {
                                  const timeRemaining = Math.max(
                                    0,
                                    (launchTs - Date.now()) / 1000
                                  );
                                  const currentDeposit = st
                                    ? fromBase(st.depositedBase, m.decimals)
                                    : 0;
                                  const apy = calculateMarketAPY(
                                    m,
                                    voiPrice,
                                    currentDeposit,
                                    timeRemaining,
                                    marketPrices
                                  );
                                  // Show "20%+" for volatile microcap markets
                                  return m.id === "algo" && apy >= 20
                                    ? "20%+"
                                    : `${apy.toFixed(1)}%`;
                                })()}
                          </div>
                        </td>

                        {/* Pool Progress */}
                        <td className="px-6 py-4 w-48">
                          {(() => {
                            const poolData = poolProgressData.find(
                              (p) => p.marketId === m.id
                            );
                            if (!poolData) return null;

                            // Show qualification progress if not qualified AND has deposits
                            // Otherwise show pool progress (including when deposited = 0)
                            if (
                              !minOk &&
                              st &&
                              fromBase(st.depositedBase, m.decimals) > 0
                            ) {
                              const dep = st
                                ? fromBase(st.depositedBase, m.decimals)
                                : 0;
                              const progressPct = Math.min(
                                100,
                                (dep / m.min) * 100
                              );

                              return (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="space-y-2 cursor-help">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1">
                                          <AlertCircle className="h-3 w-3 text-orange-500" />
                                          <span className="text-xs font-medium text-orange-600 dark:text-orange-400">
                                            Needs more
                                          </span>
                                        </div>
                                        <div className="text-xs font-semibold tabular-nums text-card-foreground">
                                          {fmt.format(Math.min(dep, m.min))} /{" "}
                                          {fmt.format(m.min)}
                                        </div>
                                      </div>
                                      <ProgressBar
                                        value={progressPct}
                                        max={100}
                                      />
                                      <div className="text-xs text-muted-foreground">
                                        Deposit {fmt.format(m.min - dep)} more
                                      </div>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <div className="space-y-1">
                                      <p className="font-semibold">
                                        {m.name} Qualification
                                      </p>
                                      <p>
                                        Current: {fmt.format(dep)} {m.symbol}
                                      </p>
                                      <p>
                                        Required: {fmt.format(m.min)} {m.symbol}
                                      </p>
                                      <p>Progress: {progressPct.toFixed(1)}%</p>
                                      <p className="text-xs text-muted-foreground">
                                        Meet minimum to qualify for VOI rewards
                                      </p>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              );
                            }

                            // Show pool progress (total deposits vs max deposits)
                            // This includes: qualified users, not connected, or deposited = 0
                            return (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="space-y-2 cursor-help">
                                    <ProgressBar
                                      value={poolData.percentage}
                                      max={100}
                                    />
                                    <div className="text-left">
                                      <div className="text-sm font-semibold tabular-nums text-card-foreground">
                                        {poolData.formattedCapacity}
                                        <span className="text-xs text-muted-foreground ml-1">
                                          ($
                                          {fmtCompact.format(
                                            poolData.totalDepositsUSD *
                                              (marketPrices[m.id] || 0)
                                          )}
                                          )
                                        </span>
                                      </div>
                                      <div className="text-xs text-muted-foreground/60">
                                        {poolData.percentage.toFixed(1)}% full
                                      </div>
                                    </div>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="space-y-1">
                                    <p className="font-semibold">
                                      {m.name} Pool Status
                                    </p>
                                    <p>
                                      Current:{` `}
                                      {fmt.format(poolData.totalDepositsUSD)}
                                    </p>
                                    <p>
                                      Maximum:{` `}
                                      {fmt.format(poolData.maxDeposits)}
                                    </p>
                                    <p>
                                      Capacity: {poolData.percentage.toFixed(1)}
                                      %
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {poolData.percentage < 20
                                        ? "Low capacity"
                                        : poolData.percentage < 50
                                        ? "Medium capacity"
                                        : poolData.percentage < 80
                                        ? "Good capacity"
                                        : poolData.percentage < 95
                                        ? "High capacity"
                                        : "Near full"}
                                    </p>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            );
                          })()}
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <DorkFiButton
                              variant="secondary"
                              disabled={loading}
                              onClick={() => {
                                console.log("Deposit clicked for", m.symbol);
                                openDepositModal(m);
                              }}
                              className="text-sm"
                            >
                              <ArrowDownCircle className="h-4 w-4" /> Deposit
                            </DorkFiButton>
                            <DorkFiButton
                              variant="danger-outline"
                              disabled={loading}
                              onClick={async () => {
                                console.log(
                                  "Withdraw clicked for",
                                  m.symbol,
                                  "dep:",
                                  dep
                                );
                                await openWithdrawModal(m);
                              }}
                              className="text-sm"
                            >
                              <ArrowUpCircle className="h-4 w-4" /> Withdraw
                            </DorkFiButton>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Disclaimers */}
        <section className="mt-8">
          <div className="rounded-2xl border border-ocean-teal/20 bg-gradient-to-br from-slate-900 to-slate-800 dark-glow-card p-4 text-xs text-muted-foreground">
            <p className="mb-2">
              <strong className="text-primary">Non‑custodial:</strong> All
              prefunding deposits remain user‑controlled in on‑chain contracts.
            </p>
            <p className="mb-2">
              <strong className="text-primary">
                Time‑weighted distribution:
              </strong>{" "}
              Rewards accrue based on amount × time until launch. Earlier
              deposits earn more. Participants below the minimum threshold in
              any market will not qualify for Phase 0 rewards.
            </p>
            <p className="mb-2">
              <strong className="text-primary">Estimates only:</strong> Reward
              estimates displayed are indicative and assume placeholder global
              totals. Final distribution will use the on‑chain prefunding state
              at launch.
            </p>
            <p>
              <strong className="text-primary">Risk Disclaimer:</strong> Enter
              at your own risk. Crypto is volatile, code is experimental, and
              rewards may not moon. DYOR, fren.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 mt-4 relative z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 md:py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
            <div className="text-muted-foreground text-sm">
              <p>© 2025 DorkFi Protocol. Dive into the depths of DeFi.</p>
            </div>
            <VersionDisplay />
          </div>
        </div>
      </footer>

      {/* Deposit Modal */}
      <Dialog open={isDepositModalOpen} onOpenChange={closeDepositModal}>
        <DialogContent className="bg-card rounded-xl border border-border shadow-xl card-hover hover:shadow-lg hover:border-accent/40 transition-all max-w-md px-0 py-0">
          {showSuccess ? (
            <div className="p-6">
              <SupplyBorrowCongrats
                transactionType="deposit"
                asset={selectedMarket?.symbol || ""}
                assetIcon={
                  selectedMarket ? getTokenImagePath(selectedMarket.symbol) : ""
                }
                amount={modalAmount}
                onViewTransaction={handleViewTransaction}
                onGoToPortfolio={handleGoToPortfolio}
                onMakeAnother={handleMakeAnother}
                onClose={closeDepositModal}
              />
            </div>
          ) : (
            <>
              <DialogHeader className="pt-6 px-8 pb-1">
                <DialogTitle className="text-2xl font-bold text-center text-slate-800 dark:text-white">
                  Deposit
                </DialogTitle>
                <DialogDescription className="text-center mt-1 text-sm text-slate-400 dark:text-slate-400">
                  Enter the amount to deposit. Your available balance and
                  requirements are shown below.
                </DialogDescription>
                {selectedMarket && (
                  <div className="flex items-center justify-center gap-3 pb-2 mt-3">
                    <img
                      src={getTokenImagePath(selectedMarket.symbol)}
                      alt={selectedMarket.symbol}
                      className="w-10 h-10 rounded-full"
                      onError={(e) => {
                        e.currentTarget.src = "/placeholder.svg";
                      }}
                    />
                    <span className="text-xl font-semibold text-slate-800 dark:text-white">
                      {selectedMarket.name}
                    </span>
                  </div>
                )}
              </DialogHeader>

              {selectedMarket && (
                <div className="space-y-6 pt-2 px-8 pb-8">
                  <div className="space-y-3">
                    <Label
                      htmlFor="amount"
                      className="text-sm font-medium text-slate-600 dark:text-slate-300"
                    >
                      Amount
                    </Label>
                    <div className="relative">
                      <Input
                        id="amount"
                        type="number"
                        inputMode="decimal"
                        placeholder="0.0"
                        autoFocus
                        value={modalAmount}
                        onChange={(e) => setModalAmount(e.target.value)}
                        className="bg-background border-border text-foreground pr-16 text-lg h-12"
                      />
                      <Button
                        variant="ghost"
                        onClick={handleMaxClick}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-accent hover:bg-accent/10 h-8 px-3"
                      >
                        MAX
                      </Button>
                    </div>
                    {modalFiatValue > 0 && (
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        ≈ $
                        {modalFiatValue.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                    )}
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      Wallet Balance:{" "}
                      {marketsState[selectedMarket.id]
                        ? fmt.format(
                            fromBase(
                              marketsState[selectedMarket.id].walletBalanceBase,
                              selectedMarket.decimals
                            )
                          )
                        : "0"}{" "}
                      {selectedMarket.symbol}
                    </p>
                  </div>

                  <Card className="bg-card border-border">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            Minimum to Qualify
                          </span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <InfoIcon className="h-3 w-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>
                                Minimum deposit required to qualify for Phase 0
                                rewards
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <span className="text-sm font-medium text-card-foreground">
                          {selectedMarket.id === "btc" ||
                          selectedMarket.id === "cbbtc" ||
                          selectedMarket.id === "eth" ||
                          selectedMarket.id === "ausd" ||
                          selectedMarket.id === "pow"
                            ? "" // removed $ sign
                            : ""}
                          {fmt.format(selectedMarket.min)}{" "}
                          {selectedMarket.symbol}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            Current Deposited
                          </span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <InfoIcon className="h-3 w-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>
                                Amount you have already deposited for this
                                market
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <span className="text-sm font-medium text-slate-800 dark:text-white">
                          {marketsState[selectedMarket.id]
                            ? marketPrices[selectedMarket.id]
                              ? `$${fmt.format(
                                  fromBase(
                                    marketsState[selectedMarket.id]
                                      .depositedBase,
                                    selectedMarket.decimals
                                  ) * marketPrices[selectedMarket.id]
                                )}`
                              : `${fmt.format(
                                  fromBase(
                                    marketsState[selectedMarket.id]
                                      .depositedBase,
                                    selectedMarket.decimals
                                  )
                                )} ${selectedMarket.symbol}`
                            : "0"}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  <Button
                    onClick={handleConfirmDeposit}
                    disabled={
                      !modalAmount ||
                      Number(modalAmount) <= 0 ||
                      loadingMap[selectedMarket.id]
                    }
                    className="w-full font-semibold h-12 bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingMap[selectedMarket.id] ? (
                      <RefreshCcw className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Deposit {selectedMarket.symbol}
                  </Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Withdraw Modal */}
      {(() => {
        console.log("=== MODAL RENDER CHECK ===");
        console.log("isWithdrawModalOpen:", isWithdrawModalOpen);
        console.log("selectedMarket:", selectedMarket?.symbol);
        console.log(
          "Should render modal:",
          isWithdrawModalOpen && selectedMarket
        );
        return null;
      })()}
      {isWithdrawModalOpen && selectedMarket && (
        <WithdrawModal
          isOpen={isWithdrawModalOpen}
          onClose={closeWithdrawModal}
          tokenSymbol={selectedMarket.symbol}
          tokenIcon={getTokenImagePath(selectedMarket.symbol)}
          currentlyDeposited={
            marketsState[selectedMarket.id]
              ? fromBase(
                  marketsState[selectedMarket.id].depositedBase,
                  selectedMarket.decimals
                )
              : 0
          }
          minimumToQualify={selectedMarket.min}
          marketStats={{
            supplyAPY: (() => {
              const timeRemaining = Math.max(0, (launchTs - Date.now()) / 1000);
              const currentDeposit = marketsState[selectedMarket.id]
                ? fromBase(
                    marketsState[selectedMarket.id].depositedBase,
                    selectedMarket.decimals
                  )
                : 0;
              const apy = calculateMarketAPY(
                selectedMarket,
                voiPrice,
                currentDeposit,
                timeRemaining,
                marketPrices
              );
              // Show "20%+" for volatile microcap markets
              return selectedMarket.id === "algo" && apy >= 20 ? 20 : apy;
            })(),
            utilization: 65,
            collateralFactor: 75,
            tokenPrice: withdrawModalPrice,
          }}
          onSubmit={async (amount) => {
            if (!selectedMarket) return;

            const amountNumber = Number(amount);
            const amountBase = BigInt(
              Math.floor(amountNumber * 10 ** selectedMarket.decimals)
            );

            console.log(
              `[WITHDRAW] ${amountNumber} ${selectedMarket.symbol} (${amountBase} base units)`
            );

            setLoadingMap((prev) => ({ ...prev, [selectedMarket.id]: true }));

            try {
              let withdrawResult;

              if (isCurrentNetworkAlgorandCompatible()) {
                if (!activeAccount) {
                  console.error("Wallet not connected");
                  return;
                }
                console.log("selectedMarket", selectedMarket);
                console.log("Withdraw parameters:", {
                  poolId: selectedMarket.poolId || "",
                  marketId: selectedMarket.marketId || "",
                  amount: amount,
                  userAddress: activeAccount.address,
                  networkId: currentNetwork,
                });
                // Call the lending service withdraw method
                withdrawResult = await withdraw(
                  selectedMarket.poolId || "", // poolId - use token's poolId or fallback
                  selectedMarket.marketId || "", // marketId
                  selectedMarket.tokenStandard || "", // tokenStandard
                  amount, // amount as string
                  activeAccount.address, // userAddress
                  currentNetwork // networkId
                );

                if (!withdrawResult.success) {
                  throw new Error(withdrawResult.error || "Withdraw failed");
                }

                console.log("withdrawResult", { withdrawResult });

                const stxns = await signTransactions(
                  withdrawResult.txns.map((txn: string) =>
                    Uint8Array.from(atob(txn), (c) => c.charCodeAt(0))
                  )
                );

                const networkConfig = getCurrentNetworkConfig();
                const algorandClients = algorandService.initializeClients(
                  networkConfig.walletNetworkId as AlgorandNetwork
                );

                const res = await algorandClients.algod
                  .sendRawTransaction(stxns)
                  .do();

                await waitForConfirmation(algorandClients.algod, res.txId, 4);

                console.log("Transaction confirmed:", res);
              } else if (isCurrentNetworkEVM()) {
                // TODO: Implement EVM withdraw
                withdrawResult = {
                  success: true,
                  txId: `TXN_${Math.random().toString(36).substring(2, 15)}`,
                };
              } else {
                throw new Error("Unsupported network");
              }

              // Update tx log with actual transaction ID
              setTxLog((prev) => [
                {
                  ts: Date.now(),
                  marketId: selectedMarket.id,
                  amount: -amountNumber, // Negative amount for withdraw
                  txId:
                    withdrawResult?.txId ||
                    `TXN_${Math.random().toString(36).substring(2, 15)}`,
                },
                ...prev,
              ]);

              // Refresh balances (optimistic update)
              setMarketsState((prev) => {
                const current = prev[selectedMarket.id];
                return {
                  ...prev,
                  [selectedMarket.id]: {
                    walletBalanceBase:
                      (current?.walletBalanceBase ?? 0n) + amountBase, // Add withdrawn amount to wallet
                    depositedBase:
                      (current?.depositedBase ?? 0n) > amountBase
                        ? (current?.depositedBase ?? 0n) - amountBase
                        : 0n,
                    totalStakeSecondsBase:
                      current?.totalStakeSecondsBase ?? 10_000_000n,
                  },
                };
              });

              // Clear loading state
              setLoadingMap((prev) => ({
                ...prev,
                [selectedMarket.id]: false,
              }));

              // Close modal and show success
              closeWithdrawModal();

              // Refresh balances from blockchain to ensure accuracy (silent refresh)
              setTimeout(() => {
                if (selectedMarket) {
                  loadMarket(selectedMarket, false); // false = no loading indicators
                }
              }, 1000); // Small delay to ensure transaction is fully processed
            } catch (error) {
              console.error("Withdraw failed:", error);
              setLoadingMap((prev) => ({
                ...prev,
                [selectedMarket.id]: false,
              }));

              // You could add a toast notification here to show the error to the user
              // For now, we'll just log it
              if (error instanceof Error) {
                console.error("Withdraw error:", error.message);
              }
            }
          }}
          isLoading={loadingMap[selectedMarket.id] || false}
        />
      )}

      {/* Buy Modal */}
      <Dialog open={isBuyModalOpen} onOpenChange={setIsBuyModalOpen}>
        <DialogContent className="bg-card rounded-xl border border-border shadow-xl card-hover hover:shadow-lg hover:border-accent/40 transition-all max-w-lg px-0 py-0">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-card-foreground">
                Buy VOI Tokens
              </h2>
            </div>
            <div className="text-sm text-muted-foreground mb-4">
              Purchase VOI tokens directly through our integrated widget
            </div>
            <div className="flex justify-center">
              <iframe
                src={`https://ibuyvoi.com/widget?destination=${
                  activeAccount?.address || "VOI_WALLET_ADDRESS"
                }&theme=auto`}
                width="480"
                height="600"
                frameBorder="0"
                style={{ borderRadius: "16px" }}
                title="VOI Purchase Widget"
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
