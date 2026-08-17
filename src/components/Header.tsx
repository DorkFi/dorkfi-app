import { Button } from "@/components/ui/button";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useState, useEffect } from "react";
import WalletNetworkButton from "@/components/WalletNetworkButton";
import { WalletNetworkUnsupportedBanner } from "@/components/WalletNetworkUnsupportedBanner";
import { LocaleNumberSettings } from "@/components/LocaleNumberSettings";
import { useNetwork } from "@/contexts/NetworkContext";
import { getGasStationSymbols, isFeatureEnabled } from "@/config";
import { useWallet } from "@txnlab/use-wallet-react";

interface HeaderProps {
  activeTab?: string;
  onTabChange?: (value: string) => void;
}

const Header = ({ activeTab, onTabChange }: HeaderProps = {}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { currentNetwork } = useNetwork();
  const { activeAccount } = useWallet();

  // Determine activeTab from location if not provided
  const gasStationEnabled = isFeatureEnabled("enableGasStation");
  const liquidationsEnabled = isFeatureEnabled("enableLiquidations");

  const currentActiveTab = activeTab || (() => {
    if (location.pathname === "/pools") return "pools";
    if (location.pathname === "/analytics") return "analytics";
    if (
      liquidationsEnabled &&
      location.pathname === "/liquidation-markets"
    ) {
      return "liquidations";
    }
    if (gasStationEnabled && location.pathname === "/gas-station") {
      return "gas-station";
    }
    if (location.pathname === "/governance") return "governance";
    if (location.pathname === "/portfolio" || location.pathname.startsWith("/portfolio/")) return "portfolio";
    if (location.pathname === "/bets") return "bets";
    if (location.pathname === "/market") return "markets";
    return "markets";
  })();

  const handleTabChange = (value: string) => {
    console.log("Header tab change:", value);
    if (onTabChange) {
      onTabChange(value);
    }

    if (liquidationsEnabled && value === "liquidations") {
      navigate("/liquidation-markets");
    } else if (gasStationEnabled && value === "gas-station") {
      navigate("/gas-station");
    } else if (value === "analytics") {
      navigate("/analytics");
    } else if (value === "governance") {
      navigate("/governance");
    } else if (value === "pools") {
      navigate("/pools");
    } else if (value === "portfolio") {
      navigate("/portfolio");
    } else if (value === "markets") {
      navigate("/market");
    } else if (value === "bets") {
      navigate("/bets");
    } else {
      navigate("/");
    }
    setIsMobileMenuOpen(false);
  };

  const handleLogoClick = () => {
    if (onTabChange) {
      onTabChange("dashboard");
    }
    navigate("/");
    setIsMobileMenuOpen(false);
  };

  // Sync activeTab with current route
  useEffect(() => {
    if (onTabChange) {
      if (location.pathname === "/analytics") {
        onTabChange("analytics");
      } else if (
        liquidationsEnabled &&
        location.pathname === "/liquidation-markets"
      ) {
        onTabChange("liquidations");
      } else if (gasStationEnabled && location.pathname === "/gas-station") {
        onTabChange("gas-station");
      } else if (location.pathname === "/governance") {
        onTabChange("governance");
      } else if (location.pathname === "/pools") {
        onTabChange("pools");
      } else if (location.pathname === "/portfolio" || location.pathname.startsWith("/portfolio/")) {
        onTabChange("portfolio");
      } else if (location.pathname === "/market") {
        onTabChange("markets");
      } else if (location.pathname === "/bets") {
        onTabChange("bets");
      }
    }
  }, [gasStationEnabled, liquidationsEnabled, location.pathname, onTabChange]);

  const hasGasStation =
    gasStationEnabled &&
    getGasStationSymbols(currentNetwork).length > 0;

  const tabs = [
    // { value: 'dashboard', label: 'Dashboard' }, // Temporarily hidden
    ...(isFeatureEnabled("enablePreFi")
      ? [{ value: "prefi", label: "PreFi" }]
      : []),
    { value: "markets", label: "Markets" },
    ...(isFeatureEnabled("enablePools")
      ? [{ value: "pools", label: "Pools" }]
      : []),
    ...(activeAccount ? [{ value: "portfolio", label: "Portfolio" }] : []),
    ...(liquidationsEnabled
      ? [{ value: "liquidations", label: "Liquidations" }]
      : []),
    { value: "analytics", label: "Analytics" },
    ...(isFeatureEnabled("enableGovernance")
      ? [{ value: "governance", label: "Governance" }]
      : []),
    //{ value: 'swap', label: 'Swap' },
    ...(hasGasStation ? [{ value: "gas-station", label: "Gas Station" }] : []),
    // Prototype desk — farthest right; content served from localhost:8503
    { value: "bets", label: "Bets" },
  ];

  // Hide tabs navigation when only one tab is visible
  const shouldShowTabs = tabs.length > 1;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-white/80 dark:header-nav-bg backdrop-blur-md supports-[backdrop-filter]:bg-white/70 dark:supports-[backdrop-filter]:header-nav-bg shadow-sm dark:shadow-none">
      <WalletNetworkUnsupportedBanner />
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link
            to="/market"
            className="flex items-center space-x-3 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => {
              if (onTabChange) {
                onTabChange("markets");
              }
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
            <div className="hidden md:flex flex-1 justify-center max-w-3xl lg:max-w-4xl mx-4 md:mx-6 lg:mx-8">
              <div className="inline-flex h-9 md:h-10 items-center justify-center rounded-md bg-gray-100 dark:bg-muted p-1 text-gray-700 dark:text-muted-foreground w-full">
                {tabs.map((tab, i) => (
                  <Button
                    key={tab.value}
                    variant="ghost"
                    size="sm"
                    onClick={() => handleTabChange(tab.value)}
                    className={`flex-1 inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 md:px-3 py-1.5 text-xs md:text-sm font-medium transition-all ${
                      currentActiveTab === tab.value
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
            <LocaleNumberSettings />
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
                  variant={currentActiveTab === tab.value ? "default" : "ghost"}
                  className={`w-full justify-start ${
                    currentActiveTab === tab.value
                      ? "bg-ocean-teal text-white"
                      : "hover:bg-ocean-teal/10 text-gray-700 dark:text-white"
                  }`}
                  onClick={() => handleTabChange(tab.value)}
                >
                  {tab.label}
                </Button>
              ))}
              <div className="mt-4 flex items-center gap-2">
                <LocaleNumberSettings />
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
