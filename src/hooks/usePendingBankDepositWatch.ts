import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { fetchBaseUsdcBalance } from "@/lib/easyStart/baseBalances";
import {
  BANK_DEPOSIT_POLL_MS,
  readPendingBankDeposit,
  shouldPromptBankDepositArrival,
  type PendingBankDeposit,
} from "@/lib/easyStart/pendingBankDeposit";

/**
 * Poll Base USDC for a saved bank deposit while Add money is closed.
 * The sheet unmounts on close, so this watch has to live on the provider.
 */
export function usePendingBankDepositWatch(args: {
  enabled: boolean;
  sheetOpen: boolean;
  address: string | null;
  onArrive: (job: PendingBankDeposit) => void;
}): { markPrompted: () => void } {
  const { enabled, sheetOpen, address, onArrive } = args;
  const [job, setJob] = useState<PendingBankDeposit | null>(null);
  const promptedAt = useRef<number | null>(null);
  const onArriveRef = useRef(onArrive);
  onArriveRef.current = onArrive;
  const jobRef = useRef(job);
  jobRef.current = job;

  useEffect(() => {
    if (!enabled) {
      setJob(null);
      return;
    }
    setJob(readPendingBankDeposit(address));
  }, [enabled, sheetOpen, address]);

  const watching = Boolean(enabled && address && job && !sheetOpen);

  const { data } = useQuery({
    queryKey: ["easy-start-base-usdc", address],
    queryFn: () => fetchBaseUsdcBalance(address as Address),
    enabled: watching,
    refetchInterval: watching ? BANK_DEPOSIT_POLL_MS : false,
    refetchOnWindowFocus: true,
  });

  const currentUsdc = data ? Number.parseFloat(data.formatted) : Number.NaN;

  useEffect(() => {
    if (
      !shouldPromptBankDepositArrival({
        job,
        sheetOpen,
        currentUsdc,
        alreadyPromptedAt: promptedAt.current,
      })
    ) {
      return;
    }
    promptedAt.current = job!.at;
    onArriveRef.current(job!);
  }, [job, sheetOpen, currentUsdc]);

  const markPrompted = useCallback(() => {
    const current = jobRef.current ?? readPendingBankDeposit(address);
    if (!current) return;
    promptedAt.current = current.at;
    jobRef.current = current;
  }, [address]);

  return { markPrompted };
}
