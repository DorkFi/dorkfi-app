import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import '@/utils/bufferPolyfill';
import {
  Fuel,
  Coins,
  Zap,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Info,
  Network,
  Wallet,
  ArrowRight,
  Copy,
  ExternalLink,
  Home,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import DorkFiButton from "@/components/ui/DorkFiButton";
import DorkFiCard from "@/components/ui/DorkFiCard";
import { H1, H2, Body } from "@/components/ui/Typography";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useTokenPrice } from "@/hooks/useTokenPrice";
import WalletNetworkButton from "@/components/WalletNetworkButton";
import {
  getCurrentNetworkConfig,
  getNetworkConfig,
  getAllTokens,
  getTokenConfig,
  NetworkId,
  isCurrentNetworkEVM,
  isCurrentNetworkAlgorandCompatible,
  TokenStandard,
  getEnabledNetworks,
} from "@/config";
import { useNetwork } from "@/contexts/NetworkContext";
import { useWallet } from "@txnlab/use-wallet-react";
import { getTokenImagePath } from "@/utils/tokenImageUtils";
import GasStationService, {
  MintingRequest,
  MintingResult,
  TokenMintingInfo,
} from "@/services/gasStationService";
import algorandService, { AlgorandNetwork } from "@/services/algorandService";
import algosdk from "algosdk";

interface MintableToken extends TokenMintingInfo {
  logoPath: string;
  poolId?: string;
  nTokenId?: string;
}

interface MintingForm {
  tokenSymbol: string;
  amount: string;
  recipientAddress: string;
}

