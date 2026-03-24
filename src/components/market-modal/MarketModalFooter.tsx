import React from 'react';

export const MarketModalFooter = ({ asset }: { asset: string }) => {
  return (
    <div className="px-1 sm:px-2 py-4 mt-2 flex flex-col gap-2 justify-center text-center text-xs text-muted-foreground rounded-b-xl border-t border-border min-w-0 w-full max-w-full">
      <a
        href={`https://explorer.yourprotocol.org/asset/${asset}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-ocean-teal hover:underline font-semibold"
      >
        View asset on explorer
      </a>
      <div className="mt-1 mb-1 text-xs font-medium break-words hyphens-auto">
        Powered by DorkFi. Data & analytics may be delayed or inaccurate. Not financial advice.
      </div>
    </div>
  );
};
