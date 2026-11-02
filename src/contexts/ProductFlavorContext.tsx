import { createContext, useContext, type ReactNode } from "react";

type ProductFlavorContextValue = {
  /** Bank-style copy: hide chains, wallets, and DeFi jargon. */
  consumerCopy: boolean;
};

const ProductFlavorContext = createContext<ProductFlavorContextValue>({
  consumerCopy: false,
});

export function ProductFlavorProvider({
  consumerCopy = false,
  children,
}: {
  consumerCopy?: boolean;
  children: ReactNode;
}) {
  return (
    <ProductFlavorContext.Provider value={{ consumerCopy }}>
      {children}
    </ProductFlavorContext.Provider>
  );
}

export function useConsumerCopy(): boolean {
  return useContext(ProductFlavorContext).consumerCopy;
}
