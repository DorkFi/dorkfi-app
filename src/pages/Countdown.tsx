import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, Clock, Rocket, Star, Waves, ShoppingCart } from "lucide-react";

import WalletNetworkButton from "@/components/WalletNetworkButton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { useWallet } from "@txnlab/use-wallet-react";

const LAUNCH_TIMESTAMP = Date.UTC(2025, 8, 13, 0, 29, 0); // Sep 12, 2025 5:29 PM PDT

interface TimeUnit {
  value: number;
  label: string;
}

function CountdownCard({ value, label }: TimeUnit) {
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center w-full h-[96px] sm:h-[120px] md:h-[152px] min-w-0"
    >
      <Card className="w-full h-full bg-card/80 backdrop-blur-sm border-border/50 shadow-lg hover:shadow-xl transition-all duration-300 card-hover">
        <CardContent className="p-4 sm:p-6 text-center h-full flex flex-col items-center justify-center">
          <motion.div
            key={value}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3 }}
            className="text-3xl sm:text-4xl md:text-6xl font-bold text-white mb-2 leading-none"
          >
            {value.toString().padStart(2, '0')}
          </motion.div>
          <div className="text-xs sm:text-sm md:text-base font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
            {label}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}


export default function CountdownPage() {
  const [timeLeft, setTimeLeft] = useState(LAUNCH_TIMESTAMP - Date.now());
  const [isBuyModalOpen, setIsBuyModalOpen] = useState(false);
  const { activeAccount } = useWallet();

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(LAUNCH_TIMESTAMP - Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const getTimeUnits = (): TimeUnit[] => {
    if (timeLeft <= 0) {
      return [
        { value: 0, label: "Days" },
        { value: 0, label: "Hours" },
        { value: 0, label: "Minutes" },
        { value: 0, label: "Seconds" },
      ];
    }

    const seconds = Math.floor(timeLeft / 1000);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    return [
      { value: days, label: "Days" },
      { value: hours, label: "Hours" },
      { value: minutes, label: "Minutes" },
      { value: remainingSeconds, label: "Seconds" },
    ];
  };

  const timeUnits = getTimeUnits();
  const isLaunched = timeLeft <= 0;

  return (
    <div className="min-h-screen bg-background relative overflow-x-hidden md:overflow-hidden flex flex-col">
      {/* Background Images */}
      <div 
        className="absolute inset-0 z-0 bg-no-repeat bg-top md:bg-center bg-[length:100%_auto] md:bg-cover"
        style={{
          backgroundImage: `url('/lovable-uploads/6c65a97f-e84e-4b36-8ba5-38b0208e9bc5.png')`
        }}
      />
      {/* Dark overlay */}
      <div className="absolute inset-0 z-0 bg-black/40" />

      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 header-nav-bg backdrop-blur-md supports-[backdrop-filter]:header-nav-bg shadow-sm dark:shadow-none">
        <div className="container mx-auto px-4 py-3 md:py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link 
              to="/" 
              className="flex items-center space-x-3 cursor-pointer hover:opacity-80 transition-opacity"
              aria-label="Go to DorkFi dashboard"
            >
              <div className="flex flex-col">
                <img 
                  src="/lovable-uploads/dork_fi_logo_edit1_light.png" 
                  alt="DorkFi logo" 
                  className="h-8 sm:h-9 md:h-10 lg:h-11 w-auto object-contain flex-shrink-0" 
                  fetchPriority="high"
                  decoding="async"
                  onError={(e) => {
                    console.error('Logo failed to load, using placeholder');
                    (e.currentTarget as HTMLImageElement).src = '/placeholder.svg';
                  }}
                />
              </div>
            </Link>
            
            {/* Wallet and Buy Button */}
            <div className="flex items-center gap-2">
              {activeAccount?.address && (
                <button
                  className="p-2 rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors"
                  onClick={() => {
                    console.log("Buy tokens clicked from countdown navigation");
                    setIsBuyModalOpen(true);
                  }}
                  title="Buy Tokens"
                >
                  <ShoppingCart className="h-5 w-5" />
                </button>
              )}
              <WalletNetworkButton />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex items-start md:items-center justify-center py-6 sm:py-8 pt-[25vh] sm:pt-[20vh] md:pt-0">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-4xl mx-auto">
            {/* Hero Section */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="mb-6 sm:mb-8"
            >
              <h1 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-bold mb-4 sm:mb-6">
                <span className="text-white">Liquidity is Coming...</span>
              </h1>
            </motion.div>

            {/* Countdown Display */}
            {!isLaunched ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="mb-6 sm:mb-8"
              >
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-8 items-stretch max-w-[360px] sm:max-w-2xl md:max-w-3xl mx-auto">
                  {timeUnits.map((unit, index) => (
                    <CountdownCard
                      key={unit.label}
                      value={unit.value}
                      label={unit.label}
                    />
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8 }}
                className="mb-6 sm:mb-8"
              >
                <div className="text-6xl md:text-8xl font-bold whale-gradient mb-6">
                  🚀 LAUNCHED! 🚀
                </div>
                <p className="text-xl text-muted-foreground">
                  PreFi is now live! Welcome to the future of DeFi.
                </p>
              </motion.div>
            )}

            {/* PreFi Information Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.8 }}
              className="max-w-3xl mx-auto"
            >
              <Card className="bg-card/80 backdrop-blur-sm border-border/50 shadow-lg">
                <CardContent className="p-5 sm:p-8 text-left">
                  <p className="text-muted-foreground mb-6 leading-relaxed text-justify text-sm sm:text-base">
                    PreFi begins at 5:29 pm PST (4:20+69) on September 12th, the one year anniversary of Voi Mainnet launch. This is DorkFi's pre-launch deposit program, and your opportunity to get in and lock yield early. From the creation of the PreFi Deposit until Mainnet launch, users can lock in early support for lending markets and be rewarded for doing so.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center py-4">
        <div className="container mx-auto px-4">
          <p className="text-muted-foreground text-sm">
            © 2025 DorkFi Protocol. Dive into the depths of DeFi.
          </p>
        </div>
      </footer>

      {/* Buy Modal */}
      <Dialog open={isBuyModalOpen} onOpenChange={setIsBuyModalOpen}>
        <DialogContent className="bg-card dark:bg-slate-900 rounded-xl border border-gray-200/50 dark:border-ocean-teal/20 shadow-xl card-hover hover:shadow-lg hover:border-ocean-teal/40 transition-all max-w-lg px-0 py-0">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-card-foreground">
                Buy VOI Tokens
              </h2>
            </div>
            <div className="text-sm text-muted-foreground mb-4">
              Purchase VOI tokens directly through our integrated widget
            </div>
            <div className="flex justify-center">
              <iframe
                src={`https://ibuyvoi.com/widget?destination=${
                  activeAccount?.address || "VOI_WALLET_ADDRESS"
                }&theme=auto`}
                width="480"
                height="600"
                frameBorder="0"
                style={{ borderRadius: "16px" }}
                title="VOI Purchase Widget"
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}