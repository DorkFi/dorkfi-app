import { lazy, Suspense, useCallback, useState } from "react";
import { useFiatOnramp, useFundWallet } from "@privy-io/react-auth";
import { useQuery } from "@tanstack/react-query";
import { base } from "viem/chains";
import type { Address } from "viem";
import {
  CheckCircle2,
  CreditCard,
  Loader2,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { usePrivyEasyStart } from "@/contexts/PrivySessionProvider";
import { useConsumerCopy } from "@/contexts/ProductFlavorContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  BASE_MAINNET_USDC,
  fetchBaseEthBalance,
  fetchBaseUsdcBalance,
  hasEnoughBaseEth,
} from "@/lib/easyStart/baseBalances";
import {
  bridgePhaseLabel,
  type EasyStartBridgePhase,
} from "@/components/easy-start/easyStartBridgePhase";
import { isXoGeoRestricted } from "@/lib/easyStart/xoSwap/errors";
import {
  CARD_PROVIDERS,
  DEPOSIT_CARD_PROVIDERS,
  EasyStartCardProviderPicker,
  type DepositCardProvider,
  type PrivyCardProvider,
} from "@/components/easy-start/EasyStartCardProviderPicker";

/** Loaded only while bridging so opening Deposit never waits on `@privy-io/wagmi`. */
const EasyStartHeadlessBridge = lazy(() =>
  import("@/components/easy-start/EasyStartHeadlessBridge").then((m) => ({
    default: m.EasyStartHeadlessBridge,
  }))
);

const PRESET_AMOUNTS = ["50", "100", "250", "500"];
const PRIVY_MODAL_HANDOFF_MS = 200;
/** Small USD native top-up so Base can pay gas for the XO Swap send. */
const GAS_TOPUP_USD = "3";

const EASY_START_DIALOG_CONTENT_CLASS =
  "bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 text-slate-800 dark:text-white rounded-xl border border-gray-200/50 dark:border-ocean-teal/20 shadow-xl max-w-[95vw] md:max-w-md max-h-[min(90vh,90dvh)] min-h-0 overflow-x-hidden overflow-y-auto flex flex-col p-0 overscroll-contain";

type DepositPhase =
  | "idle"
  | "funding"
  | "gas"
  | "bridging"
  | "success"
  | "error";

interface EasyStartDepositSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional escape hatch to the advanced XO Swap UI. */
  onOpenAdvancedBridge?: () => void;
}

function isUserCanceledFunding(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("cancel") ||
    lower.includes("close") ||
    lower.includes("exited") ||
    lower.includes("dismiss")
  );
}

/**
 * Cash Stash–style single Deposit: amount → pay → (gas if needed) → auto-bridge → done.
 * Must render under PrivyProvider.
 */
