import React, { useState } from 'react';
import { formatUsdAmount } from '@/lib/utils';
import { UserPosition } from './types';

const StatCard = ({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) => (
  <div className="min-w-0 rounded-xl px-1.5 sm:px-2 py-3 sm:py-4 shadow-sm border border-border bg-muted/40 dark:bg-muted/25 flex flex-col items-center">
    <div className="uppercase text-xs tracking-wide mb-1 text-muted-foreground text-center">{label}</div>
    <div
      className={`font-bold text-center tabular-nums whitespace-nowrap max-w-full overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden text-base sm:text-lg md:text-xl px-0.5 ${color}`}
    >
      {value}
    </div>
  </div>
);

export const UserPositionBar = ({ userPosition }: { userPosition?: UserPosition }) => {
  const [open, setOpen] = useState(true);
  if (!userPosition) return null;
  return (
    <div className="px-0 mb-2 min-w-0 w-full max-w-full overflow-x-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 rounded-t-xl border border-b-0 border-border bg-muted/30 dark:bg-muted/20 hover:bg-muted/50 transition-colors group focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="flex items-center font-semibold text-base text-foreground">
          <svg
            className="h-5 w-5 text-ocean-teal mr-2 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path
              d="M4 12h16"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          Your position
        </span>
        <svg
          className={`w-5 h-5 ml-2 text-muted-foreground transition-transform duration-300 shrink-0 ${open ? '' : '-rotate-90'}`}
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <polyline
            points="6 9 12 15 18 9"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <div className="rounded-b-xl border border-t-0 border-border bg-muted/20 dark:bg-muted/15 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 px-2 py-3 items-stretch w-full min-w-0">
          <StatCard label="Supplied" value={formatUsdAmount(userPosition.supplied)} color="text-green-600 dark:text-green-400" />
          <StatCard label="Borrowed" value={formatUsdAmount(userPosition.borrowed)} color="text-orange-600 dark:text-orange-400" />
          <StatCard label="Withdrawable" value={formatUsdAmount(userPosition.withdrawable)} color="text-cyan-600 dark:text-cyan-400" />
          <StatCard label="Borrowable" value={formatUsdAmount(userPosition.borrowable)} color="text-blue-600 dark:text-blue-400" />
          <StatCard
            label="Health factor"
            value={userPosition.healthFactor.toFixed(2)}
            color="text-emerald-600 dark:text-emerald-400"
          />
        </div>
      )}
    </div>
  );
};
