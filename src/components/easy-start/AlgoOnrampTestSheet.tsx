import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  createWaasWalletAccounts,
  getChainsMissingWaasWalletAccounts,
} from "@dynamic-labs-sdk/client/waas";
import { useGetWalletAccounts } from "@dynamic-labs-sdk/react-hooks";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePrivyEasyStart } from "@/contexts/privyEasyStartContext";
import { deriveAlgorandAddressFromSolana } from "@/lib/easyStart/algorandFromSolana";
import { fetchAlgorandAlgoTotal } from "@/lib/easyStart/baseBalances";
import { createCoinbaseSession } from "@/lib/easyStart/offrampApi";
import { EASY_START_FUNDING_DIALOG_CLASS } from "@/components/easy-start/EasyStartFundingUi";

/** First ALGO credit has to cover the protocol account minimum. */
const ACCOUNT_OPEN_MICRO = 100_000n;

function algoOnrampTestRequested(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("algoOnramp") === "1";
}

function useAlgoOnrampTestRequested(): boolean {
  const [on, setOn] = useState(algoOnrampTestRequested);
  useEffect(() => {
    const sync = () => setOn(algoOnrampTestRequested());
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  return on;
}

function shortAddress(address: string): string {
  if (address.length <= 14) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/**
 * Dev test: Dynamic Solana key → Algorand address → Coinbase ALGO buy.
 * Open any page with `?algoOnramp=1`. Does not replace the Base USDC deposit.
 */
export function AlgoOnrampTestSheet() {
  const requested = useAlgoOnrampTestRequested();
  const [dismissed, setDismissed] = useState(false);
  const { authenticated, login, getAccessToken, blockReason } =
    usePrivyEasyStart();
  const { data: accounts = [] } = useGetWalletAccounts();
  const [creating, setCreating] = useState(false);
  const [opening, setOpening] = useState<"buy" | "send" | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState("20");
  const [waiting, setWaiting] = useState(false);
  const [baseline, setBaseline] = useState<bigint | null>(null);

  const solanaAccount = useMemo(
    () => accounts.find((account) => account.chain === "SOL") ?? null,
    [accounts]
  );
  const solanaAddress = solanaAccount?.address ?? null;
  const algorandAddress = useMemo(() => {
    if (!solanaAddress) return null;
    try {
      return deriveAlgorandAddressFromSolana(solanaAddress);
    } catch {
      return null;
    }
  }, [solanaAddress]);
  const deriveError =
    solanaAddress && !algorandAddress
      ? "This Solana address could not be turned into an Algorand address."
      : null;

  const balanceQuery = useQuery({
    queryKey: ["algo-onramp-test-balance", algorandAddress],
    queryFn: () => fetchAlgorandAlgoTotal(algorandAddress!),
    enabled: Boolean(algorandAddress && requested && !dismissed),
    refetchInterval: waiting ? 4_000 : 15_000,
  });

  const totalMicro = balanceQuery.data?.totalMicro ?? 0n;
  const arrived =
    waiting &&
    baseline != null &&
    totalMicro >= baseline + ACCOUNT_OPEN_MICRO;

  const prepareWallet = async () => {
    setError(null);
    setCreating(true);
    try {
      const missing = getChainsMissingWaasWalletAccounts();
      if (!missing.includes("SOL")) {
        throw new Error(
          "Solana embedded wallets are not enabled in this Dynamic environment."
        );
      }
      await createWaasWalletAccounts({ chains: ["SOL"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  };

  const watchForArrival = () => {
    setBaseline(balanceQuery.data?.totalMicro ?? 0n);
    setWaiting(true);
  };

  const openCoinbase = async (experience: "buy" | "send") => {
    if (!algorandAddress || !solanaAddress || !getAccessToken) return;
    setError(null);
    setOpening(experience);
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error("Sign in to open Coinbase.");
      watchForArrival();
      const session = await createCoinbaseSession({
        address: algorandAddress,
        solanaAddress,
        accessToken,
        amount: experience === "buy" ? amount : undefined,
        destination: "algorand",
      });
      const url = experience === "send" ? session.sendUrl : session.buyUrl;
      if (!url) {
        throw new Error(
          experience === "send"
            ? "Coinbase transfer URL missing. Restart the dev server."
            : "Coinbase did not return a buy URL."
        );
      }
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setOpening(null);
    }
  };

  const copyAddress = async () => {
    if (!algorandAddress) return;
    setError(null);
    try {
      await navigator.clipboard.writeText(algorandAddress);
      setCopied(true);
      watchForArrival();
    } catch {
      setError("Couldn’t copy the address. Select it and copy it manually.");
    }
  };

  if (!requested || dismissed) return null;

  return (
    <Dialog open onOpenChange={(next) => { if (!next) setDismissed(true); }}>
      <DialogContent className={EASY_START_FUNDING_DIALOG_CLASS}>
        <div className="px-6 pt-6 pb-6 space-y-4">
          <DialogHeader className="space-y-2 text-left">
            <DialogTitle>Test ALGO on-ramp</DialogTitle>
            <DialogDescription>
              Fund an Algorand account derived from a Dynamic Solana wallet.
              Buy ALGO, transfer it from Coinbase, or send it from another
              wallet. The Base USDC deposit is unchanged.
            </DialogDescription>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            Algorand locks 0.1 ALGO to open the account. That ALGO stays in the
            wallet until the account is closed. It is not a DorkFi fee. Each
            asset you opt into later locks about another 0.1 ALGO.
          </p>

          {blockReason ? (
            <p className="text-sm text-destructive" role="alert">
              {blockReason}
            </p>
          ) : null}
          {error || deriveError ? (
            <p className="text-sm text-destructive" role="alert">
              {error || deriveError}
            </p>
          ) : null}

          {!authenticated ? (
            <Button className="w-full" onClick={() => login?.()}>
              Sign in
            </Button>
          ) : !solanaAddress ? (
            <Button
              className="w-full"
              disabled={creating}
              onClick={() => void prepareWallet()}
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Create Algorand wallet"
              )}
            </Button>
          ) : (
            <>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Solana key</dt>
                  <dd className="font-mono" title={solanaAddress}>
                    {shortAddress(solanaAddress)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Algorand</dt>
                  <dd className="font-mono" title={algorandAddress ?? ""}>
                    {algorandAddress ? shortAddress(algorandAddress) : "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">ALGO balance</dt>
                  <dd>
                    {balanceQuery.isLoading
                      ? "Checking…"
                      : balanceQuery.data?.exists
                        ? `${balanceQuery.data.formatted} ALGO`
                        : "Account not created yet"}
                  </dd>
                </div>
              </dl>

              {arrived ? (
                <p className="text-sm text-ocean-teal">
                  ALGO arrived. The account is open. Swapping to other assets
                  is not part of this test.
                </p>
              ) : (
                <>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Send ALGO on Algorand mainnet from any wallet. At least
                      0.1 ALGO opens the account.
                    </p>
                    <input
                      readOnly
                      className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs"
                      value={algorandAddress ?? ""}
                      onFocus={(event) => event.currentTarget.select()}
                    />
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => void copyAddress()}
                    >
                      {copied ? "Address copied" : "Copy Algorand address"}
                    </Button>
                  </div>
                  <label className="block text-sm space-y-1">
                    <span className="text-muted-foreground">
                      Buy amount (USD)
                    </span>
                    <input
                      className="w-full rounded-md border border-border bg-background px-3 py-2"
                      inputMode="decimal"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                    />
                  </label>
                  <Button
                    className="w-full"
                    disabled={opening != null || !algorandAddress}
                    onClick={() => void openCoinbase("buy")}
                  >
                    {opening === "buy" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Buy ALGO with Coinbase"
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={opening != null || !algorandAddress}
                    onClick={() => void openCoinbase("send")}
                  >
                    {opening === "send" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Transfer ALGO from Coinbase"
                    )}
                  </Button>
                  {waiting ? (
                    <p className="text-sm text-muted-foreground text-center">
                      This sheet watches the Algorand balance. A Coinbase
                      transfer has to be ALGO you already hold.
                    </p>
                  ) : null}
                </>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Shown when `?algoOnramp=1` is set but Easy Start / Dynamic is not running. */
export function AlgoOnrampTestUnavailable() {
  const requested = useAlgoOnrampTestRequested();
  const { blockReason } = usePrivyEasyStart();
  const [dismissed, setDismissed] = useState(false);
  if (!requested || dismissed) return null;
  return (
    <Dialog open onOpenChange={(next) => { if (!next) setDismissed(true); }}>
      <DialogContent className={EASY_START_FUNDING_DIALOG_CLASS}>
        <div className="px-6 pt-6 pb-6 space-y-3">
          <DialogHeader className="space-y-2 text-left">
            <DialogTitle>Test ALGO on-ramp</DialogTitle>
            <DialogDescription>
              Easy Start has to be running before this test can create a
              wallet.
            </DialogDescription>
          </DialogHeader>
          {blockReason ? (
            <p className="text-sm text-muted-foreground">{blockReason}</p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
