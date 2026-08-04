import { createContext, useContext } from "react";

export type EasyStartModalsContextValue = {
  openDeposit: () => void;
  openWithdraw: () => void;
  /** Advanced Base ↔ Algorand USDC move via XO Swap (escape hatch). */
  openBridge: () => void;
};

export const EasyStartModalsContext =
  createContext<EasyStartModalsContextValue | null>(null);

export function useEasyStartModals(): EasyStartModalsContextValue {
  const ctx = useContext(EasyStartModalsContext);
  if (!ctx) {
    return {
      openDeposit: () => {
        console.warn("EasyStartModalsProvider is not mounted");
      },
      openWithdraw: () => {
        console.warn("EasyStartModalsProvider is not mounted");
      },
      openBridge: () => {
        console.warn("EasyStartModalsProvider is not mounted");
      },
    };
  }
  return ctx;
}
