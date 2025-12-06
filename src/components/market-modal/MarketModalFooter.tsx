import React from 'react';

export const MarketModalFooter = ({ asset }: { asset: string }) => {
  return (
    <div className="p-4 mt-2 flex flex-col gap-2 justify-center text-center text-xs text-blue-200/60 rounded-b-2xl border-t border-white/10">
      <a
        href={`https://explorer.yourprotocol.org/asset/${asset}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline font-semibold"
      >
        View asset on explorer
      </a>
      <div className="mt-1 mb-1 text-xs font-medium">
        Powered by DorkFi. Data & analytics may be delayed or inaccurate. Not financial advice.
      </div>
    </div>
  );
};

