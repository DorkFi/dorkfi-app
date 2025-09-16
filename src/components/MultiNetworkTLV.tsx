import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { NetworkId } from '@/config';
import { useMultiNetworkTLV } from '@/hooks/useMultiNetworkTLV';
import { Coins, RefreshCw, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface MultiNetworkTLVProps {
  enabledNetworks: NetworkId[];
  showBreakdown?: boolean;
  refreshInterval?: number;
  autoRefresh?: boolean;
}

interface StatProps {
  label: string;
  value: string | React.ReactNode;
  icon: any;
  className?: string;
}

// Stat component matching the original design
function Stat({
  label,
  value,
  icon: Icon,
  className = "",
}: StatProps) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl border border-ocean-teal/20 bg-gradient-to-br from-slate-900 to-slate-800 p-4 shadow-sm dark-glow-card ${className}`}>
      <div className="rounded-xl border border-ocean-teal/30 bg-slate-800/60 p-2">
        <Icon className="h-5 w-5 text-aqua-glow" />
      </div>
      <div>
        <div className="text-xs uppercase tracking-wide text-slate-400">
          {label}
        </div>
        <div className="text-lg font-semibold text-white">
          {value}
        </div>
      </div>
    </div>
  );
}

interface NetworkBreakdownProps {
  networkData: Record<NetworkId, any>;
  isLoading: boolean;
  onRefresh: () => void;
}

const NetworkBreakdown: React.FC<NetworkBreakdownProps> = ({ 
  networkData, 
  isLoading, 
  onRefresh 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="mt-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-left text-sm text-slate-400 hover:text-white transition-colors"
      >
        <span>Network Breakdown</span>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <TrendingDown className="w-4 h-4" />
        </motion.div>
      </button>

      {isExpanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className="mt-3 space-y-2"
        >
          {Object.values(networkData).map((data) => (
            <div
              key={data.networkId}
              className="flex items-center justify-between px-3 py-2 bg-slate-800/40 rounded-lg border border-slate-700/50"
            >
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-aqua-glow"></div>
                <span className="text-sm text-slate-300 capitalize">
                  {data.networkId.replace('-', ' ')}
                </span>
                {data.error && (
                  <AlertCircle className="w-3 h-3 text-red-400" />
                )}
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-white">
                  ${data.totalValue.toLocaleString('en-US', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                </span>
                {data.isLoading && (
                  <RefreshCw className="w-3 h-3 animate-spin text-aqua-glow" />
                )}
              </div>
            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
};

export const MultiNetworkTLV: React.FC<MultiNetworkTLVProps> = ({
  enabledNetworks,
  showBreakdown = true,
  refreshInterval = 30000,
  autoRefresh = true,
}) => {
  const { combinedData, isLoading, error, refreshAll } = useMultiNetworkTLV({
    enabledNetworks,
    refreshInterval,
    autoRefresh,
  });

  const formatValue = (value: number) => {
    if (value >= 1_000_000_000) {
      return `$${(value / 1_000_000_000).toFixed(1)}B`;
    } else if (value >= 1_000_000) {
      return `$${(value / 1_000_000).toFixed(1)}M`;
    } else if (value >= 1_000) {
      return `$${(value / 1_000).toFixed(1)}K`;
    } else {
      return `$${value.toFixed(0)}`;
    }
  };

  const getLastUpdatedText = () => {
    if (combinedData.lastUpdated === 0) return 'Never updated';
    
    const now = Date.now();
    const diff = now - combinedData.lastUpdated;
    
    if (diff < 60000) { // Less than 1 minute
      return 'Updated just now';
    } else if (diff < 3600000) { // Less than 1 hour
      const minutes = Math.floor(diff / 60000);
      return `Updated ${minutes}m ago`;
    } else {
      const hours = Math.floor(diff / 3600000);
      return `Updated ${hours}h ago`;
    }
  };

  if (error) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div>
            <Stat
              label="Total Locked Value"
              value={
                <div className="flex items-center space-x-2">
                  <span className="text-red-400">Error</span>
                  <button
                    onClick={refreshAll}
                    className="p-1 hover:bg-slate-700 rounded transition-colors"
                    title="Retry"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              }
              icon={AlertCircle}
              className="border-red-500/20"
            />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Error loading TLV data. Click refresh to retry.</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div>
          <Stat
            label="Total Locked Value"
            value={
              <div className="flex items-center space-x-2">
                <span>
                  {isLoading ? (
                    <div className="flex items-center space-x-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-aqua-glow" />
                      <span className="text-slate-400">Loading...</span>
                    </div>
                  ) : (
                    formatValue(combinedData.totalValue)
                  )}
                </span>
                <button
                  onClick={refreshAll}
                  className="p-1 hover:bg-slate-700 rounded transition-colors"
                  title="Refresh TLV data"
                  disabled={isLoading}
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            }
            icon={Coins}
          />
          {showBreakdown && (
            <NetworkBreakdown
              networkData={combinedData.networkData}
              isLoading={isLoading}
              onRefresh={refreshAll}
            />
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <div className="space-y-2">
          <p>
            Total USD value of all deposits locked across all PreFi markets on{' '}
            {enabledNetworks.length} network{enabledNetworks.length > 1 ? 's' : ''}.
          </p>
          <p className="text-xs text-slate-400">
            {getLastUpdatedText()}
          </p>
          {showBreakdown && (
            <div className="text-xs text-slate-400">
              <div className="font-semibold mb-1">Network Breakdown:</div>
              {Object.values(combinedData.networkData).map((data) => (
                <div key={data.networkId} className="flex justify-between">
                  <span className="capitalize">
                    {data.networkId.replace('-', ' ')}:
                  </span>
                  <span>
                    ${data.totalValue.toLocaleString('en-US', {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
};

export default MultiNetworkTLV;
