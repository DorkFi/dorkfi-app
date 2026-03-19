import React, { useState } from 'react';
import { MarketData } from './types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

const InterestRateCurve = ({ baseRate: _baseRate, slope: _slope }: { baseRate: number; slope: number }) => {
  void _baseRate;
  void _slope;
  return (
    <svg viewBox="0 0 300 80" width="100%" height="70" className="mb-2 text-muted-foreground">
      <line x1="24" y1="5" x2="24" y2="70" stroke="currentColor" strokeWidth="1.5" className="opacity-40" />
      <line x1="24" y1="70" x2="290" y2="70" stroke="currentColor" strokeWidth="1.5" className="opacity-40" />
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-ocean-teal"
        points="24,62 157,39 290,15"
      />
      <text x="8" y="70" fill="currentColor" fontSize="10" className="opacity-70">
        0%
      </text>
      <text x="6" y="62" fill="currentColor" fontSize="10" className="opacity-70">
        4%
      </text>
      <text x="3" y="39" fill="currentColor" fontSize="10" className="opacity-70">
        8%
      </text>
      <text x="3" y="16" fill="currentColor" fontSize="10" className="opacity-70">
        16%
      </text>
      <text x="24" y="78" fill="currentColor" fontSize="10" className="opacity-70">
        0%
      </text>
      <text x="72" y="78" fill="currentColor" fontSize="10" className="opacity-70">
        16%
      </text>
      <text x="120" y="78" fill="currentColor" fontSize="10" className="opacity-70">
        32%
      </text>
      <text x="170" y="78" fill="currentColor" fontSize="10" className="opacity-70">
        56%
      </text>
      <text x="220" y="78" fill="currentColor" fontSize="10" className="opacity-70">
        80%
      </text>
      <text x="275" y="78" fill="currentColor" fontSize="10" className="opacity-70">
        100%
      </text>
    </svg>
  );
};

export const AdvancedDetails = ({ marketData }: { marketData: MarketData }) => {
  const [expanded, setExpanded] = useState(true);
  const baseRate = 2.0;
  const slope = 13.0;
  const reserveFactor = marketData.reserveFactor;
  const supplyCap = marketData.supplyCap;
  const totalSupply = marketData.totalSupply;
  const borrowCap = marketData.borrowCap;
  const totalBorrow = marketData.totalBorrow;

  const panelClass =
    'p-4 rounded-lg border border-border bg-muted/30 dark:bg-muted/20 mb-4';

  return (
    <Card className="p-0 border-0 bg-transparent shadow-none mt-5 mb-3">
      <CardHeader
        className="pb-4 px-4 cursor-pointer select-none flex flex-row items-center justify-between"
        onClick={() => setExpanded((e) => !e)}
      >
        <CardTitle className="flex items-center gap-2 text-foreground text-lg font-semibold">
          <svg
            className="w-6 h-6 text-ocean-teal shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path
              d="M4 12h16M12 4v16"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          Advanced details
        </CardTitle>
        <svg
          className={`w-6 h-6 transition-transform duration-300 text-muted-foreground ml-3 shrink-0 ${expanded ? '' : '-rotate-90'}`}
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
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-6 px-4 py-0">
          <div className={panelClass}>
            <div className="flex items-center mb-2 text-base text-foreground font-semibold">
              <svg
                className="w-5 h-5 mr-2 text-ocean-teal shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <polyline
                  points="4 14 10 10 15.5 13.5 21 8"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Interest rate curve
            </div>
            <InterestRateCurve baseRate={baseRate} slope={slope} />
            <div className="text-xs text-muted-foreground mt-1">Utilization: 0%</div>
          </div>
          <div className={panelClass}>
            <div className="mb-2 font-semibold text-base text-foreground">Rate parameters</div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-4">
              <div className="flex flex-col items-start">
                <span className="text-xs text-muted-foreground">Base rate</span>
                <span className="font-semibold text-lg text-foreground">2.00%</span>
              </div>
              <div className="flex flex-col items-start">
                <span className="text-xs text-muted-foreground">Slope</span>
                <span className="font-semibold text-lg text-foreground">13.00%</span>
              </div>
              <div className="flex flex-col items-start">
                <span className="text-xs text-muted-foreground">Reserve factor</span>
                <span className="font-semibold text-lg text-foreground">{reserveFactor}%</span>
              </div>
            </div>
          </div>
          <div className={`${panelClass} mb-0`}>
            <div className="mb-2 flex items-center text-base font-semibold text-foreground">
              <svg
                className="h-5 w-5 mr-2 text-green-600 dark:text-green-400 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  d="M3 12v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7m-8-4v11"
                  stroke="currentColor"
                  strokeWidth="2"
                />
              </svg>
              Market caps
            </div>
            <div>
              <div className="flex flex-wrap items-center text-sm mb-2 gap-2">
                <span className="text-muted-foreground w-20 shrink-0">Supply cap</span>
                <div className="flex-1 min-w-[120px] mx-2 h-3 rounded-lg bg-muted relative overflow-hidden">
                  <div
                    className="absolute left-0 top-0 h-3 rounded-lg bg-green-500/80 transition-all"
                    style={{
                      width: `${Math.min(100, supplyCap > 0 ? (totalSupply / supplyCap) * 100 : 0)}%`,
                    }}
                  />
                </div>
                <span className="font-bold text-foreground w-32 text-right shrink-0">
                  ${totalSupply.toLocaleString()} / ${supplyCap.toLocaleString()}
                </span>
              </div>
              <div className="flex flex-wrap items-center text-sm gap-2">
                <span className="text-muted-foreground w-20 shrink-0">Borrow cap</span>
                <div className="flex-1 min-w-[120px] mx-2 h-3 rounded-lg bg-muted relative overflow-hidden">
                  <div
                    className="absolute left-0 top-0 h-3 rounded-lg bg-orange-500/80 transition-all"
                    style={{
                      width: `${Math.min(100, borrowCap > 0 ? (totalBorrow / borrowCap) * 100 : 0)}%`,
                    }}
                  />
                </div>
                <span className="font-bold text-foreground w-32 text-right shrink-0">
                  ${totalBorrow.toLocaleString()} / ${borrowCap.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
};