const GasStation: React.FC = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentNetwork, switchNetwork } = useNetwork();
  const { activeWallet, activeAddress, signTransactions } = useWallet();
  const [isMinting, setIsMinting] = useState(false);
  const [mintingForm, setMintingForm] = useState<MintingForm>({
    tokenSymbol: "",
    amount: "",
    recipientAddress: "",
  });
  const [showMintDialog, setShowMintDialog] = useState(false);
  const [selectedToken, setSelectedToken] = useState<MintableToken | null>(
    null
  );
  const [usdValue, setUsdValue] = useState(0);

  // Get real-time token price for selected token
  const { price: tokenPrice, isLoading: priceLoading } = useTokenPrice(
    selectedToken?.symbol || ""
  );

  // Get mintable tokens for current network from gasStation config
  const mintableTokens = useMemo(() => {
    const gasStationTokens = GasStationService.getAvailableGasStationTokens(currentNetwork);
    const allTokens = getAllTokens(currentNetwork);

    return gasStationTokens.map((mintingInfo) => {
      // Find the corresponding token config to get additional properties
      const tokenConfig = allTokens.find(token => token.symbol === mintingInfo.symbol);
      
      return {
        ...mintingInfo,
        logoPath: tokenConfig?.logoPath || "",
        poolId: tokenConfig?.poolId,
        nTokenId: tokenConfig?.nTokenId,
      };
    });
  }, [currentNetwork]);

  // Set default recipient to connected wallet address
  useEffect(() => {
    if (activeAddress && !mintingForm.recipientAddress) {
      setMintingForm((prev) => ({
        ...prev,
        recipientAddress: activeAddress,
      }));
    }
  }, [activeAddress, mintingForm.recipientAddress]);

  // Calculate USD value based on amount and real-time price
  useEffect(() => {
    if (mintingForm.amount && tokenPrice > 0) {
      const numAmount = parseFloat(mintingForm.amount);
      setUsdValue(numAmount * tokenPrice);
    } else {
      setUsdValue(0);
    }
  }, [mintingForm.amount, tokenPrice]);

  const handleTokenSelect = (tokenSymbol: string) => {
    const token = mintableTokens.find((t) => t.symbol === tokenSymbol);
    setSelectedToken(token || null);
    setMintingForm((prev) => ({
      ...prev,
      tokenSymbol,
    }));
  };

  const handleMint = async () => {
    if (!selectedToken || !activeWallet || !activeAddress) {
      toast({
        title: "Error",
        description: "Please connect your wallet and select a token to mint",
        variant: "destructive",
      });
      return;
    }

    if (!mintingForm.amount || !mintingForm.recipientAddress) {
      toast({
        title: "Error",
        description: "Please enter amount and recipient address",
        variant: "destructive",
      });
      return;
    }

    // Validate the minting request
    const mintingRequest: MintingRequest = {
      tokenSymbol: selectedToken.symbol,
      amount: mintingForm.amount,
      recipientAddress: mintingForm.recipientAddress,
      networkId: currentNetwork,
      tokenStandard: selectedToken.tokenStandard,
      contractId: selectedToken.contractId,
      assetId: selectedToken.assetId,
      decimals: selectedToken.decimals,
    };

    const validation = GasStationService.validateMintingRequest(mintingRequest);
    if (!validation.isValid) {
      toast({
        title: "Validation Error",
        description: validation.errors.join(", "),
        variant: "destructive",
      });
      return;
    }

    setIsMinting(true);
    try {
      const result = await GasStationService.mintTokens(mintingRequest);
      
      // Handle different minting result types
      if (result.txns && result.txns.length > 0) {
        // For tokens that require transaction signing (ARC200, etc.)
        const stxns = await signTransactions(
          result.txns.map((txn) => new Uint8Array(Buffer.from(txn, "base64")))
        );
        const networkConfig = getNetworkConfig(currentNetwork);
        const { algod } = algorandService.initializeClients(
          networkConfig.walletNetworkId as AlgorandNetwork
        );
        const res = await algod.sendRawTransaction(stxns).do();
        await algosdk.waitForConfirmation(algod, res.txId, 3);
      }
      // For network tokens and simulated minting, no additional transaction handling needed
      
      toast({
        title: "Success",
        description: `Successfully minted ${mintingForm.amount} ${selectedToken.symbol}`,
      });
      
      // Delay closing dialog to ensure toast is visible
      setTimeout(() => {
        setShowMintDialog(false);
      }, 1000);
      setMintingForm({
        tokenSymbol: "",
        amount: "",
        recipientAddress: activeAddress,
      });
    } catch (error) {
      console.error("Minting error:", error);
      toast({
        title: "Minting Failed",
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsMinting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Address copied to clipboard",
    });
  };


  const getNetworkDisplayName = (networkId: NetworkId): string => {
    const config = getNetworkConfig(networkId);
    return config.name;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8">
          <div className="mb-6 lg:mb-0">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-primary/10 rounded-xl">
                  <Fuel className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <H1 className="text-3xl lg:text-4xl">Gas Station</H1>
                  <Body className="text-muted-foreground mt-1">
                    Mint tokens as needed across different networks
                  </Body>
                </div>
              </div>
            </motion.div>
          </div>

          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/")}
              className="flex items-center gap-2"
            >
              <Home className="h-4 w-4" />
              Home
            </Button>
            <WalletNetworkButton />
          </div>
        </div>

        {/* Network Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-8"
        >
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Network className="h-5 w-5 text-primary" />
                  <div>
                    <Body className="font-medium">Current Network</Body>
                    <Body className="text-sm text-muted-foreground">
                      {getNetworkDisplayName(currentNetwork)}
                    </Body>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">
                  {mintableTokens.length} tokens available
                </Badge>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Available Tokens */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mb-8"
        >
          <H2 className="mb-6">Available Tokens</H2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mintableTokens.map((token) => (
              <Card
                key={token.symbol}
                className="hover:shadow-lg transition-shadow"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={token.logoPath || getTokenImagePath(token.symbol)}
                      alt={token.name}
                      className="w-10 h-10 rounded-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        if (target.src !== "/placeholder.svg") {
                          target.src = "/placeholder.svg";
                        }
                      }}
                    />
                    <div>
                      <CardTitle className="text-lg">{token.symbol}</CardTitle>
                      <Body className="text-sm text-muted-foreground">
                        {token.name}
                      </Body>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Body className="text-sm">Standard</Body>
                      <Badge variant="secondary" className="text-xs">
                        {token.tokenStandard.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <Body className="text-sm">Cost</Body>
                      <Body className="text-sm font-medium text-green-600">
                        {token.mintingCost}
                      </Body>
                    </div>
                    <Body className="text-xs text-muted-foreground">
                      {token.description}
                    </Body>
                    <DorkFiButton
                      onClick={() => {
                        handleTokenSelect(token.symbol);
                        setShowMintDialog(true);
                      }}
                      className="w-full"
                      disabled={!activeWallet}
                    >
                      <Zap className="h-4 w-4 mr-2" />
                      Mint {token.symbol}
                    </DorkFiButton>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.div>

        {/* Mint Dialog */}
        <Dialog open={showMintDialog} onOpenChange={setShowMintDialog}>
          <DialogContent className="sm:max-w-md p-6">
            <DialogHeader className="pb-4">
              <DialogTitle className="flex items-center gap-2">
                <Fuel className="h-5 w-5 text-primary" />
                Mint {selectedToken?.symbol}
              </DialogTitle>
              <DialogDescription>
                Mint {selectedToken?.name} tokens to the specified address
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Token Info */}
              {selectedToken && (
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={
                          selectedToken.logoPath ||
                          getTokenImagePath(selectedToken.symbol)
                        }
                        alt={selectedToken.name}
                        className="w-8 h-8 rounded-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          if (target.src !== "/placeholder.svg") {
                            target.src = "/placeholder.svg";
                          }
                        }}
                      />
                      <div>
                        <Body className="font-medium">
                          {selectedToken.symbol}
                        </Body>
                        <Body className="text-sm text-muted-foreground">
                          {selectedToken.name}
                        </Body>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Amount Input */}
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="Enter amount to mint"
                  value={mintingForm.amount}
                  onChange={(e) =>
                    setMintingForm((prev) => ({
                      ...prev,
                      amount: e.target.value,
                    }))
                  }
                />
                {usdValue > 0 && (
                  <p className="text-sm text-muted-foreground">
                    ≈ ${usdValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    {priceLoading && (
                      <span className="ml-2 text-xs text-muted-foreground">(updating price...)</span>
                    )}
                  </p>
                )}
              </div>

              {/* Recipient Address */}
              <div className="space-y-2">
                <Label htmlFor="recipient">Recipient Address</Label>
                <div className="flex gap-2">
                  <Input
                    id="recipient"
                    placeholder="Enter recipient address"
                    value={mintingForm.recipientAddress}
                    onChange={(e) =>
                      setMintingForm((prev) => ({
                        ...prev,
                        recipientAddress: e.target.value,
                      }))
                    }
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      copyToClipboard(mintingForm.recipientAddress)
                    }
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Network Info */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Network className="h-4 w-4 text-muted-foreground" />
                      <Body className="text-sm">Network</Body>
                    </div>
                    <Body className="text-sm font-medium">
                      {getNetworkDisplayName(currentNetwork)}
                    </Body>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex gap-3 pt-6">
              <Button
                variant="outline"
                onClick={() => setShowMintDialog(false)}
                className="flex-1"
                disabled={isMinting}
              >
                Cancel
              </Button>
              <DorkFiButton
                onClick={handleMint}
                className="flex-1"
                disabled={
                  isMinting ||
                  !mintingForm.amount ||
                  !mintingForm.recipientAddress
                }
              >
                {isMinting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Minting...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Mint Tokens
                  </>
                )}
              </DorkFiButton>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default GasStation;
