import React, { useState } from 'react';
import { MarketData, UserPosition } from './types';

export const PrimaryActionButtons = ({
  onDeposit,
  onWithdraw,
  onBorrow,
  onRepay,
  asset,
  userPosition,
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
  const [selected, setSelected] = useState<'deposit' | 'borrow' | 'withdraw'>('deposit');
  return (
    <div className="flex flex-col gap-2 bg-[#131d35] px-0 py-0 rounded-2xl mt-2 shadow border-none">
      <div className="flex flex-row gap-3 mb-2">
        {/* Deposit Button (filled teal) */}
        <button
          className={`flex-1 font-bold rounded-lg py-3 px-2 flex items-center justify-center text-base transition focus:outline-none focus:ring-2 focus:ring-teal-300 shadow-none
            ${selected === 'deposit' ? 'bg-[#16d8a8] text-white' : 'bg-[#153b34] text-white/80'}
            hover:bg-[#11c6a1]`}
          onClick={() => { setSelected('deposit'); onDeposit?.(); }}
        >
          Deposit
        </button>
        {/* Borrow Button (yellow outline) */}
        <button
          className={`flex-1 font-bold rounded-lg py-3 px-2 flex items-center justify-center text-base transition focus:outline-none focus:ring-2 focus:ring-yellow-300 shadow-none border-2
            ${selected === 'borrow' ? 'border-yellow-400 text-yellow-400 bg-[#222b12]/50' : 'border-yellow-400 text-yellow-400 bg-transparent'}
            hover:bg-yellow-900/10`}
          onClick={() => { setSelected('borrow'); onBorrow?.(); }}
        >
          Borrow
        </button>
        {/* Withdraw Button (outline dark) */}
        <button
          className={`flex-1 font-bold rounded-lg py-3 px-2 flex items-center justify-center text-base transition focus:outline-none focus:ring-2 focus:ring-blue-300 shadow-none border-2
            ${selected === 'withdraw' ? 'border-blue-400 text-white bg-[#12203a]/70' : 'border-blue-600 text-white bg-transparent'}
            hover:bg-blue-900/20`}
          onClick={() => { setSelected('withdraw'); onWithdraw?.(); }}
        >
          Withdraw
        </button>
      </div>
      <div className="flex flex-row justify-between text-xs text-blue-200/90 mt-1">
        <span>Supply APY: <span className="text-green-400 font-semibold">{marketData.supplyAPY.toFixed(2)}%</span></span>
        <span>Borrow APY: <span className="text-yellow-400 font-semibold">{marketData.borrowAPY.toFixed(2)}%</span></span>
      </div>
    </div>
  );
};
