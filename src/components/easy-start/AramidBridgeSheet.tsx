import { useEffect, useMemo, useState } from "react";
import { useSendTransaction } from "@privy-io/react-auth";
import { useWallet } from "@txnlab/use-wallet-react";
import { ArrowLeftRight, Loader2, Waypoints } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  EASY_START_FUNDING_DIALOG_CLASS,
  FundingSheetHeader,
} from "@/components/easy-start/EasyStartFundingUi";
import { usePrivyEasyStart } from "@/contexts/privyEasyStartContext";
import { useNetwork } from "@/contexts/NetworkContext";
import { isSponsorLegFunded, requestEasyStartSponsor } from "@/lib/easyStart/sponsorApi";
import { findAramidDestinationConfirm } from "@/lib/aramid/claim";
import { loadAramidConfig } from "@/lib/aramid/config";
import {
  baseUnitsToHuman,
  computeAramidAmounts,
  humanToBaseUnits,
} from "@/lib/aramid/fees";
import { isAvmChain, listAramidRoutes, routeKey } from "@/lib/aramid/routes";
import {
  claimAramidOnBase,
  runAramidBridge,
  type AramidBridgeStep,
  type EvmSendFn,
} from "@/lib/aramid/run";
import {
  ARAMID_CHAIN,
  ARAMID_CHAIN_LABEL,
  type AramidChainId,
  type AramidChainKey,
  type AramidRoute,
} from "@/lib/aramid/types";

const CHAIN_KEYS: AramidChainKey[] = ["base", "algorand", "voi"];

const STEP_LABEL: Record<AramidBridgeStep, string> = {
  preparing: "Checking the route…",
  "opting-in": "Opting in on Algorand…",
  approving: "Approving the token…",
  signing: "Confirm in your wallet…",
  confirming: "Waiting for confirmation…",
  claiming: "Claiming on Base…",
};

function chainIdOf(key: AramidChainKey): AramidChainId {
  return ARAMID_CHAIN[key];
}

function keyOf(chainId: AramidChainId): AramidChainKey {
  if (chainId === ARAMID_CHAIN.base) return "base";
  if (chainId === ARAMID_CHAIN.voi) return "voi";
  return "algorand";
}

function txUrl(chainId: AramidChainId, id: string): string {
  if (chainId === ARAMID_CHAIN.base) return `https://basescan.org/tx/${id}`;
  if (chainId === ARAMID_CHAIN.voi) {
    return `https://block.voi.network/explorer/transaction/${id}`;
  }
  return `https://allo.info/tx/${id}`;
}

interface AramidBridgeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function BridgeResult({
  fromChain,
  toChain,
  sourceTxId,
  claimTxId,
  destinationTxId,
  receiveLabel,
  busy,
  error,
  step,
  canClaim,
  onClaim,
  onBridgeAgain,
}: {
  fromChain: AramidChainId;
  toChain: AramidChainId;
  sourceTxId: string;
  claimTxId: string | null;
  destinationTxId: string | null;
  receiveLabel: string;
  busy: boolean;
  error: string | null;
  step: AramidBridgeStep | null;
  canClaim: boolean;
  onClaim: () => void;
  onBridgeAgain: () => void;
}) {
  const destinationLabel = ARAMID_CHAIN_LABEL[toChain];
  const arrived = Boolean(destinationTxId || claimTxId);
  const payoutId = destinationTxId || claimTxId;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-lg font-semibold text-foreground">
        {arrived ? "Confirmed" : "Pending"}
      </p>
      <p className="text-sm text-muted-foreground">
        {arrived
          ? `${receiveLabel} arrived on ${destinationLabel}.`
          : `Waiting for ${destinationLabel} to deliver ${receiveLabel}.`}
      </p>
      {!arrived && toChain === ARAMID_CHAIN.base && !canClaim ? (
        <p className="text-sm text-muted-foreground">
          Claim this transfer from your Base wallet on the Aramid bridge.
        </p>
      ) : null}
      <a
        className="text-sm text-ocean-teal underline"
        href={txUrl(fromChain, sourceTxId)}
        target="_blank"
        rel="noreferrer"
      >
        Source transaction
      </a>
      {payoutId ? (
        <a
          className="text-sm text-ocean-teal underline"
          href={txUrl(destinationTxId ? toChain : ARAMID_CHAIN.base, payoutId)}
          target="_blank"
          rel="noreferrer"
        >
          {destinationTxId ? `${destinationLabel} transaction` : "Base claim"}
        </a>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {step ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {STEP_LABEL[step]}
        </p>
      ) : !arrived ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking for the {destinationLabel} confirmation…
        </p>
      ) : null}
      {canClaim ? (
        <Button type="button" variant="outline" disabled={busy} onClick={onClaim}>
          Claim on Base
        </Button>
      ) : null}
      <Button
        type="button"
        className="h-11 rounded-xl bg-ocean-teal font-semibold text-white hover:bg-ocean-teal/90"
        disabled={busy}
        onClick={onBridgeAgain}
      >
        Bridge again
      </Button>
    </div>
  );
}

