import { useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Portfolio from "@/components/Portfolio";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";

const PortfolioPage = () => {
  const [activeTab, setActiveTab] = useState("portfolio");

  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  return (
    <div className="min-h-screen bg-background relative">
      {/* Light Mode Beach Background */}
      <div className="absolute inset-0 light-mode-beach-bg dark:hidden" />
      <div className="absolute inset-0 beach-overlay dark:hidden" />

      {/* Dark Mode Ocean Background */}
      <div className="absolute inset-0 z-0 hidden dark:block dorkfi-dark-bg-with-overlay" />

      <Header activeTab={activeTab} onTabChange={handleTabChange} />

      <main className="max-w-[1200px] mx-auto px-2 sm:px-4 md:px-6 py-2 sm:py-4 md:py-8 relative z-10">
        <div className="space-y-4 sm:space-y-6">
          <AppErrorBoundary label="Portfolio">
            <Portfolio />
          </AppErrorBoundary>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default PortfolioPage;

