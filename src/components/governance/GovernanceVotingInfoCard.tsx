import { useState } from "react";
import DorkFiCard from "@/components/ui/DorkFiCard";
import DorkFiButton from "@/components/ui/DorkFiButton";
import { H1, Body } from "@/components/ui/Typography";
import { GovernanceVotingInfoDropdown } from "./GovernanceVotingInfoDropdown";
import HaystackUnitSwapModal from "./HaystackUnitSwapModal";
import VoteChubImage from "@/assets/VoteChub1.png";
import { useNetwork } from "@/contexts/NetworkContext";

export const GovernanceVotingInfoCard = () => {
  const { currentNetwork } = useNetwork();
  const [isUnitSwapOpen, setIsUnitSwapOpen] = useState(false);

  return (
    <>
      <DorkFiCard className="p-4 md:p-6">
        {/* Welcome Banner */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 md:gap-4 mb-3 pb-3 border-b border-border/40">
          {/* Image on the left */}
          <div className="w-full sm:w-[30%] flex justify-center sm:justify-start shrink-0 p-0">
            <img
              src={VoteChubImage}
              alt="Vote for Chub - DorkFi Governance Mascot"
              className="w-48 h-48 sm:w-full sm:h-auto max-w-[240px] object-contain"
            />
          </div>

          {/* Text on the right */}
          <div className="w-full sm:flex-1 text-center sm:text-left sm:pt-2">
            <H1 className="m-0 text-3xl md:text-4xl">
              <span className="hero-header">Governance</span>
            </H1>
            <Body className="mt-2 mb-2 text-base md:text-lg text-muted-foreground">
              Vote on protocol changes using your UNIT.
            </Body>
            <Body className="text-sm md:text-base leading-relaxed text-muted-foreground">
              UNIT holders shape upgrades, risk parameters, market listings, and treasury decisions
              on-chain. Your UNIT defines your influence.
            </Body>
            <div className="mt-4 flex justify-center sm:justify-start">
              <DorkFiButton
                variant="primary"
                size="md"
                className="tracking-wide !bg-teal-600 hover:!bg-teal-700 !text-white"
                onClick={() => setIsUnitSwapOpen(true)}
              >
                Buy $UNIT
              </DorkFiButton>
            </div>
          </div>
        </div>

        {/* Voting Info Dropdown */}
        <GovernanceVotingInfoDropdown />
      </DorkFiCard>

      <HaystackUnitSwapModal
        isOpen={isUnitSwapOpen}
        onClose={() => setIsUnitSwapOpen(false)}
        networkId={currentNetwork}
      />
    </>
  );
};
