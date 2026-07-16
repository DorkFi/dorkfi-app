import { useState } from "react";
import {
  ChevronDown,
  Copy,
  Check,
  LogOut,
  Sparkles,
  CreditCard,
  ArrowRightLeft,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { usePrivyEasyStart } from "@/contexts/PrivySessionProvider";
import { useEasyStartModals } from "@/contexts/EasyStartModalsContext";
import { useEasyStartLogin } from "@/hooks/useEasyStartLogin";

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function EasyStartButton() {
  const openEasyStartLogin = useEasyStartLogin();
  const { login } = usePrivyEasyStart();

  return (
    <Button
      type="button"
      variant="outline"
      className="border-ocean-teal/40 text-ocean-teal hover:bg-ocean-teal/10 font-semibold"
      disabled={!login}
      onClick={() => void openEasyStartLogin()}
    >
      <Sparkles className="mr-2 h-4 w-4" />
      <span className="hidden sm:inline">Get Started</span>
      <span className="sm:hidden">Start</span>
    </Button>
  );
}

export function EasyStartConnectMenu() {
  const privy = usePrivyEasyStart();
  const { openDeposit, openBridge } = useEasyStartModals();
  const { toast } = useToast();

  const [copiedField, setCopiedField] = useState<"evm" | "algo" | null>(null);

  const displayName = privy.displayName ?? "Account";

  const copyValue = async (value: string, field: "evm" | "algo") => {
    await navigator.clipboard.writeText(value);
    setCopiedField(field);
    toast({ title: "Copied to clipboard" });
    setTimeout(() => setCopiedField(null), 1500);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          className="bg-ocean-teal hover:bg-ocean-teal/90 text-white font-semibold"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-xs font-bold mr-2">
            {displayName.charAt(0).toUpperCase()}
          </span>
          <span className="hidden sm:inline max-w-[120px] truncate">
            {displayName}
          </span>
          <ChevronDown className="ml-1 h-4 w-4 opacity-80" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <div className="px-2 py-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            Easy Start
          </p>
          <p className="font-medium truncate">{displayName}</p>
        </div>

        <DropdownMenuSeparator />

        {privy.algorandAddressLoading ? (
          <div className="px-2 py-2 text-xs text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" />
            Deriving Algorand account…
          </div>
        ) : privy.algorandAddress ? (
          <div className="px-2 py-2 space-y-2">
            <div>
              <p className="text-[11px] text-muted-foreground mb-1">
                Algorand account
              </p>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-md bg-muted/50 px-2 py-1.5 text-xs font-mono hover:bg-muted"
                onClick={() => copyValue(privy.algorandAddress!, "algo")}
              >
                <span>{shortAddress(privy.algorandAddress)}</span>
                {copiedField === "algo" ? (
                  <Check className="h-3.5 w-3.5 text-ocean-teal" />
                ) : (
                  <Copy className="h-3.5 w-3.5 opacity-60" />
                )}
              </button>
            </div>
            {privy.evmAddress ? (
              <div>
                <p className="text-[11px] text-muted-foreground mb-1">
                  Signing wallet (EVM)
                </p>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-md bg-muted/50 px-2 py-1.5 text-xs font-mono hover:bg-muted"
                  onClick={() => copyValue(privy.evmAddress!, "evm")}
                >
                  <span>{shortAddress(privy.evmAddress)}</span>
                  {copiedField === "evm" ? (
                    <Check className="h-3.5 w-3.5 text-ocean-teal" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 opacity-60" />
                  )}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={openDeposit}>
          <CreditCard className="mr-2 h-4 w-4" />
          Add USDC
        </DropdownMenuItem>
        <DropdownMenuItem onClick={openBridge}>
          <ArrowRightLeft className="mr-2 h-4 w-4" />
          Move to Algorand
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => void privy.logout?.()}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
