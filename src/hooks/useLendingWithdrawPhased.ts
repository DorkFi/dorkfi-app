import { useCallback, useMemo } from "react";
import algosdk, { waitForConfirmation } from "algosdk";
import {
  FOLKS_MAINNET_ALGO_WITHDRAW,
  getAllTokensWithDisplayInfo,
  getAlgorandNetworkFromNetworkId,
  getTokenConfig,
  isFolksAlgoWithdrawTwoStepEnabled,
  type NetworkId,
} from "@/config";
import { MainnetConsensusConfig } from "@/services/xalgoConsensusAdapter";
import {
  fetchMarketInfoFromContract,
  withdraw,
} from "@/services/lendingService";
import algorandService from "@/services/algorandService";
import dorkfiAPIService from "@/services/dorkfiAPIService";
import {
  TX_CONFIRMATION_WAIT_ROUNDS,
  scheduleTransactionMetadataUpdate,
} from "@/utils/transactionUtils";
import { resolveSupplyBorrowToken } from "@/utils/resolveSupplyBorrowToken";
import type {
  WithdrawModalSubmitResult,
  WithdrawPhasedSignPayload,
  WithdrawSubmitOptions,
} from "@/components/WithdrawModal";

export type LendingWithdrawTarget = {
  asset: string | null;
  poolId?: string;
  marketId?: string;
  configSymbol?: string;
  network?: string;
};

export type LendingWithdrawDepositRef = {
  asset: string;
  poolId?: string;
  marketId?: string;
  configSymbol?: string;
  network?: string;
};

/**
 * Build and broadcast a lending withdraw group. Shared by the portfolio and
 * the markets detail screen so both ask the wallet to sign.
 */
