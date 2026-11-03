/** Stand-in for Privy's optional `@solana-program/system` peer.
 * This app does not use Solana wallets. Vite 8 still type-checks the named
 * import inside Privy and fails the build when the package is absent.
 */
export function getTransferSolInstruction(): never {
  throw new Error(
    "@solana-program/system is not installed. Install Solana peer dependencies if you use Solana wallets.",
  );
}
