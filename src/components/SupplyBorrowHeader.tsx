
import LpPairIconStack from "@/components/pools/LpPairIconStack";

interface SupplyBorrowHeaderProps {
  mode: "deposit" | "borrow";
  asset: string;
  assetIcon: string;
  assetPairIcons?: { asset1Icon: string; asset2Icon: string };
}

const SupplyBorrowHeader = ({
  mode,
  asset,
  assetIcon,
  assetPairIcons,
}: SupplyBorrowHeaderProps) => {
  return (
    <div className="space-y-2">
      <h2 className="text-2xl font-bold text-center text-slate-800 dark:text-white capitalize">
        {mode === "deposit" ? "supply" : mode}
      </h2>
      <div className="flex items-center justify-center gap-2">
        {assetPairIcons ? (
          <LpPairIconStack
            asset1Icon={assetPairIcons.asset1Icon}
            asset2Icon={assetPairIcons.asset2Icon}
            fallbackIcon={assetIcon}
            alt={asset}
            size="sm"
          />
        ) : (
          <img
            src={assetIcon}
            alt={asset}
            className="w-10 h-10 rounded-full"
          />
        )}
        <span className="text-xl font-bold text-slate-800 dark:text-white">{asset}</span>
      </div>
    </div>
  );
};

export default SupplyBorrowHeader;
