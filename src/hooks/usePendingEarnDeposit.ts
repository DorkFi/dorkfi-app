import { useEffect, useMemo, useSyncExternalStore } from "react";
import { usePrivyEasyStart } from "@/contexts/privyEasyStartContext";
import {
  mergePendingEarnDeposits,
  readPendingEarnDeposit,
  savePendingEarnDeposit,
  subscribePendingEarnDeposit,
  type PendingEarnDeposit,
} from "@/lib/easyStart/pendingEarnDeposit";
import {
  deleteRemotePendingEarnDeposit,
  fetchRemotePendingEarnDeposit,
  putRemotePendingEarnDeposit,
} from "@/lib/easyStart/pendingEarnDepositApi";

function snapshotFor(address?: string | null): string {
  const job = readPendingEarnDeposit(address);
  return job ? JSON.stringify(job) : "";
}

/** Current-browser pending Deposit to Earn, keyed by Algorand address. */
export function usePendingEarnDeposit(
  algorandAddress?: string | null
): PendingEarnDeposit | null {
  const snapshot = useSyncExternalStore(
    subscribePendingEarnDeposit,
    () => snapshotFor(algorandAddress),
    () => ""
  );
  return useMemo((): PendingEarnDeposit | null => {
    if (!snapshot) return null;
    try {
      return JSON.parse(snapshot) as PendingEarnDeposit;
    } catch {
      return null;
    }
  }, [snapshot]);
}

/**
 * On Easy Start login, pull the server job and merge with localStorage so a
 * second device can finish supply. Pushes local changes while signed in.
 */
export function useSyncPendingEarnDeposit(): void {
  const { authenticated, algorandAddress, getAccessToken } = usePrivyEasyStart();

  useEffect(() => {
    if (!authenticated || !algorandAddress || !getAccessToken) return;
    let cancelled = false;
    let inflight = false;
    let queued = false;

    const push = () => {
      if (inflight) {
        queued = true;
        return;
      }
      inflight = true;
      void (async () => {
        try {
          const token = await getAccessToken();
          if (!token || cancelled) return;
          const job = readPendingEarnDeposit(algorandAddress);
          if (job) {
            await putRemotePendingEarnDeposit(token, job);
          } else {
            await deleteRemotePendingEarnDeposit(token);
          }
        } catch (error) {
          console.warn("[Easy Start] pending deposit push", error);
        } finally {
          inflight = false;
          if (queued && !cancelled) {
            queued = false;
            push();
          }
        }
      })();
    };

    void (async () => {
      try {
        const token = await getAccessToken();
        if (!token || cancelled) return;
        const remote = await fetchRemotePendingEarnDeposit(token);
        if (cancelled) return;
        const remoteForWallet =
          remote &&
          remote.algorandAddress.toUpperCase() ===
            algorandAddress.trim().toUpperCase()
            ? remote
            : null;
        const local = readPendingEarnDeposit(algorandAddress);
        const merged = mergePendingEarnDeposits(local, remoteForWallet);
        if (merged) {
          savePendingEarnDeposit(merged);
        }
      } catch (error) {
        console.warn("[Easy Start] pending deposit sync", error);
      }
    })();

    const unsub = subscribePendingEarnDeposit(push);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [authenticated, algorandAddress, getAccessToken]);
}
