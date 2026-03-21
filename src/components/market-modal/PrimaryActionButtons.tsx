import React from 'react';
import DorkFiButton from '@/components/ui/DorkFiButton';
import { MarketData, UserPosition } from './types';

export const PrimaryActionButtons = ({
  onDeposit,
  onWithdraw,
  onBorrow,
  onRepay,
  asset,
  userPosition: _userPosition,
  marketData,
}: {
  onDeposit?: () => void;
  onWithdraw?: () => void;
  onBorrow?: () => void;
  onRepay?: () => void;
  asset: string;
  userPosition?: UserPosition;
  marketData: MarketData;
}) => {
  void _userPosition;
  void asset;

  return (
    <div className="flex flex-col gap-3 min-w-0 w-full">
      <div className="flex flex-col gap-2 min-w-0 w-full sm:flex-row sm:flex-wrap sm:gap-2">
        <DorkFiButton
          type="button"
          variant="primary"
          className="w-full min-w-0 sm:flex-1 sm:min-w-0"
          onClick={() => onDeposit?.()}
        >
          Deposit
        </DorkFiButton>
        <DorkFiButton
          type="button"
          variant="borrow-outline"
          className="w-full min-w-0 sm:flex-1 sm:min-w-0"
          onClick={() => onBorrow?.()}
        >
          Borrow
        </DorkFiButton>
        <DorkFiButton
          type="button"
          variant="withdraw"
          className="w-full min-w-0 sm:flex-1 sm:min-w-0"
          onClick={() => onWithdraw?.()}
        >
          Withdraw
        </DorkFiButton>
      </div>
      {onRepay && (
        <DorkFiButton
          type="button"
          variant="secondary"
          className="w-full"
          onClick={() => onRepay()}
        >
          Repay
        </DorkFiButton>
      )}
      <div className="flex flex-row flex-wrap justify-between gap-2 text-xs text-muted-foreground pt-1">
        <span>
          Supply APY:{' '}
          <span className="text-green-600 dark:text-green-400 font-semibold">
            {marketData.supplyAPY.toFixed(2)}%
          </span>
        </span>
        <span>
          Borrow APY:{' '}
          <span className="text-amber-600 dark:text-amber-400 font-semibold">
            {marketData.borrowAPY.toFixed(2)}%
          </span>
        </span>
      </div>
    </div>
  );
};
