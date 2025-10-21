import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ArrowLeft } from "lucide-react";
import { LiquidationAccount } from "@/hooks/useLiquidationData";
import LiquidationStepOne from "./LiquidationStepOne";
import LiquidationStepTwo from "./LiquidationStepTwo";
import LiquidationCongrats from "./LiquidationCongrats";
import { useToast } from "@/hooks/use-toast";
import { shortenAddress } from "@/utils/liquidationUtils";
import {
  getRiskColor,
  getRiskLevel,
  getRiskVariant,
} from "@/utils/riskCalculations";
import {
  getAllTokensWithDisplayInfo,
  getCurrentWalletNetworkId,
  NetworkId,
} from "@/config";
import AccountOverview from "./AccountOverview";
import algorandService, {
  AlgorandNetwork,
  getCurrentConfig,
} from "@/services/algorandService";
import { useWallet } from "@txnlab/use-wallet-react";
import BigNumber from "bignumber.js";
import { abi, CONTRACT } from "ulujs";
import { APP_SPEC as LendingPoolAppSpec } from "@/clients/DorkFiLendingPoolClient";
import algosdk from "algosdk";

// Helper function to convert wallet network ID to config NetworkId
const getConfigNetworkIdFromWalletNetworkId = (
  walletNetworkId: string
): NetworkId => {
  // Map wallet network IDs to config network IDs
  const networkMapping: Record<string, NetworkId> = {
    mainnet: "algorand-mainnet",
    testnet: "algorand-testnet",
    voimain: "voi-mainnet",
    voitest: "voi-testnet",
    local: "localnet",
    "ethereum-mainnet": "ethereum-mainnet",
    "ethereum-testnet": "ethereum-testnet",
    "base-mainnet": "base-mainnet",
    "base-testnet": "base-testnet",
  };

  const configNetworkId = networkMapping[walletNetworkId];
  if (!configNetworkId) {
    throw new Error(`Unknown wallet network ID: ${walletNetworkId}`);
  }

  return configNetworkId;
};

// Helper function to get token config for a token symbol
const getTokenConfig = async (networkId: NetworkId, tokenSymbol: string) => {
  const tokens = getAllTokensWithDisplayInfo(networkId);

  const token = tokens.find((t) => t.symbol === tokenSymbol);
  if (!token) {
    throw new Error(`Token ${tokenSymbol} not found`);
  }

  return token;
};

export interface LiquidationParams {
  repayAmountUSD: number;
  repayToken: string;
  collateralToken: string;
  collateralAmount: number;
  liquidationBonus: number;
  debtPrice: number;
}

interface EnhancedAccountDetailModalProps {
  account: LiquidationAccount;
  isOpen: boolean;
  onClose: () => void;
  isMobile: boolean;
  initialStep?: "overview" | "step1";
}

