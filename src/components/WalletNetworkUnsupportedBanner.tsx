import { useWallet } from "@txnlab/use-wallet-react";
import { useNetwork } from "@/contexts/NetworkContext";
import { Button } from "@/components/ui/button";
import { getNetworkConfig } from "@/config";
import {
  getSupportedNetworksForWallet,
  isCurrentNetworkSupportedByWallet,
} from "@/utils/walletNetworkSupport";

/**
 * Banner shown when the connected wallet does not support the current network.
 * Displays a "Switch to [supported network]" button.
 */
export const WalletNetworkUnsupportedBanner = () => {
  const { activeWallet } = useWallet();
  const { currentNetwork, switchNetwork } = useNetwork();

  const supportedNetworks = getSupportedNetworksForWallet(
    activeWallet,
    currentNetwork
  );
  const isSupported = isCurrentNetworkSupportedByWallet(
    activeWallet,
    currentNetwork
  );

  // Only show when wallet is connected and current network is not supported
  if (!activeWallet || isSupported || supportedNetworks.length === 0) {
    return null;
  }

  const targetNetwork = supportedNetworks[0];
  const targetNetworkConfig = getNetworkConfig(targetNetwork);

  return (
    <div className="w-full border-b border-amber-500/30 bg-amber-500/10 dark:bg-amber-900/20 px-4 py-2">
      <div className="max-w-[1200px] mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="text-sm text-foreground">
          Your wallet does not support {getNetworkConfig(currentNetwork).name}.
          Switch to a supported network to use this app.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => switchNetwork(targetNetwork)}
          className="w-fit shrink-0 border-amber-500/50 hover:bg-amber-500/20"
        >
          Switch to {targetNetworkConfig.name}
        </Button>
      </div>
    </div>
  );
};