export function useLendingWithdrawPhased(params: {
  userAddress?: string;
  currentNetwork: string;
  target: LendingWithdrawTarget;
  deposits?: LendingWithdrawDepositRef[];
  maxWithdrawScaled?: string | null;
  onRefreshWalletBalance?: (asset: string) => void;
  onRefreshPosition?: (
    network: string | undefined,
    poolId: string | number | undefined,
    marketId: string | number | undefined
  ) => void;
}) {
  const {
    userAddress,
    currentNetwork,
    target,
    deposits = [],
    maxWithdrawScaled,
    onRefreshWalletBalance,
    onRefreshPosition,
  } = params;

  const resolveContext = useCallback(() => {
    if (!userAddress || !target.asset) {
      throw new Error("Connect your wallet and select an asset to withdraw.");
    }

    const deposit =
      deposits.find(
        (d) =>
          d.asset === target.asset &&
          String(d.poolId ?? "") === String(target.poolId ?? "") &&
          (target.marketId == null ||
            target.marketId === "" ||
            String(d.marketId ?? "") === String(target.marketId)) &&
          (target.configSymbol == null ||
            target.configSymbol === "" ||
            String(d.configSymbol ?? "") === String(target.configSymbol))
      ) ??
      (target.poolId
        ? (() => {
            const candidates = deposits.filter(
              (d) =>
                d.asset === target.asset &&
                String(d.poolId ?? "") === String(target.poolId)
            );
            return (
              (target.configSymbol
                ? candidates.find(
                    (c) =>
                      String(c.configSymbol ?? "") ===
                      String(target.configSymbol)
                  )
                : undefined) ?? candidates[0]
            );
          })()
        : undefined) ??
      deposits.find((d) => d.asset === target.asset);

    const networkToUse = (target.network ||
      deposit?.network ||
      currentNetwork) as NetworkId;

    const tokens = getAllTokensWithDisplayInfo(networkToUse);
    const token = resolveSupplyBorrowToken(
      tokens,
      target.asset,
      target.poolId ?? deposit?.poolId,
      deposit?.configSymbol ?? target.configSymbol,
      target.marketId ?? deposit?.marketId ?? ""
    );

    if (!token?.poolId || !token.underlyingContractId) {
      throw new Error(
        `Token not found for ${target.asset}${
          target.poolId ? ` with poolId ${target.poolId}` : ""
        } on network ${networkToUse}`
      );
    }

    const configLookupKey =
      token.configKey ?? token.originalSymbol ?? target.asset;
    const originalTokenConfigRaw = getTokenConfig(networkToUse, configLookupKey);
    if (!originalTokenConfigRaw) {
      throw new Error(
        `Token config not found for ${target.asset} (configLookupKey: ${configLookupKey}) on network ${networkToUse}`
      );
    }

    const originalTokenConfig = Array.isArray(originalTokenConfigRaw)
      ? originalTokenConfigRaw.find(
          (tc) => String(tc.poolId) === String(token.poolId)
        ) || originalTokenConfigRaw[0]
      : originalTokenConfigRaw;

    if (!originalTokenConfig) {
      throw new Error(
        `Token config not found for ${target.asset} with poolId ${token.poolId} on network ${networkToUse}`
      );
    }

    return { networkToUse, token, originalTokenConfig };
  }, [
    userAddress,
    target.asset,
    target.poolId,
    target.marketId,
    target.configSymbol,
    target.network,
    deposits,
    currentNetwork,
  ]);

  const buildUnsignedGroup = useCallback(
    async (
      amount: string,
      options?: WithdrawSubmitOptions
    ): Promise<WithdrawPhasedSignPayload> => {
      const { networkToUse, token, originalTokenConfig } = resolveContext();

      const withdrawAllConfirmed = Boolean(options?.withdrawAllConfirmed);
      const step2FolksRedeem =
        Boolean(options?.folksTwoStepFolksRedeem) &&
        options?.folksRedeemFAssetAtomic != null &&
        String(options.folksRedeemFAssetAtomic).trim() !== "";
      const withdrawAdapterTrimmed = String(
        options?.withdrawAdapterId ?? ""
      ).trim();
      const useFolksWithdrawTwoStepStep1 =
        !step2FolksRedeem &&
        isFolksAlgoWithdrawTwoStepEnabled() &&
        networkToUse === "algorand-mainnet" &&
        withdrawAdapterTrimmed === FOLKS_MAINNET_ALGO_WITHDRAW.id;

      const result = await withdraw(
        token.poolId,
        token.underlyingContractId,
        originalTokenConfig.tokenStandard,
        step2FolksRedeem ? "0" : amount,
        userAddress!,
        networkToUse,
        {
          withdrawAll: step2FolksRedeem ? false : withdrawAllConfirmed,
          maxWithdrawScaled:
            !step2FolksRedeem &&
            withdrawAllConfirmed &&
            options?.isMaxWithdraw &&
            maxWithdrawScaled
              ? BigInt(maxWithdrawScaled)
              : undefined,
          withdrawAdapterId: options?.withdrawAdapterId,
          xalgoConsensusWithdrawAppendBurn:
            options?.xalgoConsensusWithdrawAppendBurn,
          ...(step2FolksRedeem
            ? {
                folksTwoStep: "folks_redeem_only" as const,
                folksRedeemFAssetAtomic: String(
                  options!.folksRedeemFAssetAtomic!
                ).trim(),
              }
            : useFolksWithdrawTwoStepStep1
              ? { folksTwoStep: "lending_to_wallet" as const }
              : {}),
        }
      );

      if (!result.success) {
        if ("error" in result && result.error) {
          const message = String(result.error).toLowerCase();
          if (message.includes("insufficient liquidity for withdraw")) {
            throw new Error(message);
          }
          throw new Error(result.error || "Withdraw failed");
        }
        throw new Error("Withdraw failed");
      }

      if (!("txns" in result) || !result.txns?.length) {
        throw new Error(
          "No transactions returned from protocol; nothing to sign."
        );
      }

      const underlyingId =
        token && typeof token === "object" && "underlyingAssetId" in token
          ? (token as { underlyingAssetId?: string }).underlyingAssetId
          : undefined;

      const xBurn = Boolean(options?.xalgoConsensusWithdrawAppendBurn);

      const wm = (result as { withdrawMeta?: unknown }).withdrawMeta as
        | {
            folksTwoStep: string;
            fAssetToRedeemAtomic?: string;
          }
        | undefined;

      return {
        txnsB64: result.txns,
        poolAppId: String(token.poolId),
        marketContractId: String(token.underlyingContractId),
        underlyingAssetId: underlyingId ?? null,
        networkId: networkToUse,
        txSignPreviewVariant: xBurn
          ? "xalgo-withdraw-burn-combined"
          : "lending",
        governanceConsensusAppId: xBurn
          ? String(MainnetConsensusConfig.consensusAppId)
          : undefined,
        assetDisplaySymbol: target.asset ?? token.symbol,
        amountHuman: amount,
        folksTwoStepLendingToWallet:
          wm?.folksTwoStep === "lending_to_wallet" &&
          wm?.fAssetToRedeemAtomic != null &&
          String(wm.fAssetToRedeemAtomic).trim() !== "",
        fAssetToRedeemAtomic:
          wm?.folksTwoStep === "lending_to_wallet"
            ? String(wm?.fAssetToRedeemAtomic ?? "")
            : undefined,
        folksTwoStepPhase: step2FolksRedeem
          ? ("folks_redeem_only" as const)
          : useFolksWithdrawTwoStepStep1
            ? ("lending_to_wallet" as const)
            : undefined,
      };
    },
    [resolveContext, userAddress, maxWithdrawScaled, target.asset]
  );

  const finalizeSignedGroup = useCallback(
    async (
      stxns: Uint8Array[],
      built: WithdrawPhasedSignPayload
    ): Promise<WithdrawModalSubmitResult> => {
      try {
        const { networkToUse, token } = resolveContext();

        const algorandNetwork = getAlgorandNetworkFromNetworkId(
          built.networkId as NetworkId
        );
        if (!algorandNetwork) {
          throw new Error(`Invalid network: ${built.networkId}`);
        }
        const algorandClients =
          await algorandService.initializeClientsForTransactions(
            algorandNetwork
          );
        const res = await algorandClients.algod.sendRawTransaction(stxns).do();
        await waitForConfirmation(
          algorandClients.algod,
          res.txid,
          TX_CONFIRMATION_WAIT_ROUNDS
        );

        const decodedStxns = stxns.map((txn: Uint8Array) =>
          algosdk.decodeSignedTransaction(txn)
        );
        const poolTxnID = decodedStxns
          .slice()
          .reverse()
          .find(
            (txn) =>
              txn.txn.type === "appl" &&
              Number(txn.txn.applicationCall?.appIndex) ===
                parseInt(built.poolAppId, 10)
          )
          ?.txn.txID();

        scheduleTransactionMetadataUpdate(poolTxnID ?? res.txid, networkToUse);

        if (onRefreshWalletBalance && target.asset) {
          onRefreshWalletBalance(target.asset);
        }

        if (userAddress) {
          onRefreshPosition?.(
            networkToUse,
            token.poolId,
            token.underlyingContractId
          );
          Promise.all([
            dorkfiAPIService.fetchFreshUserData(
              userAddress,
              networkToUse,
              parseInt(token.poolId, 10),
              parseInt(token.underlyingContractId, 10)
            ),
            fetchMarketInfoFromContract(
              token.poolId,
              token.underlyingContractId,
              networkToUse as NetworkId
            ),
            dorkfiAPIService.fetchFreshUserHealth(
              networkToUse,
              parseInt(token.poolId, 10),
              userAddress
            ),
          ])
            .then(() => {
              onRefreshPosition?.(
                networkToUse,
                token.poolId,
                token.underlyingContractId
              );
            })
            .catch((error) => {
              console.error(
                "Error calling fetchFreshUserData after withdraw:",
                error
              );
              onRefreshPosition?.(
                networkToUse,
                token.poolId,
                token.underlyingContractId
              );
            });
        }

        return {
          txId: res.txid,
          skipSuccessModal: Boolean(
            built.folksTwoStepLendingToWallet && built.fAssetToRedeemAtomic
          ),
          fAssetToRedeemAtomic: built.folksTwoStepLendingToWallet
            ? built.fAssetToRedeemAtomic
            : undefined,
        };
      } catch (error) {
        console.error("Withdraw error:", error);
        throw error;
      }
    },
    [
      resolveContext,
      onRefreshWalletBalance,
      onRefreshPosition,
      target.asset,
      userAddress,
    ]
  );

  const withdrawPhased = useMemo(
    () => ({
      buildUnsignedGroup,
      finalizeSignedGroup,
    }),
    [buildUnsignedGroup, finalizeSignedGroup]
  );

  return { withdrawPhased };
}
