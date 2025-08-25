
import DepositModal from "./DepositModal";
import WithdrawModal from "./WithdrawModal";
import BorrowModal from "./BorrowModal";
import RepayModal from "./RepayModal";

interface Deposit {
  asset: string;
  icon: string;
  balance: number;
  value: number;
  apy: number;
  tokenPrice: number;
}

interface Borrow {
  asset: string;
  icon: string;
  balance: number;
  value: number;
  apy: number;
  tokenPrice: number;
}

interface PortfolioModalsProps {
  depositModal: { isOpen: boolean; asset: string | null };
  withdrawModal: { isOpen: boolean; asset: string | null };
  borrowModal: { isOpen: boolean; asset: string | null };
  repayModal: { isOpen: boolean; asset: string | null };
  deposits: Deposit[];
  borrows: Borrow[];
  walletBalances: Record<string, number>;
  onCloseDepositModal: () => void;
  onCloseWithdrawModal: () => void;
  onCloseBorrowModal: () => void;
  onCloseRepayModal: () => void;
}

const PortfolioModals = ({
  depositModal,
  withdrawModal,
  borrowModal,
  repayModal,
  deposits,
  borrows,
  walletBalances,
  onCloseDepositModal,
  onCloseWithdrawModal,
  onCloseBorrowModal,
  onCloseRepayModal
}: PortfolioModalsProps) => {
  const getMarketStatsForDeposit = (asset: string) => ({
    supplyAPY: deposits.find(d => d.asset === asset)?.apy || 0,
    utilization: 65,
    collateralFactor: 75,
    tokenPrice: deposits.find(d => d.asset === asset)?.tokenPrice || 1
  });

  const getMarketStatsForBorrow = () => ({
    borrowAPY: 8.45,
    liquidationMargin: 43.2,
    healthFactor: 2.45,
    currentLTV: 42.5,
    tokenPrice: 7.0
  });

  return (
    <>
      {depositModal.isOpen && depositModal.asset && (
        <DepositModal
          isOpen={depositModal.isOpen}
          onClose={onCloseDepositModal}
          tokenSymbol={depositModal.asset}
          tokenIcon={deposits.find(d => d.asset === depositModal.asset)?.icon || ""}
          userBalance={walletBalances[depositModal.asset] || 0}
          marketStats={getMarketStatsForDeposit(depositModal.asset)}
        />
      )}

      {withdrawModal.isOpen && withdrawModal.asset && (
        <WithdrawModal
          isOpen={withdrawModal.isOpen}
          onClose={onCloseWithdrawModal}
          tokenSymbol={withdrawModal.asset}
          tokenIcon={deposits.find(d => d.asset === withdrawModal.asset)?.icon || ""}
          currentlyDeposited={deposits.find(d => d.asset === withdrawModal.asset)?.balance || 0}
          marketStats={getMarketStatsForDeposit(withdrawModal.asset)}
        />
      )}

      {borrowModal.isOpen && borrowModal.asset && (
        <BorrowModal
          isOpen={borrowModal.isOpen}
          onClose={onCloseBorrowModal}
          tokenSymbol={borrowModal.asset}
          tokenIcon={borrows.find(b => b.asset === borrowModal.asset)?.icon || ""}
          availableToBorrow={5000}
          marketStats={getMarketStatsForBorrow()}
        />
      )}

      {repayModal.isOpen && repayModal.asset && (
        <RepayModal
          isOpen={repayModal.isOpen}
          onClose={onCloseRepayModal}
          tokenSymbol={repayModal.asset}
          tokenIcon={borrows.find(b => b.asset === repayModal.asset)?.icon || ""}
          currentBorrow={borrows.find(b => b.asset === repayModal.asset)?.balance || 0}
          walletBalance={walletBalances[repayModal.asset] || 0}
          marketStats={getMarketStatsForBorrow()}
        />
      )}
    </>
  );
};

export default PortfolioModals;