export function AramidBridgeSheet(props: AramidBridgeSheetProps) {
  const privy = usePrivyEasyStart();
  if (privy.configured && privy.authenticated) {
    return <AramidBridgeWithEvm {...props} />;
  }
  return <AramidBridgeForm {...props} />;
}

function AramidBridgeWithEvm(props: AramidBridgeSheetProps) {
  const { sendTransaction } = useSendTransaction();
  return (
    <AramidBridgeForm
      {...props}
      sendEvm={sendTransaction as EvmSendFn}
    />
  );
}

function AramidBridgeForm({
  open,
  onOpenChange,
  sendEvm,
}: AramidBridgeSheetProps & { sendEvm?: EvmSendFn }) {
  const privy = usePrivyEasyStart();
  const { activeAccount, signTransactions } = useWallet();
  const { currentNetwork } = useNetwork();
  const xchain = Boolean(privy.authenticated && privy.algorandAddress && !activeAccount);

  const walletChain: AramidChainKey | null =
    currentNetwork === "voi-mainnet"
      ? "voi"
      : currentNetwork === "algorand-mainnet"
        ? "algorand"
        : null;

  const [fromKey, setFromKey] = useState<AramidChainKey>(
    xchain ? "base" : walletChain ?? "algorand"
  );
  const [toKey, setToKey] = useState<AramidChainKey>(
    xchain ? "algorand" : walletChain === "voi" ? "algorand" : "voi"
  );
  const [routes, setRoutes] = useState<AramidRoute[]>([]);
  const [routeId, setRouteId] = useState("");
  const [amount, setAmount] = useState("");
  const [destination, setDestination] = useState("");
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<AramidBridgeStep | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sourceTxId, setSourceTxId] = useState<string | null>(null);
  const [claimTxId, setClaimTxId] = useState<string | null>(null);
  const [destinationTxId, setDestinationTxId] = useState<string | null>(null);

  const fromChain = chainIdOf(fromKey);
  const toChain = chainIdOf(toKey);
  const route = routes.find((row) => routeKey(row) === routeId) ?? routes[0] ?? null;

  const sender = xchain
    ? fromChain === ARAMID_CHAIN.base
      ? privy.evmAddress ?? ""
      : privy.algorandAddress ?? ""
    : activeAccount?.address ?? "";

  const autoDestination = useMemo(() => {
    if (xchain) {
      if (toChain === ARAMID_CHAIN.base) return privy.evmAddress ?? "";
      return privy.algorandAddress ?? "";
    }
    if (isAvmChain(toChain)) return activeAccount?.address ?? "";
    return "";
  }, [activeAccount?.address, privy.algorandAddress, privy.evmAddress, toChain, xchain]);

  useEffect(() => {
    if (!open) return;
    setDestination(autoDestination);
  }, [open, autoDestination]);

  useEffect(() => {
    if (!open) return;
    if (fromKey === toKey) {
      const next = CHAIN_KEYS.find((key) => key !== fromKey);
      if (next) setToKey(next);
    }
  }, [fromKey, open, toKey]);

  useEffect(() => {
    if (!open || fromChain === toChain) return;
    let cancelled = false;
    setLoadingRoutes(true);
    setRouteError(null);
    void loadAramidConfig()
      .then((config) => {
        if (cancelled) return;
        const next = listAramidRoutes(config, fromChain, toChain);
        setRoutes(next);
        setRouteId(next[0] ? routeKey(next[0]) : "");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setRoutes([]);
        setRouteError(
          err instanceof Error ? err.message : "Could not load bridge routes."
        );
      })
      .finally(() => {
        if (!cancelled) setLoadingRoutes(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fromChain, open, toChain]);

  const quote = useMemo(() => {
    if (!route || !amount.trim()) return null;
    try {
      const total = humanToBaseUnits(amount, route.sourceDecimals);
      const amounts = computeAramidAmounts({
        totalAmount: total,
        sourceDecimals: route.sourceDecimals,
        destinationDecimals: route.destinationDecimals,
        fee: route.fee,
        avmToAvm: isAvmChain(fromChain) && isAvmChain(toChain),
      });
      return {
        fee: baseUnitsToHuman(amounts.feeAmount, route.sourceDecimals),
        receive: baseUnitsToHuman(
          amounts.destinationAmount,
          route.destinationDecimals
        ),
        error: null as string | null,
      };
    } catch (err) {
      return {
        fee: "",
        receive: "",
        error: err instanceof Error ? err.message : "Enter a valid amount.",
      };
    }
  }, [amount, fromChain, route, toChain]);

  const destinationLocked = xchain && Boolean(autoDestination);
  const needsBaseAddress = toChain === ARAMID_CHAIN.base && !xchain;
  const sourceLocked = !xchain;

  const resetResult = () => {
    setError(null);
    setSourceTxId(null);
    setClaimTxId(null);
    setDestinationTxId(null);
    setStep(null);
  };

  const bridgeAgain = () => {
    resetResult();
    setAmount("");
  };

  const submit = async () => {
    if (!route || !sender) return;
    setBusy(true);
    setError(null);
    setSourceTxId(null);
    setClaimTxId(null);
    setDestinationTxId(null);
    try {
      if (
        xchain &&
        route.sourceChain === ARAMID_CHAIN.voi &&
        privy.evmAddress &&
        privy.getAccessToken
      ) {
        const accessToken = await privy.getAccessToken();
        if (!accessToken) throw new Error("Sign in again to bridge from Voi.");
        const sponsored = await requestEasyStartSponsor({
          accessToken,
          evmAddress: privy.evmAddress,
        });
        if (!isSponsorLegFunded(sponsored.voi)) {
          throw new Error(
            sponsored.voi?.error ||
              "Could not add VOI for the network fee. Try again in a moment."
          );
        }
      }
      const signAvm =
        xchain && privy.signTransactions
          ? privy.signTransactions
          : !xchain &&
              isAvmChain(fromChain) &&
              walletChain === fromKey &&
              signTransactions
            ? signTransactions
            : undefined;
      const resolvedDestination = destinationLocked ? autoDestination : destination;
      const result = await runAramidBridge({
        route,
        humanAmount: amount,
        sender,
        destinationAddress: resolvedDestination,
        signAvm,
        sendEvm: fromChain === ARAMID_CHAIN.base || toChain === ARAMID_CHAIN.base
          ? sendEvm
          : undefined,
        evmAddress: privy.evmAddress ?? undefined,
        canOptInAlgorand:
          xchain &&
          toChain === ARAMID_CHAIN.algorand &&
          resolvedDestination.trim() === (privy.algorandAddress ?? ""),
        onProgress: setStep,
      });
      setSourceTxId(result.sourceTxId);
      setClaimTxId(result.claimTxId ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bridge failed.");
    } finally {
      setBusy(false);
      setStep(null);
    }
  };

  useEffect(() => {
    if (!open || !sourceTxId || destinationTxId || !isAvmChain(toChain)) return;
    let cancelled = false;
    const look = () => {
      void findAramidDestinationConfirm({
        destinationChain: toChain,
        sourceTransactionId: sourceTxId,
      }).then((id) => {
        if (!cancelled && id) setDestinationTxId(id);
      });
    };
    look();
    const timer = window.setInterval(look, 8_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [destinationTxId, open, sourceTxId, toChain]);

  const claim = async () => {
    if (!sourceTxId || !sendEvm) return;
    setBusy(true);
    setError(null);
    try {
      const hash = await claimAramidOnBase({
        sourceTransactionId: sourceTxId,
        sendEvm,
        evmAddress: privy.evmAddress ?? undefined,
        onProgress: setStep,
      });
      if (!hash) {
        throw new Error(
          "The bridge has not published the claim yet. Try again in a minute."
        );
      }
      setClaimTxId(hash);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Claim failed.");
    } finally {
      setBusy(false);
      setStep(null);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && busy) return;
        if (!next) resetResult();
        onOpenChange(next);
      }}
    >
      <DialogContent
        className={EASY_START_FUNDING_DIALOG_CLASS}
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        <FundingSheetHeader
          title="Bridge"
          subtitle="Move assets between Base, Algorand, and Voi."
          icon={
            <span
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-ocean-teal/15 text-ocean-teal"
              aria-hidden
            >
              <Waypoints className="h-7 w-7" />
            </span>
          }
        />
        <div className="flex flex-col gap-3 px-6 pb-6">
          {sourceTxId ? (
            <BridgeResult
              fromChain={fromChain}
              toChain={toChain}
              sourceTxId={sourceTxId}
              claimTxId={claimTxId}
              destinationTxId={destinationTxId}
              receiveLabel={
                quote && !quote.error
                  ? `${quote.receive} ${route?.destinationSymbol ?? ""}`.trim()
                  : amount.trim()
              }
              busy={busy}
              error={error}
              step={step}
              canClaim={toChain === ARAMID_CHAIN.base && Boolean(sendEvm) && !claimTxId}
              onClaim={() => void claim()}
              onBridgeAgain={bridgeAgain}
            />
          ) : (
            <>
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              From
              <select
                className="h-10 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                value={fromKey}
                disabled={sourceLocked || busy}
                onChange={(event) => {
                  resetResult();
                  setFromKey(event.target.value as AramidChainKey);
                }}
              >
                {CHAIN_KEYS.filter((key) => xchain || key === walletChain).map(
                  (key) => (
                    <option key={key} value={key}>
                      {ARAMID_CHAIN_LABEL[chainIdOf(key)]}
                    </option>
                  )
                )}
              </select>
            </label>
            <button
              type="button"
              className="mb-1 rounded-full p-2 text-ocean-teal hover:bg-ocean-teal/10"
              aria-label="Swap direction"
              disabled={busy || sourceLocked}
              onClick={() => {
                resetResult();
                setFromKey(toKey);
                setToKey(fromKey);
              }}
            >
              <ArrowLeftRight className="h-4 w-4" />
            </button>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              To
              <select
                className="h-10 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                value={toKey}
                disabled={busy}
                onChange={(event) => {
                  resetResult();
                  setToKey(event.target.value as AramidChainKey);
                }}
              >
                {CHAIN_KEYS.filter((key) => key !== fromKey).map((key) => (
                  <option key={key} value={key}>
                    {ARAMID_CHAIN_LABEL[chainIdOf(key)]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Asset
            <select
              className="h-10 rounded-md border border-input bg-background px-2 text-sm text-foreground"
              value={route ? routeKey(route) : ""}
              disabled={busy || loadingRoutes || routes.length === 0}
              onChange={(event) => {
                resetResult();
                setRouteId(event.target.value);
              }}
            >
              {routes.map((row) => (
                <option key={routeKey(row)} value={routeKey(row)}>
                  {row.sourceName} → {row.destinationName}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Amount
            <Input
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              disabled={busy}
              onChange={(event) => {
                resetResult();
                setAmount(event.target.value);
              }}
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {needsBaseAddress ? "Base address" : "Receiving address"}
            <Input
              value={destinationLocked ? autoDestination : destination}
              disabled={busy || destinationLocked}
              placeholder={needsBaseAddress ? "0x…" : "Receiving address"}
              onChange={(event) => {
                resetResult();
                setDestination(event.target.value);
              }}
            />
          </label>
          {needsBaseAddress ? (
            <p className="text-xs text-muted-foreground">
              This wallet signs Algorand and Voi. Paste a Base address you
              control. You will claim the funds with that Base wallet.
            </p>
          ) : null}

          {quote?.error ? (
            <p className="text-sm text-destructive" role="alert">
              {quote.error}
            </p>
          ) : quote ? (
            <p className="text-sm text-muted-foreground">
              Fee {quote.fee} {route?.sourceSymbol}. You receive about{" "}
              {quote.receive} {route?.destinationSymbol}.
            </p>
          ) : null}
          {routeError ? (
            <p className="text-sm text-destructive" role="alert">
              {routeError}
            </p>
          ) : null}
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          {step ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {STEP_LABEL[step]}
            </p>
          ) : null}

            <Button
              type="button"
              className="h-11 rounded-xl bg-ocean-teal font-semibold text-white hover:bg-ocean-teal/90"
              disabled={
                busy ||
                !route ||
                !amount.trim() ||
                Boolean(quote?.error) ||
                !(destinationLocked ? autoDestination : destination.trim()) ||
                !sender
              }
              onClick={() => void submit()}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Bridge"
              )}
            </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
