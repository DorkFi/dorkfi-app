import type { ComponentProps } from "react";
import { MoonPayProvider, MoonPaySellWidget } from "@moonpay/moonpay-react";
import { MOONPAY_SELL_BASE_USDC } from "@/lib/easyStart/offrampApi";

type SellWidgetProps = ComponentProps<typeof MoonPaySellWidget>;

interface EasyStartMoonPaySellHostProps {
  apiKey: string;
  evmAddress: string | null;
  amount?: string;
  onClose: () => void;
  onUrlSignatureRequested: NonNullable<
    SellWidgetProps["onUrlSignatureRequested"]
  >;
  onInitiateDeposit: NonNullable<SellWidgetProps["onInitiateDeposit"]>;
}

/**
 * Isolated MoonPay Sell overlay. Mount only while the user is cashing out
 * with MoonPay so `window.MoonPayWebSdk` is not live during Privy fundWallet.
 */
export function EasyStartMoonPaySellHost({
  apiKey,
  evmAddress,
  amount,
  onClose,
  onUrlSignatureRequested,
  onInitiateDeposit,
}: EasyStartMoonPaySellHostProps) {
  return (
    <MoonPayProvider apiKey={apiKey} debug={import.meta.env.DEV}>
      <MoonPaySellWidget
        variant="overlay"
        visible
        baseCurrencyCode={MOONPAY_SELL_BASE_USDC}
        baseCurrencyAmount={amount}
        walletAddress={evmAddress ?? undefined}
        onClose={async () => {
          onClose();
        }}
        onUrlSignatureRequested={onUrlSignatureRequested}
        onInitiateDeposit={onInitiateDeposit}
      />
    </MoonPayProvider>
  );
}
