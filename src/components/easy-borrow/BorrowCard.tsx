import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@txnlab/use-wallet-react";
import { ChevronDown, Info } from "lucide-react";
import { useNetwork } from "@/contexts/NetworkContext";
import type { NetworkId } from "@/config";
import {
  easyBorrowUiConfigKey,
  listBorrowAssetOptionsForCollateral,
  listCollateralConfigKeys,
  listCollateralMarketRefs,
  resolveBorrowRoute,
  resolveBorrowRoutes,
} from "@/services/borrowRouteResolver";
import type { BorrowRoute } from "@/types/easyBorrow";
import {
  useEasyBorrowQuote,
  type CollateralSource,
} from "@/hooks/useEasyBorrowQuote";
import { previewHealthBand } from "@/utils/easyBorrowMath";
import { formatUsdAmount } from "@/lib/utils";
import DorkFiButton from "@/components/ui/DorkFiButton";
import WalletModal from "@/components/WalletModal";
import AssetSelector, {
  type AssetSelectorOption,
} from "@/components/easy-borrow/AssetSelector";
import BorrowSlider from "@/components/easy-borrow/BorrowSlider";
import HealthPreview from "@/components/easy-borrow/HealthPreview";
import BorrowSummary from "@/components/easy-borrow/BorrowSummary";
import RatesPanel from "@/components/easy-borrow/RatesPanel";

function formatToken(n: number | null | undefined, digits = 4): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function formatApr(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (Math.abs(n) < 0.01) return "<0.01%";
  return `${n.toFixed(2)}%`;
}

type CtaState =
  | "connect"
  | "enter_amount"
  | "insufficient_balance"
  | "limit_exceeded"
  | "insufficient_liquidity"
  | "too_risky"
  | "review"
  | "supply_borrow"
  | "borrow";

