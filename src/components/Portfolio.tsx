import { useState } from "react";
import EnhancedHealthFactor from "./EnhancedHealthFactor";
import DepositsList from "./DepositsList";
import BorrowsList from "./BorrowsList";
import PortfolioModals from "./PortfolioModals";
import DorkFiCard from "@/components/ui/DorkFiCard";
import { H1, Body } from "@/components/ui/Typography";

const Portfolio = () => {
  const [depositModal, setDepositModal] = useState({ isOpen: false, asset: null });
  const [withdrawModal, setWithdrawModal] = useState({ isOpen: false, asset: null });
  const [borrowModal, setBorrowModal] = useState({ isOpen: false, asset: null });
  const [repayModal, setRepayModal] = useState({ isOpen: false, asset: null });

  // Mock portfolio data
  const deposits = [
    { asset: "VOI", icon: "/lovable-uploads/eb092f67-df8a-436b-9ea3-a71f6a1bdf05.png", balance: 1250.0, value: 8750.0, apy: 4.25, tokenPrice: 7.0 },
    { asset: "UNIT", icon: "/lovable-uploads/d5c8e461-2034-4190-89ee-f422760c3e12.png", balance: 500.0, value: 3500.0, apy: 3.85, tokenPrice: 7.0 },
    { asset: "USDC", icon: "/lovable-uploads/17b0dffb-5ea8-4bef-9173-28bb7b41bc06.png", balance: 1500.0, value: 1500.0, apy: 2.15, tokenPrice: 1.0 }
  ];

  const borrows = [
    { asset: "VOI", icon: "/lovable-uploads/eb092f67-df8a-436b-9ea3-a71f6a1bdf05.png", balance: 750.0, value: 5250.25, apy: 8.45, tokenPrice: 7.0 },
    { asset: "UNIT", icon: "/lovable-uploads/d5c8e461-2034-4190-89ee-f422760c3e12.png", balance: 428.6, value: 3000.0, apy: 7.90, tokenPrice: 7.0 },
    { asset: "USDC", icon: "/lovable-uploads/17b0dffb-5ea8-4bef-9173-28bb7b41bc06.png", balance: 800.0, value: 800.0, apy: 4.85, tokenPrice: 1.0 }
  ];

  const healthFactor = 2.45;
  
  // Calculate totals for enhanced health factor component
  const totalCollateral = deposits.reduce((sum, deposit) => sum + deposit.value, 0);
  const totalBorrowed = borrows.reduce((sum, borrow) => sum + borrow.value, 0);
  const liquidationMargin = ((totalCollateral - totalBorrowed) / totalCollateral) * 100;
  const netLTV = (totalBorrowed / totalCollateral) * 100;

  // Mock wallet balances for modals
  const walletBalances = {
    "VOI": 2500,
    "UNIT": 1800,
    "USDC": 5000
  };

  const handleDepositClick = (asset: string) => {
    setDepositModal({ isOpen: true, asset });
  };

  const handleWithdrawClick = (asset: string) => {
    setWithdrawModal({ isOpen: true, asset });
  };

  const handleBorrowClick = (asset: string) => {
    setBorrowModal({ isOpen: true, asset });
  };

  const handleRepayClick = (asset: string) => {
    setRepayModal({ isOpen: true, asset });
  };

  const handleAddCollateral = () => {
    setDepositModal({ isOpen: true, asset: "VOI" });
  };

  const handleBuyVoi = () => {
    console.log("Redirect to VOI purchase");
  };

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <DorkFiCard 
        hoverable
        className="relative text-center overflow-hidden p-6 md:p-8"
      >
        {/* Decorative elements */}
        {/* Birds - light mode only */}
        <div className="absolute top-6 left-10 opacity-80 pointer-events-none z-0 animate-bubble-float dark:hidden hidden md:block" style={{ animationDelay: '0s' }}>
          <img
            src="/lovable-uploads/bird_thinner.png"
            alt="Decorative DorkFi bird - top left"
            className="w-8 h-8 md:w-10 md:h-10 -rotate-6 select-none"
            loading="lazy"
            decoding="async"
          />
        </div>
        <div className="absolute top-14 right-12 opacity-70 pointer-events-none z-0 animate-bubble-float dark:hidden hidden md:block" style={{ animationDelay: '0.5s' }}>
          <img
            src="/lovable-uploads/bird_thinner.png"
            alt="Decorative DorkFi bird - top right"
            className="w-7 h-7 md:w-9 md:h-9 rotate-3 select-none"
            loading="lazy"
            decoding="async"
          />
        </div>
        <div className="absolute bottom-10 left-14 opacity-60 pointer-events-none z-0 animate-bubble-float dark:hidden hidden md:block" style={{ animationDelay: '1s' }}>
          <img
            src="/lovable-uploads/bird_thinner.png"
            alt="Decorative DorkFi bird - bottom left"
            className="w-7 h-7 md:w-9 md:h-9 -rotate-2 select-none"
            loading="lazy"
            decoding="async"
          />
        </div>

        {/* Dark mode gold fish */}
        <div className="absolute top-4 left-8 opacity-80 pointer-events-none z-0 animate-bubble-float hidden dark:md:block" style={{ animationDelay: '0s' }}>
          <img
            src="/lovable-uploads/DorkFi_gold_fish.png"
            alt="Decorative DorkFi gold fish - top left"
            className="w-[2.844844rem] h-[2.844844rem] md:w-[3.793125rem] md:h-[3.793125rem] select-none"
            loading="lazy"
            decoding="async"
          />
        </div>
        <div className="absolute top-12 right-12 opacity-80 pointer-events-none z-0 animate-bubble-float hidden dark:md:block" style={{ animationDelay: '0.5s' }}>
          <img
            src="/lovable-uploads/DorkFi_gold_fish.png"
            alt="Decorative DorkFi gold fish - top right"
            className="w-[1.896563rem] h-[1.896563rem] md:w-[2.844844rem] md:h-[2.844844rem] -scale-x-100 select-none"
            loading="lazy"
            decoding="async"
          />
        </div>
        
        <div className="relative z-10">
          <H1 className="m-0 text-4xl md:text-5xl">
            <span className="hero-header">Portfolio Health</span>
          </H1>
          <Body className="text-sm sm:text-base md:text-lg lg:text-xl max-w-2xl md:max-w-none mx-auto">
            <span className="block md:inline md:whitespace-nowrap">
              Track Your Health Factor, Monitor Your Positions, and Manage Your Portfolio.
            </span>
            <br className="hidden md:block" />
            <span className="block md:inline md:whitespace-nowrap">
              Add collateral or repay if your health factor gets too low.
            </span>
          </Body>
        </div>
      </DorkFiCard>

      <EnhancedHealthFactor
        healthFactor={healthFactor}
        totalCollateral={totalCollateral}
        totalBorrowed={totalBorrowed}
        liquidationMargin={liquidationMargin}
        netLTV={netLTV}
        dorkNftImage="/lovable-uploads/c70b9b34-79c4-491a-b46d-c35bde947c37.png"
        underwaterBg="/lovable-uploads/44ebe994-a30e-4eb1-a4a1-776aa2978776.png"
        onAddCollateral={handleAddCollateral}
        onBuyVoi={handleBuyVoi}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Stack lists vertically on mobile, keep two columns on desktop */}
        <DepositsList
          deposits={deposits}
          onDepositClick={handleDepositClick}
          onWithdrawClick={handleWithdrawClick}
        />
        <BorrowsList
          borrows={borrows}
          onBorrowClick={handleBorrowClick}
          onRepayClick={handleRepayClick}
        />
      </div>

      <PortfolioModals
        depositModal={depositModal}
        withdrawModal={withdrawModal}
        borrowModal={borrowModal}
        repayModal={repayModal}
        deposits={deposits}
        borrows={borrows}
        walletBalances={walletBalances}
        onCloseDepositModal={() => setDepositModal({ isOpen: false, asset: null })}
        onCloseWithdrawModal={() => setWithdrawModal({ isOpen: false, asset: null })}
        onCloseBorrowModal={() => setBorrowModal({ isOpen: false, asset: null })}
        onCloseRepayModal={() => setRepayModal({ isOpen: false, asset: null })}
      />
    </div>
  );
};

export default Portfolio;