export function EasyStartDepositSheet({
  open,
  onOpenChange,
  onOpenAdvancedBridge,
}: EasyStartDepositSheetProps) {
  const { fundWallet } = useFundWallet();
  const { fund: fundFiatOnramp } = useFiatOnramp();
  const { evmAddress, algorandAddress } = usePrivyEasyStart();
  const consumerCopy = useConsumerCopy();
  const { toast } = useToast();

  const [amount, setAmount] = useState("100");
  const [cardProvider, setCardProvider] =
    useState<DepositCardProvider>("moonpay");
  const [phase, setPhase] = useState<DepositPhase>("idle");
  const [bridgePhase, setBridgePhase] =
    useState<EasyStartBridgePhase>("preparing");
  const [bridgeAmount, setBridgeAmount] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [skipFiat, setSkipFiat] = useState(false);

  const address = evmAddress as Address | null;

  const { data: baseUsdc, refetch: refetchUsdc } = useQuery({
    queryKey: ["easy-start-base-usdc", address],
    queryFn: () => fetchBaseUsdcBalance(address!),
    enabled: Boolean(open && address),
    refetchInterval: open ? 10_000 : false,
  });

  const baseUsdcNum = baseUsdc
    ? Number.parseFloat(baseUsdc.formatted)
    : 0;
  const hasUsdcOnBase =
    Number.isFinite(baseUsdcNum) && baseUsdcNum > 0.01;

  const resetLocal = useCallback(() => {
    setPhase("idle");
    setBridgePhase("preparing");
    setBridgeAmount(null);
    setError(null);
    setSkipFiat(false);
  }, []);

  const handleClose = (next: boolean) => {
    if (!next) {
      if (
        phase === "idle" ||
        phase === "success" ||
        phase === "error" ||
        phase === "gas"
      ) {
        resetLocal();
      }
    }
    onOpenChange(next);
  };

  const ensureGasThenBridge = async (usdcAmount: string) => {
    if (!address) return;
    try {
      const eth = await fetchBaseEthBalance(address);
      if (!hasEnoughBaseEth(eth.value)) {
        setPhase("gas");
        setBridgeAmount(usdcAmount);
        onOpenChange(true);
        return;
      }
      setBridgeAmount(usdcAmount);
      setPhase("bridging");
      onOpenChange(true);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message || "Couldn’t check processing fees");
      setPhase("error");
      onOpenChange(true);
    }
  };

  /** MoonPay / Coinbase card on-ramp via fundWallet (does not surface Stripe). */
  const fundWithCardProvider = async (
    options: {
      asset: "USDC" | "native-currency";
      amount: string;
      preferredProvider?: PrivyCardProvider;
    }
  ) => {
    if (!address) return;
    await fundWallet({
      address,
      options: {
        chain: base,
        asset: options.asset,
        amount: options.amount,
        defaultFundingMethod: "card",
        ...(options.preferredProvider
          ? { card: { preferredProvider: options.preferredProvider } }
          : {}),
      },
    });
  };

  /**
   * Stripe + multi-provider fiat on-ramp (Privy useFiatOnramp).
   * Requires Stripe On-ramp enabled in Privy dashboard + @stripe/crypto.
   */
  const fundWithStripeOnramp = async (usdAmount: string) => {
    if (!address) return;
    await fundFiatOnramp({
      source: {
        assets: ["usd"],
        defaultAsset: "usd",
      },
      destination: {
        asset: BASE_MAINNET_USDC,
        chain: "eip155:8453",
        address,
      },
      environment: import.meta.env.DEV ? "sandbox" : "production",
      defaultAmount: usdAmount,
    });
  };

  const handleFundGas = async () => {
    if (!address) return;
    setError(null);
    onOpenChange(false);
    await new Promise((r) => setTimeout(r, PRIVY_MODAL_HANDOFF_MS));
    try {
      if (cardProvider === "stripe") {
        // Stripe path funds USDC primarily; for gas use MoonPay/Coinbase fallback.
        await fundWithCardProvider({
          asset: "native-currency",
          amount: GAS_TOPUP_USD,
          preferredProvider: "moonpay",
        });
      } else {
        await fundWithCardProvider({
          asset: "native-currency",
          amount: GAS_TOPUP_USD,
          preferredProvider: cardProvider,
        });
      }
      const usdc = bridgeAmount ?? amount;
      await ensureGasThenBridge(usdc);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      if (isUserCanceledFunding(message)) {
        setPhase("gas");
        onOpenChange(true);
        return;
      }
      setError(message || "Couldn’t add network fee funds");
      setPhase("error");
      onOpenChange(true);
    }
  };

  const startBridgeWithExisting = async () => {
    if (!address) return;
    setError(null);
    const refreshed = await refetchUsdc();
    const balStr = refreshed.data?.formatted ?? baseUsdc?.formatted ?? "0";
    const bal = Number.parseFloat(balStr);
    const requested = Number(amount);
    const toBridge =
      Number.isFinite(requested) && requested > 0
        ? Math.min(requested, Number.isFinite(bal) && bal > 0 ? bal : requested)
        : bal;
    if (!toBridge || toBridge <= 0) {
      setError(
        consumerCopy
          ? "No funds to move yet. Deposit with a card first."
          : "No USDC on Base to move yet. Deposit with a card first."
      );
      setPhase("error");
      return;
    }
    const formatted = toBridge.toFixed(6).replace(/\.?0+$/, "") || "0";
    await ensureGasThenBridge(formatted);
  };

  const handleDeposit = async () => {
    if (!address) return;
    setError(null);

    if (skipFiat || (hasUsdcOnBase && baseUsdcNum >= Number(amount))) {
      setPhase("funding");
      await startBridgeWithExisting();
      return;
    }

    setPhase("funding");
    onOpenChange(false);
    await new Promise((r) => setTimeout(r, PRIVY_MODAL_HANDOFF_MS));

    try {
      if (cardProvider === "stripe") {
        await fundWithStripeOnramp(amount);
      } else {
        await fundWithCardProvider({
          asset: "USDC",
          amount,
          preferredProvider: cardProvider,
        });
      }
      await new Promise((r) => setTimeout(r, 1500));
      await refetchUsdc();
      await ensureGasThenBridge(amount);
      toast({
        title: "Payment received",
        description: "Finishing your deposit…",
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      if (isUserCanceledFunding(message)) {
        resetLocal();
        return;
      }
      setError(message || "Something went wrong opening payment");
      setPhase("error");
      onOpenChange(true);
      toast({
        title: "Payment couldn’t start",
        description: message,
        variant: "destructive",
      });
    }
  };

  const busy =
    phase === "funding" || phase === "bridging";

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className={EASY_START_DIALOG_CONTENT_CLASS}>
          <div className="flex flex-col min-h-0">
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 px-6 pt-4 pb-2 shrink-0">
              <DialogHeader className="pb-0 space-y-2">
                <DialogTitle className="text-2xl font-bold text-center text-slate-800 dark:text-white">
                  Deposit
                </DialogTitle>
                <div className="flex items-center justify-center gap-2 pb-1">
                  <Sparkles className="h-5 w-5 text-ocean-teal" />
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                    Add cash · start earning
                  </span>
                </div>
                <DialogDescription className="text-center text-sm text-slate-600 dark:text-slate-400">
                  {phase === "idle"
                    ? consumerCopy
                      ? "Pay with a card. We’ll add the funds to your account automatically."
                      : "Choose MoonPay, Coinbase, or Stripe, then pay with card. We’ll move your USDC to Algorand automatically."
                    : phase === "gas"
                      ? consumerCopy
                        ? "One quick step: a small processing fee, then we finish the deposit."
                        : "One quick step: add a little ETH for network fees, then we finish the deposit."
                      : phase === "bridging"
                        ? bridgePhaseLabel(bridgePhase)
                        : phase === "success"
                          ? consumerCopy
                            ? "Your funds are ready."
                            : "Your funds are ready on Algorand."
                          : phase === "error"
                            ? isXoGeoRestricted(error)
                              ? "This payment provider isn’t available in your region."
                              : "Something went wrong — you can retry."
                            : "Working on your deposit…"}
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="px-6 pb-6 pt-4">
              {phase === "success" ? (
                <div className="py-4 text-center space-y-4">
                  <CheckCircle2 className="mx-auto h-12 w-12 text-ocean-teal" />
                  <p className="text-lg font-semibold text-slate-800 dark:text-white">
                    Deposit complete
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {consumerCopy
                      ? "Your deposit is in your account. You can add it to savings next."
                      : `USDC is in your Algorand account${
                          algorandAddress
                            ? ` (${algorandAddress.slice(0, 6)}…${algorandAddress.slice(-4)})`
                            : ""
                        }. You can supply to DorkFi markets next.`}
                  </p>
                  <Button
                    className="w-full bg-ocean-teal hover:bg-ocean-teal/90 text-white"
                    onClick={() => handleClose(false)}
                  >
                    Done
                  </Button>
                </div>
              ) : phase === "bridging" || phase === "funding" ? (
                <div className="py-10 flex flex-col items-center gap-3 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-ocean-teal" />
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    {phase === "funding"
                      ? "Opening payment…"
                      : bridgePhaseLabel(bridgePhase)}
                  </p>
                  {error ? (
                    <p className="text-sm text-destructive" role="alert">
                      {error}
                    </p>
                  ) : null}
                </div>
              ) : phase === "gas" ? (
                <div className="space-y-4 py-2">
                  <p className="text-sm text-slate-600 dark:text-slate-400 text-center">
                    {consumerCopy
                      ? `Deposits need a small processing fee (about $${GAS_TOPUP_USD}), separate from the amount you deposited.`
                      : "Bridging needs a tiny bit of ETH on Base for gas (separate from your USDC). About $" +
                        GAS_TOPUP_USD +
                        " is enough."}
                  </p>
                  <EasyStartCardProviderPicker
                    value={
                      cardProvider === "stripe" ? "moonpay" : cardProvider
                    }
                    onChange={(p) =>
                      setCardProvider(p as DepositCardProvider)
                    }
                    providers={CARD_PROVIDERS}
                    label="Fee payment method"
                  />
                  {error ? (
                    <p className="text-sm text-destructive" role="alert">
                      {error}
                    </p>
                  ) : null}
                  <Button
                    className="w-full bg-ocean-teal hover:bg-ocean-teal/90 text-white font-semibold"
                    onClick={() => void handleFundGas()}
                  >
                    <CreditCard className="mr-2 h-4 w-4" />
                    Add processing fee
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={() =>
                      void ensureGasThenBridge(bridgeAmount ?? amount)
                    }
                  >
                    {consumerCopy
                      ? "I already paid the fee — continue"
                      : "I already added ETH — continue"}
                  </Button>
                </div>
              ) : phase === "error" ? (
                <div className="space-y-4 py-2 text-center">
                  <p className="text-sm text-destructive" role="alert">
                    {error ?? "Deposit failed"}
                  </p>
                  <Button
                    className="w-full bg-ocean-teal hover:bg-ocean-teal/90 text-white"
                    onClick={() => {
                      resetLocal();
                    }}
                  >
                    Try again
                  </Button>
                  {onOpenAdvancedBridge ? (
                    <Button
                      variant="outline"
                      className="w-full border-ocean-teal/40"
                      onClick={() => {
                        handleClose(false);
                        onOpenAdvancedBridge();
                      }}
                    >
                      Open advanced bridge
                    </Button>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-5">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-3">
                      Amount (USD)
                    </p>
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      {PRESET_AMOUNTS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setAmount(preset)}
                          className={cn(
                            "rounded-xl border py-2.5 text-sm font-semibold transition-colors",
                            amount === preset
                              ? "border-ocean-teal bg-ocean-teal/10 text-ocean-teal"
                              : "border-gray-200/80 dark:border-slate-600 hover:bg-white/50 dark:hover:bg-slate-700/50 text-slate-800 dark:text-white"
                          )}
                        >
                          ${preset}
                        </button>
                      ))}
                    </div>
                    <label
                      className="text-xs text-slate-500 dark:text-slate-400"
                      htmlFor="deposit-custom-amount"
                    >
                      Custom amount
                    </label>
                    <input
                      id="deposit-custom-amount"
                      type="number"
                      min="1"
                      step="1"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-gray-200/80 dark:border-slate-600 bg-white/70 dark:bg-slate-900/60 px-3 py-2.5 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-ocean-teal/40"
                    />
                  </div>

                  {hasUsdcOnBase ? (
                    <label className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-0.5 rounded border-slate-400"
                        checked={skipFiat}
                        onChange={(e) => setSkipFiat(e.target.checked)}
                      />
                      <span>
                        Use funds already in your account (
                        {baseUsdcNum.toLocaleString(undefined, {
                          maximumFractionDigits: 2,
                        })}
                        ) — skip card
                      </span>
                    </label>
                  ) : null}

                  {!skipFiat ? (
                    <EasyStartCardProviderPicker
                      value={cardProvider}
                      onChange={(p) =>
                        setCardProvider(p as DepositCardProvider)
                      }
                      providers={DEPOSIT_CARD_PROVIDERS}
                    />
                  ) : null}

                  {!address ? (
                    <p className="text-sm text-amber-600 dark:text-amber-400">
                      Waiting for your account…
                    </p>
                  ) : null}

                  <Button
                    className="w-full bg-ocean-teal hover:bg-ocean-teal/90 text-white font-semibold"
                    disabled={
                      busy || !address || !amount || Number(amount) <= 0
                    }
                    onClick={() => void handleDeposit()}
                  >
                    {busy ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Working…
                      </>
                    ) : (
                      <>
                        <CreditCard className="mr-2 h-4 w-4" />
                        Deposit
                      </>
                    )}
                  </Button>

                  {onOpenAdvancedBridge ? (
                    <button
                      type="button"
                      className="w-full text-center text-xs text-slate-500 hover:text-ocean-teal underline-offset-2 hover:underline"
                      onClick={() => {
                        handleClose(false);
                        onOpenAdvancedBridge();
                      }}
                    >
                      Advanced bridge options
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {phase === "bridging" && bridgeAmount ? (
        <Suspense fallback={null}>
          <EasyStartHeadlessBridge
            enabled
            amount={bridgeAmount}
            onPhaseChange={(p, err) => {
              setBridgePhase(p);
              if (p === "error") {
                setError(err ?? "Bridge failed");
                setPhase("error");
              }
            }}
            onComplete={() => {
              setPhase("success");
              void refetchUsdc();
              onOpenChange(true);
              toast({
                title: "Deposit complete",
                description: consumerCopy
                  ? "Your deposit is ready."
                  : "USDC is ready on your Algorand account.",
              });
            }}
          />
        </Suspense>
      ) : null}
    </>
  );
}
