import React, { useState } from 'react';
import { UserPosition } from './types';

const StatCard = ({ label, value, color }: { label: string, value: string, color: string }) => (
  <div className="flex-1 mx-1 min-w-[100px] bg-[#18233A] rounded-2xl px-0 py-4 shadow border border-white/5 flex flex-col items-center">
    <div className="uppercase text-xs tracking-wide mb-1 text-blue-100/70">{label}</div>
    <div className={`font-bold text-xl md:text-2xl ${color}`}>{value}</div>
  </div>
);

export const UserPositionBar = ({ userPosition }: { userPosition?: UserPosition }) => {
  const [open, setOpen] = useState(true);
  if (!userPosition) return null;
  return (
    <div className="px-0 mt-[-20px] mb-4">
      {/* Dropdown bar */}
      <button
        className="w-full flex items-center justify-between px-5 py-4 rounded-t-2xl bg-[#101729] border-b border-blue-50/10 hover:bg-[#162346] transition-colors group focus:outline-none"
        onClick={() => setOpen(o => !o)}
      >
        <span className="flex items-center font-semibold text-base text-white">
          <svg className="h-5 w-5 text-blue-300 mr-2" fill="none" viewBox="0 0 24 24"><rect width="24" height="24" fill="none"/><path d="M4 12h16" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round"/></svg> Your Position
        </span>
        <svg
          className={`w-6 h-6 ml-2 text-blue-100 transition-transform duration-300 ${open ? '' : '-rotate-90'}`}
          fill="none"
          viewBox="0 0 24 24"
        >
          <polyline points="6 9 12 15 18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {/* Stat cards dropdown */}
      {open && (
        <div className="bg-gradient-to-br from-[#0c1528] to-[#101c38] shadow-lg rounded-b-2xl border border-gray-800/80 flex flex-row gap-0 px-4 py-0 items-center w-full">
          <StatCard label="Supplied" value={`$${userPosition.supplied}`} color="text-green-400" />
          <StatCard label="Borrowed" value={`$${userPosition.borrowed}`} color="text-orange-400" />
          <StatCard label="Withdrawable" value={`$${userPosition.withdrawable}`} color="text-cyan-300" />
          <StatCard label="Borrowable" value={`$${userPosition.borrowable}`} color="text-blue-400" />
          <StatCard label="Health Factor" value={userPosition.healthFactor.toFixed(2)} color="text-green-300" />
        </div>
      )}
    </div>
  );
};
