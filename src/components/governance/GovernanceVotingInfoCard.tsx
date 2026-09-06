import DorkFiCard from "@/components/ui/DorkFiCard";
import { H1, Body } from "@/components/ui/Typography";
import { GovernanceVotingInfoDropdown } from "./GovernanceVotingInfoDropdown";
import VoteChubImage from "@/assets/VoteChub1.png";

export const GovernanceVotingInfoCard = () => {
  return (
    <DorkFiCard className="p-4 md:p-6">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row items-center gap-4 md:gap-6 mb-4">
        {/* Image on the left - 1/3 width */}
        <div className="w-full sm:w-1/3 flex justify-center p-0">
          <img
            src={VoteChubImage}
            alt="Vote for Chub - DorkFi Governance Mascot"
            className="w-48 h-48 sm:w-full sm:h-auto max-w-[300px] object-contain"
          />
        </div>
        
        {/* Text on the right - 2/3 width */}
        <div className="w-full sm:w-2/3 text-center sm:text-left">
          <H1 className="m-0 text-3xl md:text-4xl">
            <span className="hero-header">Governance</span>
          </H1>
          <Body className="mt-2 mb-3 text-base md:text-lg text-muted-foreground">
            Vote on protocol changes using your UNIT.
          </Body>
          <Body className="text-base md:text-lg leading-relaxed">
            UNIT holders shape upgrades, risk parameters, market listings, and treasury decisions
            on-chain. Your UNIT defines your influence.
          </Body>
        </div>
      </div>

      {/* Voting Info Dropdown */}
      <GovernanceVotingInfoDropdown />
    </DorkFiCard>
  );
};
