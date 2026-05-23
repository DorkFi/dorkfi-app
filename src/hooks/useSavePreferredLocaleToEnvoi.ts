import { useState, useCallback } from "react";
import { useNetwork } from "@/contexts/NetworkContext";
import { useWallet } from "@txnlab/use-wallet-react";
import { useAddressName } from "@/hooks/useAddressName";
import { getEffectiveLocale } from "@/utils/localeSettings";
import { ResolverService } from "@/services/resolverService";
import algorandService from "@/services/algorandService";
import { getAlgorandNetworkFromNetworkId } from "@/config";
import { waitForConfirmation } from "algosdk";

/** ENVIP preferred_locale key (Envoi/VIP17 text record). */
export const PREFERRED_LOCALE_KEY = "preferred_locale";

/**
 * Normalize BCP-47 locale for storage (lowercase, spec-compliant).
 * Value MUST be ≤64 chars; SHOULD be 2–35; only [a-z0-9-].
 */
function normalizePreferredLocaleForStorage(locale: string): string {
  const trimmed = locale.trim();
  if (!trimmed) return "en-us";
  const lower = trimmed.toLowerCase();
  // Remove any characters not in [a-z0-9-]
  const safe = lower.replace(/[^a-z0-9-]/g, "");
  if (!safe) return "en-us";
  return safe.length > 64 ? safe.slice(0, 64) : safe;
}

/**
 * Hook to save the current preferred locale to the Envoi/VIP17 resolver when on VOI network.
 * Similar to saving avatar_dorkfi: uses ResolverService.setText with key preferred_locale
 * (ENVIP spec). Only available when active network is voi-mainnet and the user has an Envoi name.
 */
export function useSavePreferredLocaleToEnvoi() {
  const { currentNetwork } = useNetwork();
  const { activeAccount, signTransactions } = useWallet();
  const { name: addressName } = useAddressName(activeAccount?.address ?? null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const canSave =
    currentNetwork === "voi-mainnet" &&
    !!activeAccount?.address &&
    !!addressName &&
    !!signTransactions;

  const savePreferredLocaleToEnvoi = useCallback(async () => {
    if (!canSave || !activeAccount?.address || !addressName || !signTransactions) {
      setError(new Error("Save to Envoi profile is only available on Voi Network with an Envoi name."));
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const effectiveLocale = getEffectiveLocale();
      const value = normalizePreferredLocaleForStorage(effectiveLocale);

      const resolver = new ResolverService("mainnet", activeAccount.address);
      const setTextResult = await resolver.setText(addressName, PREFERRED_LOCALE_KEY, value);

      if (!setTextResult?.success) {
        throw new Error("Failed to prepare transaction");
      }

      const txns = setTextResult.txns as string[];
      if (!Array.isArray(txns) || txns.length === 0) {
        throw new Error("No transactions to sign");
      }

      const stxns = await signTransactions(
        txns.map((txn: string) => Uint8Array.from(atob(txn), (c) => c.charCodeAt(0)))
      );

      const algorandNetwork = getAlgorandNetworkFromNetworkId(currentNetwork as "voi-mainnet");
      if (!algorandNetwork) {
        throw new Error(`Invalid network: ${currentNetwork}`);
      }

      const clients = await algorandService.initializeClientsForTransactions(algorandNetwork);
      const res = await clients.algod.sendRawTransaction(stxns).do();
      await waitForConfirmation(clients.algod, res.txid, 4);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [canSave, activeAccount?.address, addressName, signTransactions, currentNetwork]);

  return { savePreferredLocaleToEnvoi, isSaving, error, canSave };
}
