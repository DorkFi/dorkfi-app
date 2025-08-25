
import { useState } from 'react';

interface WalletAccount {
  address: string;
  name?: string;
}

interface UseWalletReturn {
  activeAccount: WalletAccount | null;
  openWalletModal: () => void;
  disconnect: () => void;
}

export const useWallet = (): UseWalletReturn => {
  const [activeAccount, setActiveAccount] = useState<WalletAccount | null>(null);

  const openWalletModal = () => {
    // Mock wallet connection - in real implementation this would open a wallet selection modal
    console.log('Opening wallet modal...');
    // Simulate wallet connection
    setTimeout(() => {
      setActiveAccount({
        address: 'ALGORAND_MOCK_ADDRESS_123456789ABCDEFGHIJK',
        name: 'Mock Wallet'
      });
    }, 1000);
  };

  const disconnect = () => {
    setActiveAccount(null);
  };

  return {
    activeAccount,
    openWalletModal,
    disconnect
  };
};
