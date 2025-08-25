
interface BorrowHeaderProps {
  tokenSymbol: string;
  tokenIcon: string;
}

const BorrowHeader = ({ tokenSymbol, tokenIcon }: BorrowHeaderProps) => {
  return (
    <>
      <h2 className="text-2xl font-bold text-center text-slate-800 dark:text-white">
        Borrow
      </h2>
      <p className="text-center mt-1 text-sm text-slate-400 dark:text-slate-400">
        Enter the amount to borrow. Your available limit and key statistics are shown below.
      </p>
      <div className="flex items-center justify-center gap-3 pb-2 mt-3">
        <img 
          src={tokenIcon} 
          alt={tokenSymbol}
          className="w-12 h-12 rounded-full shadow"
        />
        <span className="text-xl font-semibold text-slate-800 dark:text-white">{tokenSymbol}</span>
      </div>
    </>
  );
};

export default BorrowHeader;