const BorrowCard = () => {
  const { currentNetwork } = useNetwork();
  const networkId = currentNetwork as NetworkId;
  const { activeAccount } = useWallet();
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);

  const collateralKeys = useMemo(
    () => listCollateralConfigKeys(networkId),
    [networkId]
  );

  const [collateralKey, setCollateralKey] = useState<string>(
    () => (collateralKeys.includes("ALGO") ? "ALGO" : collateralKeys[0] ?? "")
  );
  const [borrowUiKey, setBorrowUiKey] = useState("WAD");
  const [collateralAmount, setCollateralAmount] = useState("");
  const [borrowAmount, setBorrowAmount] = useState("");
  const [collateralSource, setCollateralSource] =
    useState<CollateralSource>("wallet");

  const borrowOptions = useMemo(
    () =>
      collateralKey
        ? listBorrowAssetOptionsForCollateral(networkId, collateralKey)
        : [],
    [networkId, collateralKey]
  );

  const selectedBorrowOption =
    borrowOptions.find((o) => o.uiKey === borrowUiKey) ??
    borrowOptions[0] ??
    null;

  const effectiveBorrowUiKey = selectedBorrowOption?.uiKey ?? "";
  const effectiveBorrowKey = selectedBorrowOption?.borrowConfigKey ?? "";

  const route: BorrowRoute | null = useMemo(() => {
    if (!collateralKey || !selectedBorrowOption) return null;
    return resolveBorrowRoute({
      networkId,
      collateralConfigKey: collateralKey,
      borrowConfigKey: selectedBorrowOption.borrowConfigKey,
      preferredPoolIds: selectedBorrowOption.preferredPoolIds,
    });
  }, [networkId, collateralKey, selectedBorrowOption]);

  const alternateRoutes = useMemo(() => {
    if (!collateralKey || !selectedBorrowOption) return [];
    return resolveBorrowRoutes({
      networkId,
      collateralConfigKey: collateralKey,
      borrowConfigKey: selectedBorrowOption.borrowConfigKey,
      preferredPoolIds: selectedBorrowOption.preferredPoolIds,
    });
  }, [networkId, collateralKey, selectedBorrowOption]);
  const quote = useEasyBorrowQuote({
    networkId,
    route,
    collateralAmount:
      collateralSource === "wallet" ? collateralAmount : "0",
    borrowAmount,
    collateralSource,
  });

  // Prefer existing DorkFi collateral when the user already has a deposit.
  useEffect(() => {
    if (
      quote.existingDeposit != null &&
      quote.existingDeposit > 0 &&
      (quote.poolGlobal?.totalCollateralValue ?? 0) > 0
    ) {
      setCollateralSource((prev) => (prev === "wallet" ? "existing" : prev));
    }
  }, [quote.existingDeposit, quote.poolGlobal?.totalCollateralValue]);

  const collateralOptions: AssetSelectorOption[] = useMemo(() => {
    const refs = listCollateralMarketRefs(networkId);
    const byKey = new Map<string, AssetSelectorOption>();
    for (const ref of refs) {
      const uiKey = easyBorrowUiConfigKey(networkId, ref.configKey, ref.poolId);
      const marketLabel =
        ref.poolId === route?.poolId ? route.marketLabel : "…";
      const existing = byKey.get(uiKey);
      if (existing) {
        existing.subtitle = `${existing.subtitle ?? ""}, ${marketLabel}`.replace(
          /^, /,
          ""
        );
        continue;
      }
      byKey.set(uiKey, {
        configKey: uiKey,
        symbol: ref.symbol,
        logoPath: ref.logoPath,
        balance: uiKey === collateralKey ? quote.walletBalance : null,
        balanceUsd:
          uiKey === collateralKey &&
          quote.walletBalance != null &&
          quote.collateralPrice != null
            ? quote.walletBalance * quote.collateralPrice
            : null,
        subtitle: `→ ${listBorrowAssetOptionsForCollateral(networkId, uiKey)
          .map((o) => o.symbol)
          .join(" / ")}`,
      });
    }
    return [...byKey.values()].sort((a, b) =>
      a.symbol.localeCompare(b.symbol)
    );
  }, [
    networkId,
    collateralKey,
    quote.walletBalance,
    quote.collateralPrice,
    route?.poolId,
    route?.marketLabel,
  ]);

  const borrowAssetOptions: AssetSelectorOption[] = useMemo(
    () =>
      borrowOptions.map((option) => ({
        configKey: option.uiKey,
        symbol: option.symbol,
        logoPath: option.logoPath,
        balance: null,
        balanceUsd: null,
        subtitle: option.subtitle,
      })),
    [borrowOptions]
  );

  const available = quote.availableToBorrow;
  const borrowNum = parseFloat(borrowAmount) || 0;
  const collateralNum = parseFloat(collateralAmount) || 0;
  const healthBand = previewHealthBand(quote.healthAfter);

  const collateralUsdForLtv = (() => {
    if (collateralSource === "existing") {
      return Math.max(0, quote.collateralUsd);
    }
    const existing = quote.poolGlobal?.totalCollateralValue ?? 0;
    return Math.max(0, existing + quote.collateralUsd);
  })();

  const existingBorrowUsd = quote.poolGlobal?.totalBorrowValue ?? 0;
  const borrowUsdForLtv = Math.max(0, existingBorrowUsd + quote.borrowUsd);
  const ltvPercent =
    collateralUsdForLtv > 0
      ? (borrowUsdForLtv / collateralUsdForLtv) * 100
      : 0;

  const maxLtvPercent =
    quote.collateralFactor != null && Number.isFinite(quote.collateralFactor)
      ? quote.collateralFactor * 100
      : 0;
  const liquidationPercent =
    quote.liquidationThreshold != null &&
    Number.isFinite(quote.liquidationThreshold)
      ? quote.liquidationThreshold * 100
      : 0;

  const setBorrowFromNumber = (n: number) => {
    if (!Number.isFinite(n) || n <= 0) {
      setBorrowAmount("");
      return;
    }
    const d = Math.min(route?.borrow.decimals ?? 6, 6);
    setBorrowAmount(n.toFixed(d).replace(/\.?0+$/, ""));
  };

  const setBorrowFromLtv = (nextLtv: number) => {
    if (
      collateralUsdForLtv <= 0 ||
      quote.borrowPrice == null ||
      quote.borrowPrice <= 0
    ) {
      return;
    }
    const capped =
      maxLtvPercent > 0 ? Math.min(nextLtv, maxLtvPercent) : Math.max(0, nextLtv);
    const targetBorrowUsd = (collateralUsdForLtv * capped) / 100;
    const incrementalUsd = Math.max(0, targetBorrowUsd - existingBorrowUsd);
    const tokens = incrementalUsd / quote.borrowPrice;
    const limited =
      available > 0 ? Math.min(tokens, available) : tokens;
    setBorrowFromNumber(limited);
  };

  const ctaState: CtaState = (() => {
    if (!activeAccount) return "connect";
    if (!route) return "enter_amount";
    if (
      collateralSource === "wallet" &&
      collateralNum <= 0 &&
      !(quote.existingDeposit && quote.existingDeposit > 0 && borrowNum > 0)
    ) {
      if (borrowNum <= 0) return "enter_amount";
    }
    if (borrowNum <= 0) return "enter_amount";
    if (
      collateralSource === "wallet" &&
      quote.walletBalance != null &&
      collateralNum > quote.walletBalance + 1e-12
    ) {
      return "insufficient_balance";
    }
    if (available > 0 && borrowNum > available + 1e-12) {
      return "limit_exceeded";
    }
    if (
      quote.availableLiquidity != null &&
      borrowNum > quote.availableLiquidity + 1e-12
    ) {
      return "insufficient_liquidity";
    }
    if (healthBand === "blocked") return "too_risky";
    if (collateralSource === "wallet" && collateralNum > 0) {
      return "supply_borrow";
    }
    return "borrow";
  })();

  const ctaLabel: Record<CtaState, string> = {
    connect: "Connect Wallet",
    enter_amount: "Enter Amount",
    insufficient_balance: "Insufficient Balance",
    limit_exceeded: "Borrow Limit Exceeded",
    insufficient_liquidity: "Insufficient Liquidity",
    too_risky: "Position Too Risky",
    review: "Review Borrow",
    supply_borrow: "Supply & Borrow",
    borrow: "Borrow",
  };

  const ctaDisabled =
    ctaState !== "connect" &&
    ctaState !== "supply_borrow" &&
    ctaState !== "borrow" &&
    ctaState !== "review";

  const hasExisting =
    quote.existingDeposit != null && quote.existingDeposit > 0;

  const borrowHint = (() => {
    if (!route) return undefined;
    if (route.isExplicitLpWadRoute) {
      return (
        <>
          Borrow {route.borrow.symbol} via LP market.{" "}
          <span className="text-ocean-teal">Learn more</span>
        </>
      );
    }
    if (route.mechanism === "wad_mint_via_borrow") {
      return (
        <>
          Borrow {route.borrow.symbol} via mint route.{" "}
          <span className="text-ocean-teal">Learn more</span>
        </>
      );
    }
    return (
      <>
        Borrow {route.borrow.symbol} on {route.marketLabel}.{" "}
        <span className="text-ocean-teal">Learn more</span>
      </>
    );
  })();

  return (
    <section className="w-full max-w-5xl mx-auto space-y-5">
      {hasExisting ? (
        <div className="rounded-xl border border-border/60 bg-card p-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Collateral source
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setCollateralSource("existing")}
              className={`rounded-lg border px-3 py-2 text-left text-sm ${
                collateralSource === "existing"
                  ? "border-ocean-teal bg-ocean-teal/10"
                  : "border-border"
              }`}
            >
              <div className="font-medium">Existing DorkFi collateral</div>
              <div className="text-xs text-muted-foreground">
                {formatToken(quote.existingDeposit)} {route?.collateral.symbol}{" "}
                supplied
              </div>
            </button>
            <button
              type="button"
              onClick={() => setCollateralSource("wallet")}
              className={`rounded-lg border px-3 py-2 text-left text-sm ${
                collateralSource === "wallet"
                  ? "border-ocean-teal bg-ocean-teal/10"
                  : "border-border"
              }`}
            >
              <div className="font-medium">Add from wallet</div>
              <div className="text-xs text-muted-foreground">
                Balance {formatToken(quote.walletBalance)}{" "}
                {route?.collateral.symbol}
              </div>
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-stretch">
        <div className="space-y-4 min-w-0">
          <div className="grid gap-4 sm:grid-cols-2">
            <AssetSelector
              card
              label="Supply"
              headerAction={
                <div className="flex items-center gap-2">
                  <span
                    className="text-muted-foreground"
                    title="Assets you supply become collateral for this borrow."
                  >
                    <Info className="size-4" />
                  </span>
                  {collateralSource === "existing" ? (
                    <button
                      type="button"
                      onClick={() => setCollateralSource("wallet")}
                      className="text-xs font-semibold text-ocean-teal hover:underline"
                    >
                      Add more +
                    </button>
                  ) : quote.walletBalance != null && quote.walletBalance > 0 ? (
                    <button
                      type="button"
                      onClick={() =>
                        setCollateralAmount(String(quote.walletBalance))
                      }
                      className="text-xs font-semibold text-ocean-teal hover:underline"
                    >
                      Add more +
                    </button>
                  ) : null}
                </div>
              }
              options={collateralOptions}
              value={collateralKey}
              onChange={(key) => {
                setCollateralKey(key);
                setCollateralAmount("");
                setBorrowAmount("");
              }}
              amount={
                collateralSource === "existing"
                  ? quote.existingDeposit != null &&
                    Number.isFinite(quote.existingDeposit)
                    ? String(quote.existingDeposit)
                    : ""
                  : collateralAmount
              }
              onAmountChange={setCollateralAmount}
              amountUsd={
                collateralSource === "existing"
                  ? quote.collateralUsd
                  : quote.collateralPrice != null && collateralNum > 0
                    ? collateralNum * quote.collateralPrice
                    : null
              }
              amountDisabled={collateralSource === "existing"}
              footer={
                collateralSource === "wallet" ? (
                  <span>
                    Wallet balance: {formatToken(quote.walletBalance)}{" "}
                    {route?.collateral.symbol}
                    {quote.walletBalance != null && quote.collateralPrice != null
                      ? ` · ${formatUsdAmount(quote.walletBalance * quote.collateralPrice)}`
                      : ""}
                  </span>
                ) : (
                  <span>
                    Using existing position
                    {quote.poolGlobal
                      ? ` · pool collateral ${formatUsdAmount(quote.poolGlobal.totalCollateralValue)}`
                      : ""}
                  </span>
                )
              }
            />

            <AssetSelector
              card
              label="Borrow"
              options={borrowAssetOptions}
              value={effectiveBorrowUiKey}
              onChange={(key) => {
                setBorrowUiKey(key);
                setBorrowAmount("");
              }}
              amount={borrowAmount}
              onAmountChange={setBorrowAmount}
              amountUsd={quote.borrowUsd > 0 ? quote.borrowUsd : null}
              footer={
                <span>
                  Available to borrow: {formatToken(available)}{" "}
                  {route?.borrow.symbol}
                  {available > 0 && quote.borrowPrice != null
                    ? ` · ${formatUsdAmount(available * quote.borrowPrice)}`
                    : ""}
                </span>
              }
            />
          </div>

          <BorrowSlider
            ltvPercent={ltvPercent}
            maxLtvPercent={maxLtvPercent}
            liquidationPercent={liquidationPercent}
            onChange={setBorrowFromLtv}
            disabled={
              !route ||
              collateralUsdForLtv <= 0 ||
              quote.borrowPrice == null ||
              quote.borrowPrice <= 0
            }
          />

          {route && (borrowNum > 0 || collateralNum > 0) ? (
            <HealthPreview before={quote.healthBefore} after={quote.healthAfter} />
          ) : null}
        </div>

        <RatesPanel
          borrow={{
            symbol: route?.borrow.symbol ?? selectedBorrowOption?.symbol ?? "—",
            rateLabel: formatApr(quote.borrowAprPercent),
          }}
          supply={{
            symbol: route?.collateral.symbol ?? collateralKey ?? "—",
            logoPath: route?.collateral.logoPath,
            rateLabel: formatApr(quote.supplyAprPercent),
          }}
          borrowHint={borrowHint}
        />
      </div>

      {route ? (
        <BorrowSummary
          route={route}
          collateralAmount={
            collateralSource === "existing"
              ? String(quote.existingDeposit ?? 0)
              : collateralAmount
          }
          borrowAmount={borrowAmount}
          quote={quote}
        />
      ) : (
        <p className="text-sm text-destructive">
          No WAD/USDC borrow route for this collateral on the current network.
        </p>
      )}

      <button
        type="button"
        className="flex w-full items-center justify-between text-sm text-muted-foreground hover:text-foreground"
        onClick={() => setReviewOpen((v) => !v)}
      >
        Review transaction
        <ChevronDown
          className={`size-4 transition-transform ${reviewOpen ? "rotate-180" : ""}`}
        />
      </button>
      {reviewOpen && route ? (
        <dl className="space-y-1.5 rounded-xl border border-border/50 p-3 text-xs">
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Network</dt>
            <dd>{networkId}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Market</dt>
            <dd>
              {route.marketLabel} · {route.collateral.symbol}/{route.borrow.symbol}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Market type</dt>
            <dd>
              {route.isExplicitLpWadRoute
                ? "LP pool"
                : route.mechanism === "wad_mint_via_borrow"
                  ? "WAD mint (A)"
                  : "Lending pool"}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Collateral factor</dt>
            <dd>
              {quote.collateralFactor != null
                ? `${(quote.collateralFactor * 100).toFixed(1)}%`
                : "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Liquidation threshold</dt>
            <dd>
              {quote.liquidationThreshold != null
                ? `${(quote.liquidationThreshold * 100).toFixed(1)}%`
                : "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">LTV</dt>
            <dd>{ltvPercent.toFixed(2)}%</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Transactions</dt>
            <dd>
              {collateralSource === "wallet" && collateralNum > 0
                ? "Supply then borrow"
                : "Borrow"}
            </dd>
          </div>
          {alternateRoutes.length > 1 ? (
            <div className="pt-1 text-muted-foreground">
              {alternateRoutes.length} matching markets — using{" "}
              {route.marketLabel} by default
            </div>
          ) : null}
        </dl>
      ) : null}

      <button
        type="button"
        className="flex w-full items-center justify-between text-sm text-muted-foreground hover:text-foreground"
        onClick={() => setAdvancedOpen((v) => !v)}
      >
        Advanced details
        <ChevronDown
          className={`size-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`}
        />
      </button>
      {advancedOpen && route ? (
        <dl className="space-y-1.5 rounded-xl border border-border/50 p-3 text-xs">
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Pool ID</dt>
            <dd className="font-mono">{route.poolId}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Collateral contract</dt>
            <dd className="font-mono">{route.collateral.contractId}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Borrow contract</dt>
            <dd className="font-mono">{route.borrow.contractId}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Supply cap</dt>
            <dd>{formatToken(quote.supplyCapHuman)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Borrow cap</dt>
            <dd>{formatToken(quote.borrowCapHuman)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Oracle (collateral)</dt>
            <dd>
              {quote.collateralPrice != null
                ? formatUsdAmount(quote.collateralPrice)
                : "—"}
            </dd>
          </div>
        </dl>
      ) : null}

      <DorkFiButton
        className="w-full h-12 sticky bottom-0"
        disabled={ctaDisabled && ctaState !== "connect"}
        onClick={() => {
          if (ctaState === "connect") {
            setWalletModalOpen(true);
            return;
          }
          // Signing orchestration lands in the next increment.
          setReviewOpen(true);
        }}
      >
        {ctaLabel[ctaState]}
      </DorkFiButton>

      {quote.isLoading ? (
        <p className="text-center text-xs text-muted-foreground">
          Loading market data…
        </p>
      ) : quote.error ? (
        <p className="text-center text-xs text-destructive">{quote.error}</p>
      ) : null}

      <WalletModal
        isOpen={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
      />
    </section>
  );
};

export default BorrowCard;
