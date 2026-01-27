import { useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export const GovernanceVotingInfoDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger
        className={cn(
          "flex items-center justify-between w-full p-3 rounded-lg transition-all duration-200",
          "bg-muted/30 hover:bg-muted/50 border border-border/50"
        )}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            Governance Voting Info
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-200",
              isOpen && "rotate-180"
            )}
          />
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
        <div className="mt-2 rounded-lg border border-border/50 bg-background/80 backdrop-blur-sm overflow-hidden">
          <div className="p-4 md:p-6">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-6 md:gap-8">
              {/* Left Column - UNIT Governance */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground">UNIT Governance</h3>
                <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                  <p>
                    Holding UNIT gives you direct influence over how the protocol evolves. UNIT holders can propose and vote on decisions that shape DorkFi's financial architecture, including:
                  </p>
                  <ul className="list-disc list-inside space-y-1 pl-2">
                    <li>New lending markets and asset support</li>
                    <li>Treasury allocation and protocol incentives</li>
                    <li>Risk controls and future protocol upgrades</li>
                  </ul>
                  <p>
                    UNIT governance is fully on-chain and transparent. Voting power is calculated based on your UNIT balance, with optional boosts from Dork NFTs through the NFT Power Multiplier system.
                  </p>
                </div>
              </div>

              {/* Vertical Divider - hidden on mobile */}
              <div className="hidden md:block w-px bg-border/50 self-stretch" />

              {/* Right Column - NFT Power Multiplier */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground">NFT Power Multiplier</h3>
                <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                  <p>
                    When you hold eligible Dork NFTs, your UNIT voting power is multiplied based on the collection value. This multiplier increases your Effective Voting Power without requiring additional UNIT tokens.
                  </p>
                  <p className="font-medium text-foreground">Key properties of the NFT Power Multiplier:</p>
                  <ul className="list-disc list-inside space-y-1 pl-2">
                    <li>Boosts governance power, not token supply</li>
                    <li>Fully transparent and calculated on-chain</li>
                    <li>Designed to reward early supporters and builders</li>
                  </ul>
                  <p>Your final voting weight is calculated as:</p>
                  <div className="mt-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <code className="text-sm font-mono text-primary">
                      Effective Voting Power = UNIT Balance × NFT Multiplier
                    </code>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
