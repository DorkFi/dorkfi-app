import { useState, useEffect } from 'react';
import { useNetwork } from '@/contexts/NetworkContext';
import {
  fetchUserDepositBalance,
  fetchUserBorrowBalance,
  fetchAllMarkets,
} from '@/services/lendingService';
import { getAllTokensWithDisplayInfo } from '@/config';

export interface UserAsset {
  symbol: string;
  contractId: string;
  depositBalance: number;
  borrowBalance: number;
  depositValueUSD: number;
  borrowValueUSD: number;
  tokenPrice: number;
  apy?: number;
  borrowApy?: number;
  collateralFactor?: number;
  liquidationThreshold?: number;
  closeFactor?: number;
}

export interface UserAssetsData {
  assets: UserAsset[];
  totalDepositValue: number;
  totalBorrowValue: number;
  isLoading: boolean;
  error: string | null;
}

export const useUserAssets = (userAddress: string) => {
  const { currentNetwork } = useNetwork();
  const [data, setData] = useState<UserAssetsData>({
    assets: [],
    totalDepositValue: 0,
    totalBorrowValue: 0,
    isLoading: false,
    error: null,
  });

  const fetchUserAssets = async () => {
    if (!userAddress || !currentNetwork) {
      setData({
        assets: [],
        totalDepositValue: 0,
        totalBorrowValue: 0,
        isLoading: false,
        error: null,
      });
      return;
    }

    setData(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      console.log('Fetching user assets for:', userAddress, 'on network:', currentNetwork);
      
      // Get all tokens and markets
      const tokens = getAllTokensWithDisplayInfo(currentNetwork);
      const markets = await fetchAllMarkets(currentNetwork);
      
      const assets: UserAsset[] = [];
      let totalDepositValue = 0;
      let totalBorrowValue = 0;

      // Fetch data for each token
      for (const token of tokens) {
        if (token.underlyingContractId && token.poolId) {
          const market = markets.find((m) => m.symbol === token.symbol);
          
          // Fetch both deposit and borrow balances
          const [depositBalance, borrowData] = await Promise.all([
            fetchUserDepositBalance(
              userAddress,
              token.poolId,
              token.underlyingContractId,
              currentNetwork
            ),
            fetchUserBorrowBalance(
              userAddress,
              token.poolId,
              token.underlyingContractId,
              currentNetwork
            )
          ]);

          // Extract borrow balance from the new return type
          const borrowBalance = borrowData?.balance || 0;

          // Calculate USD values
          const tokenPrice = market?.price ? parseFloat(market.price) / Math.pow(10, 6) : 1;
          const depositValueUSD = depositBalance * tokenPrice;
          const borrowValueUSD = borrowBalance * tokenPrice;

          // Only include assets with positions
          if (depositBalance > 0 || borrowBalance > 0) {
            assets.push({
              symbol: token.symbol,
              contractId: token.underlyingContractId,
              depositBalance,
              borrowBalance,
              depositValueUSD,
              borrowValueUSD,
              tokenPrice,
              apy: market?.apyCalculation?.apy || market?.supplyRate ? market.supplyRate * 100 : 0,
              borrowApy: market?.borrowApyCalculation?.apy || market?.borrowRateCurrent ? market.borrowRateCurrent * 100 : 0,
              collateralFactor: market?.collateralFactor || 0.8, // Default to 80% if not available
              liquidationThreshold: market?.liquidationThreshold || 0.85, // Default to 85% if not available
              closeFactor: market?.closeFactor || 0.5, // Default to 50% if not available
            });

            totalDepositValue += depositValueUSD;
            totalBorrowValue += borrowValueUSD;
          }
        }
      }

      setData({
        assets,
        totalDepositValue,
        totalBorrowValue,
        isLoading: false,
        error: null,
      });

      console.log('User assets fetched:', { assets, totalDepositValue, totalBorrowValue });
    } catch (error) {
      console.error('Error fetching user assets:', error);
      setData(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch user assets',
      }));
    }
  };

  useEffect(() => {
    fetchUserAssets();
  }, [userAddress, currentNetwork]);

  return {
    ...data,
    refetch: fetchUserAssets,
  };
};
