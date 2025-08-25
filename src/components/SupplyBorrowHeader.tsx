
interface SupplyBorrowHeaderProps {
  mode: "deposit" | "borrow";
  asset: string;
  assetIcon: string;
}

const SupplyBorrowHeader = ({ mode, asset, assetIcon }: SupplyBorrowHeaderProps) => {
  return (
    <div className="space-y-4">
      <h2 className="text-3xl font-bold text-center text-slate-800 dark:text-white capitalize">
        {mode}
      </h2>
      <div className="flex items-center justify-center gap-3 pb-2">
        <img 
          src={assetIcon} 
          alt={asset}
          className="w-12 h-12 rounded-full"
        />
        <span className="text-2xl font-bold text-slate-800 dark:text-white">{asset}</span>
      </div>
    </div>
  );
};

export default SupplyBorrowHeader;
