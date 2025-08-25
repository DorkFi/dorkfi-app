
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { LiquidationAccount } from '@/hooks/useLiquidationData';
import AccountHeader from './AccountHeader';
import HealthFactorGauge from './HealthFactorGauge';
import PositionSummary from './PositionSummary';
import AssetList from './AssetList';

interface AccountDetailModalProps {
  account: LiquidationAccount;
  isOpen: boolean;
  onClose: () => void;
  isMobile: boolean;
}

export default function AccountDetailModal({ 
  account, 
  isOpen, 
  onClose, 
  isMobile 
}: AccountDetailModalProps) {
  const ModalContent = () => (
    <div className="space-y-4">
      <AccountHeader account={account} />
      <HealthFactorGauge healthFactor={account.healthFactor} />
      <PositionSummary account={account} />
      <AssetList 
        title="Collateral Assets" 
        assets={account.collateralAssets} 
        colorScheme="collateral" 
      />
      <AssetList 
        title="Borrowed Assets" 
        assets={account.borrowedAssets} 
        colorScheme="borrowed" 
      />
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={onClose}>
        <DrawerContent className="h-[95vh] flex flex-col">
          <DrawerHeader className="flex-shrink-0 text-left pb-2 border-b border-border">
            <DrawerTitle>Account Details</DrawerTitle>
            <DrawerDescription>
              Detailed position information for this borrower
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-6 pt-4">
            <ModalContent />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[95vh] rounded-xl border border-gray-200/50 dark:border-ocean-teal/20 shadow-xl card-hover hover:shadow-lg hover:border-ocean-teal/40 transition-all p-0 flex flex-col">
        <DialogHeader className="flex-shrink-0 p-6 pb-2 border-b border-border">
          <DialogTitle>Account Details</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto p-6 pt-4">
          <ModalContent />
        </div>
      </DialogContent>
    </Dialog>
  );
}