export default function EnhancedAccountDetailModal({
  account,
  isOpen,
  onClose,
  isMobile,
  initialStep = "overview",
}: EnhancedAccountDetailModalProps) {
  const { activeNetwork, activeAccount, signTransactions } = useWallet();
  const [liquidationStep, setLiquidationStep] = useState<
    "overview" | "step1" | "step2" | "success"
  >("overview");
  const [liquidationParams, setLiquidationParams] =
    useState<LiquidationParams | null>(null);
  const { toast } = useToast();

  // Sync initial step when modal opens or account changes
  useEffect(() => {
    if (isOpen) {
      setLiquidationStep(initialStep);
      setLiquidationParams(null);
    }
  }, [isOpen, initialStep, account]);

  const handleInitiateLiquidation = () => {
    setLiquidationStep("step1");
  };

  const handleStepOneComplete = (params: LiquidationParams) => {
    setLiquidationParams(params);
    setLiquidationStep("step2");
  };

  const handleLiquidationConfirm = async () => {
    if (!liquidationParams) return;

    try {
      // Convert liquidation params to contract method parameters
      console.log("Liquidation confirmed:", liquidationParams);

      // Get token configs for debt and collateral tokens
      const configNetworkId =
        getConfigNetworkIdFromWalletNetworkId(activeNetwork);

      const clients = algorandService.initializeClients(
        activeNetwork as AlgorandNetwork
      );

      const debtTokenConfig = await getTokenConfig(
        configNetworkId,
        liquidationParams.repayToken
      );
      const collateralTokenConfig = await getTokenConfig(
        configNetworkId,
        liquidationParams.collateralToken
      );

      // Extract market IDs from token configs
      const debtMarketId = parseInt(
        debtTokenConfig.underlyingContractId || "0"
      );
      const collateralMarketId = parseInt(
        collateralTokenConfig.underlyingContractId || "0"
      );

      // Convert USD amounts to token units using prices
      const debtAmountInTokens = BigInt(
        new BigNumber(liquidationParams.repayAmountUSD)
          .dividedBy(liquidationParams.debtPrice)
          .multipliedBy(new BigNumber(10).pow(debtTokenConfig.decimals))
          .toFixed(0)
      );

      const minCollateralReceived = BigInt(
        new BigNumber(liquidationParams.collateralAmount)
          .multipliedBy(new BigNumber(10).pow(collateralTokenConfig.decimals))
          .toFixed(0)
      );

      const liquidationMethodParams = {
        debtMarketId: debtMarketId,
        collateralMarketId: collateralMarketId,
        user: account.walletAddress,
        debtAmount: debtAmountInTokens,
        minCollateralReceived: minCollateralReceived,
      };

      console.log("Liquidation method params:", liquidationMethodParams);
      console.log("Debt token config:", debtTokenConfig);
      console.log("Collateral token config:", collateralTokenConfig);

      if (
        Number(collateralTokenConfig.poolId) !== Number(debtTokenConfig.poolId)
      ) {
        throw new Error(
          "Collateral token pool ID does not match debt token pool ID"
        );
      }

      const ci = new CONTRACT(
        Number(debtTokenConfig.poolId),
        clients.algod,
        undefined,
        abi.custom,
        {
          addr: activeAccount?.address,
          sk: new Uint8Array(),
        }
      );

      const builder = {
        lending: new CONTRACT(
          Number(debtTokenConfig.poolId),
          clients.algod,
          undefined,
          { ...LendingPoolAppSpec.contract, events: [] },
          {
            addr: activeAccount?.address,
            sk: new Uint8Array(),
          },
          true,
          false,
          true
        ),
        debtToken: new CONTRACT(
          Number(debtTokenConfig.underlyingContractId),
          clients.algod,
          undefined,
          abi.nt200,
          {
            addr: activeAccount?.address,
            sk: new Uint8Array(),
          },
          true,
          false,
          true
        ),
        collateralToken: new CONTRACT(
          Number(collateralTokenConfig.underlyingContractId),
          clients.algod,
          undefined,
          abi.nt200,
          {
            addr: activeAccount?.address,
            sk: new Uint8Array(),
          },
          true,
          false,
          true
        ),
      };

      const buildN = [];

      // arc200 approve
      {
        const txnO = (
          await builder.debtToken.arc200_approve(
            algosdk.getApplicationAddress(Number(debtTokenConfig.poolId)),
            debtAmountInTokens
          )
        ).obj;
        buildN.push(txnO);
      }

      // Liquidate cross market
      {
        const txnO = (
          await builder.lending.liquidate_cross_market(
            debtMarketId,
            collateralMarketId,
            account.walletAddress,
            debtAmountInTokens,
            0
          )
        ).obj;
        buildN.push(txnO);
      }

      // sync account for price  change  debt token
      {
        const txnO = (
          await builder.lending.sync_user_market_for_price_change(
            account.walletAddress,
            Number(debtMarketId)
          )
        ).obj;
        buildN.push(txnO);
      }

      // sync account for price  change  collateral token
      {
        const txnO = (
          await builder.lending.sync_user_market_for_price_change(
            account.walletAddress,
            Number(collateralMarketId)
          )
        ).obj;
        buildN.push(txnO);
      }

      ci.setFee(1e5);
      ci.setEnableGroupResourceSharing(true);
      ci.setExtraTxns(buildN);
      const customR = await ci.custom();

      const stxns = await signTransactions(
        customR.txns.map((txn: string) =>
          Uint8Array.from(atob(txn), (c) => c.charCodeAt(0))
        )
      );
      const algorandClients =
        await algorandService.getCurrentClientsForTransactions();
      const res = await algorandClients.algod.sendRawTransaction(stxns).do();
      await algosdk.waitForConfirmation(algorandClients.algod, res.txId, 4);

      // Show success screen
      setLiquidationStep("success");
    } catch (error) {
      console.error("Liquidation error:", error);
      toast({
        title: "Transaction Failed",
        description: "Please try again or adjust gas settings.",
        variant: "destructive",
      });
    }
  };

  const handleBackToOverview = () => {
    setLiquidationStep("overview");
    setLiquidationParams(null);
  };

  const handleBackToStepOne = () => {
    setLiquidationStep("step1");
  };

  const handleViewTransaction = () => {
    window.open("https://testnet.algoexplorer.io/", "_blank");
  };

  const handleReturnToMarkets = () => {
    // Reset and close
    setLiquidationStep("overview");
    setLiquidationParams(null);
    onClose();
  };

  const handleLiquidateAnother = () => {
    setLiquidationStep("overview");
    setLiquidationParams(null);
  };

  const renderContent = () => {
    switch (liquidationStep) {
      case "step1":
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-1 mb-3">
              <button
                type="button"
                className="p-2 hover:bg-muted rounded-lg transition-colors"
                onClick={handleBackToOverview}
              >
                <ArrowLeft className="h-4 w-4 text-foreground" />
              </button>
              <h3 className="text-base md:text-lg font-semibold text-foreground">
                Step 1: Select Collateral & Amount
              </h3>
            </div>
            <LiquidationStepOne
              account={account}
              onComplete={handleStepOneComplete}
              onCancel={handleBackToOverview}
            />
          </div>
        );
      case "step2":
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-1 mb-3">
              <button
                type="button"
                className="p-2 hover:bg-muted rounded-lg transition-colors"
                onClick={handleBackToStepOne}
              >
                <ArrowLeft className="h-4 w-4 text-foreground" />
              </button>
              <h3 className="text-base md:text-lg font-semibold text-foreground">
                Step 2: Confirm Liquidation
              </h3>
            </div>
            <LiquidationStepTwo
              account={account}
              liquidationParams={liquidationParams!}
              onConfirm={handleLiquidationConfirm}
              onCancel={handleBackToStepOne}
            />
          </div>
        );
      case "success":
        return (
          <LiquidationCongrats
            account={account}
            liquidationParams={liquidationParams!}
            onViewTransaction={handleViewTransaction}
            onReturnToMarkets={handleReturnToMarkets}
            onLiquidateAnother={handleLiquidateAnother}
            onClose={handleReturnToMarkets}
          />
        );
      default:
        return (
          <AccountOverview
            account={account}
            onInitiateLiquidation={handleInitiateLiquidation}
          />
        );
    }
  };

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={onClose}>
        <DrawerContent className="max-h-[90vh] bg-background border-border text-foreground rounded-t-xl">
          <DrawerHeader className="border-b border-border pb-2">
            <DrawerTitle className="text-foreground text-left">
              {liquidationStep === "success"
                ? "Liquidation Complete"
                : `Account Details - ${shortenAddress(account.walletAddress)}`}
            </DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-6 pt-4">
            {renderContent()}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl h-[95vh] bg-background text-foreground rounded-xl border border-gray-200/50 dark:border-ocean-teal/20 shadow-xl card-hover hover:shadow-lg hover:border-ocean-teal/40 transition-all p-0 flex flex-col">
        <DialogHeader className="border-b border-border p-4 pb-3 flex-shrink-0">
          <DialogTitle className="text-foreground text-left">
            {liquidationStep === "success"
              ? "Liquidation Complete"
              : `Account Details - ${shortenAddress(account.walletAddress)}`}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 pt-3">
          {renderContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
