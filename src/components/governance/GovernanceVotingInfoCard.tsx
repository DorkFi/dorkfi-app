import DorkFiCard from "@/components/ui/DorkFiCard";
import { Body } from "@/components/ui/Typography";
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
          <Body className="text-base md:text-lg leading-relaxed">
            <span className="text-xl md:text-2xl font-bold text-white underline">Welcome to the DorkFi Governance Portal.</span>
            <br />
            This is where UNIT holders shape the future of the protocol—voting on upgrades, risk parameters, market listings, and treasury decisions. Governance at DorkFi is transparent, on-chain, and driven by the community that supplies, borrows, and builds here.
            <br /><br />
            <span className="italic">Your voice matters. Your UNIT defines your influence.</span>
          </Body>
        </div>
      </div>

      {/* Voting Info Dropdown */}
      <GovernanceVotingInfoDropdown />
    </DorkFiCard>
  );
};
