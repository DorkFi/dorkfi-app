import { useNavigate } from "react-router-dom";
import {
  ChevronDown,
  LogOut,
  Sparkles,
  CreditCard,
  ArrowDownToLine,
  Loader2,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePrivyEasyStart } from "@/contexts/PrivySessionProvider";
import { useEasyStartModals } from "@/contexts/easyStartModals";
import { useEasyStartLogin } from "@/hooks/useEasyStartLogin";
import { useEasyStartUserProfile } from "@/hooks/useEasyStartUserProfile";
import { useEasyStartPortfolioTotal } from "@/hooks/useEasyStartPortfolioTotal";
import { useNumberI18n } from "@/contexts/LocaleSettingsContext";

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
  const { openDeposit, openWithdraw } = useEasyStartModals();
  const { formatCurrency } = useNumberI18n();
  const navigate = useNavigate();
  const { displayName, avatar } = useEasyStartUserProfile();
  const {
    totalUsd,
    isLoading: balancesLoading,
    isUnavailable: balancesUnavailable,
    hasAny: hasAnyBalance,
  } = useEasyStartPortfolioTotal();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          className="bg-ocean-teal hover:bg-ocean-teal/90 text-white font-semibold"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-sm mr-2 leading-none">
            {avatar ?? displayName.charAt(0).toUpperCase()}
          </span>
          <span className="hidden sm:inline max-w-[120px] truncate">
            {displayName}
          </span>
          <ChevronDown className="ml-1 h-4 w-4 opacity-80" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <div className="px-2 py-2 space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            Easy Start
          </p>
          <p className="flex items-center gap-2 font-medium truncate">
            {avatar ? (
              <span className="text-base leading-none shrink-0" aria-hidden>
                {avatar}
              </span>
            ) : null}
            <span className="truncate">{displayName}</span>
          </p>

          <div className="pt-1.5">
            {balancesLoading && !hasAnyBalance ? (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading balance…
              </p>
            ) : balancesUnavailable ? (
              <p className="text-sm text-muted-foreground">Balance unavailable</p>
            ) : (
              <>
                <p className="text-xl font-bold tabular-nums text-foreground leading-tight">
                  {formatCurrency(totalUsd, "USD", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                  {balancesLoading ? "…" : ""}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Total balance
                </p>
              </>
            )}
          </div>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={openDeposit}>
          <CreditCard className="mr-2 h-4 w-4" />
          Deposit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={openWithdraw}>
          <ArrowDownToLine className="mr-2 h-4 w-4" />
          Withdraw
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/account")}>
          <UserRound className="mr-2 h-4 w-4" />
          Account
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
