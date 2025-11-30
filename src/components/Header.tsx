import { Button } from "@/components/ui/button";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import WalletNetworkButton from "@/components/WalletNetworkButton";
import { useNetwork } from "@/contexts/NetworkContext";
import { getCurrentGasStationSymbols, isFeatureEnabled } from "@/config";
import { useWallet } from "@txnlab/use-wallet-react";

interface HeaderProps {
  activeTab: string;
  onTabChange: (value: string) => void;
}

const Header = ({ activeTab, onTabChange }: HeaderProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { currentNetwork } = useNetwork();
  const { activeAccount } = useWallet();

  const handleTabChange = (value: string) => {
    console.log("Header tab change:", value);
    onTabChange(value);

    if (value === "liquidations") {
      navigate("/liquidation-markets");
    } else if (value === "gas-station") {
      navigate("/gas-station");
    } else {
      navigate("/");
    }
    setIsMobileMenuOpen(false);
  };

  const handleLogoClick = () => {
    onTabChange("dashboard");
    navigate("/");
    setIsMobileMenuOpen(false);
  };

  // Check if current network has gas stations available
  const gasStationSymbols = getCurrentGasStationSymbols();
  const hasGasStation = gasStationSymbols.length > 0;

  const tabs = [
    // { value: 'dashboard', label: 'Dashboard' }, // Temporarily hidden
    ...(isFeatureEnabled("enablePreFi")
      ? [{ value: "prefi", label: "PreFi" }]
      : []),
    { value: "markets", label: "Markets" },
    ...(activeAccount ? [{ value: "portfolio", label: "Portfolio" }] : []),
    ...(isFeatureEnabled("enableLiquidations")
      ? [{ value: "liquidations", label: "Liquidations" }]
      : []),
    //{ value: 'swap', label: 'Swap' },
    ...(isFeatureEnabled("enableGasStation") && hasGasStation
      ? [{ value: "gas-station", label: "Gas Station" }]
      : []),
  ];

  // Hide tabs navigation when only one tab is visible
  const shouldShowTabs = tabs.length > 1;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-white/80 dark:header-nav-bg backdrop-blur-md supports-[backdrop-filter]:bg-white/70 dark:supports-[backdrop-filter]:header-nav-bg shadow-sm dark:shadow-none">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center space-x-3 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => {
              onTabChange("markets");
              setIsMobileMenuOpen(false);
            }}
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
                  console.error("Logo failed to load, using placeholder");
                  (e.currentTarget as HTMLImageElement).src =
                    "/placeholder.svg";
                }}
                onLoad={() => console.log("Logo loaded successfully")}
              />
            </div>
          </Link>

          {/* Desktop and Tablet Navigation */}
          {shouldShowTabs && (
            <div className="hidden md:flex flex-1 justify-center max-w-2xl mx-4 md:mx-6 lg:mx-8">
              <div className="inline-flex h-9 md:h-10 items-center justify-center rounded-md bg-gray-100 dark:bg-muted p-1 text-gray-700 dark:text-muted-foreground w-full">
                {tabs.map((tab, i) => (
                  <Button
                    key={tab.value}
                    variant="ghost"
                    size="sm"
                    onClick={() => handleTabChange(tab.value)}
                    className={`flex-1 inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 md:px-3 py-1.5 text-xs md:text-sm font-medium transition-all ${
                      activeTab === tab.value
                        ? "bg-ocean-teal text-white shadow-sm"
                        : "hover:bg-ocean-teal/10 text-gray-700 dark:text-muted-foreground"
                    }`}
                  >
                    {tab.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Desktop and Tablet Actions */}
          <div className="hidden md:flex items-center gap-2 md:gap-3">
            <WalletNetworkButton />
          </div>

          {/* Mobile Menu Button */}
          {shouldShowTabs ? (
            <div className="flex md:hidden items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden text-gray-700 dark:text-white"
              >
                {isMobileMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </Button>
            </div>
          ) : (
            <div className="flex md:hidden items-center gap-2">
              <WalletNetworkButton />
            </div>
          )}
        </div>

        {/* Mobile Navigation */}
        {shouldShowTabs && isMobileMenuOpen && (
          <div className="md:hidden mt-4 pb-4 border-t border-gray-200 dark:border-border/40 pt-4">
            <div className="space-y-2">
              {tabs.map((tab) => (
                <Button
                  key={tab.value}
                  variant={activeTab === tab.value ? "default" : "ghost"}
                  className={`w-full justify-start ${
                    activeTab === tab.value
                      ? "bg-ocean-teal text-white"
                      : "hover:bg-ocean-teal/10 text-gray-700 dark:text-white"
                  }`}
                  onClick={() => handleTabChange(tab.value)}
                >
                  {tab.label}
                </Button>
              ))}
              <div className="mt-4">
                <WalletNetworkButton />
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
