import React from "react";
import { ExternalLink } from "lucide-react";
import { useNetwork } from "@/contexts/NetworkContext";
import { getNetworkConfig, type NetworkId } from "@/config";

/**
 * Short compliance copy: non-custodial interface, user-signed on-chain execution.
 * Shown in global footers; not a substitute for jurisdiction-specific disclosures.
 */
const NonCustodialComplianceStrip: React.FC<{ className?: string }> = ({
  className = "",
}) => {
  const { currentNetwork } = useNetwork();
  const net = currentNetwork as NetworkId;
  const explorerUrl = getNetworkConfig(net).explorerUrl;

  return (
    <div
      className={`text-xs text-muted-foreground text-center sm:text-left leading-relaxed border border-border/50 rounded-lg px-3 py-2 bg-muted/20 ${className}`}
    >
      <p>
        This app is a <strong className="text-foreground/90 font-medium">non-custodial interface</strong>.
        You control your assets. Transactions are signed in your wallet and executed directly on-chain.
      </p>
      <p className="mt-1.5">
        This interface does not provide investment advice.{" "}
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-ocean-teal hover:underline font-medium"
        >
          Network explorer
          <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
        </a>
        {" · "}
        <a
          href="https://docs.dork.fi"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-ocean-teal hover:underline font-medium"
        >
          Documentation
          <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
        </a>
      </p>
    </div>
  );
};

export default NonCustodialComplianceStrip;
