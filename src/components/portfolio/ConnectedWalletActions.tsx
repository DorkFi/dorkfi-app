import { ArrowDownToLine, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEasyStartModals } from "@/contexts/easyStartModals";

/** Add money and Swap for a connected Algorand wallet on the portfolio. */
export function ConnectedWalletActions() {
  const { openDeposit, openSwap } = useEasyStartModals();

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        className="h-11 rounded-xl bg-ocean-teal font-semibold text-white hover:bg-ocean-teal/90"
        onClick={openDeposit}
      >
        <ArrowDownToLine className="mr-2 h-4 w-4" />
        Add money
      </Button>
      <Button
        variant="outline"
        className="h-11 rounded-xl font-semibold"
        onClick={openSwap}
      >
        <ArrowLeftRight className="mr-2 h-4 w-4" />
        Swap
      </Button>
    </div>
  );
}
