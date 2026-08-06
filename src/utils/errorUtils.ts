/**
 * Converts technical error messages to user-friendly messages
 */

function errorMessageString(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/** Wallet / signer declined the transaction (not a protocol or build failure). */
export function isTransactionUserRejection(error: unknown): boolean {
  const msg = errorMessageString(error).toLowerCase();
  if (
    msg.includes("user rejected") ||
    msg.includes("rejected request") ||
    msg.includes("user cancelled") ||
    msg.includes("user canceled") ||
    msg.includes("user denied") ||
    msg.includes("request rejected") ||
    msg.includes("signing cancelled") ||
    msg.includes("signing canceled") ||
    msg.includes("transaction cancelled") ||
    msg.includes("transaction canceled") ||
    msg.includes("cancelled by user") ||
    msg.includes("canceled by user")
  ) {
    return true;
  }
  const code = (error as { code?: number | string })?.code;
  if (code === 4001 || code === "4001" || code === "ACTION_REJECTED") return true;
  return false;
}

/** Wallet rejected txn list because atomic group structure is invalid (ARC-0001 / Lute 4300). */
export function isInvalidGroupSignError(error: unknown): boolean {
  const msg = errorMessageString(error).toLowerCase();
  if (msg.includes("invalid group")) return true;
  const code = (error as { code?: number | string })?.code;
  if (code === 4300 || code === "4300") return true;
  return (code === 4201 || code === "4201") && msg.includes("group");
}

export type TransactionErrorFeedback = {
  userRejected: boolean;
  message: string;
};

export function getTransactionErrorFeedback(error: unknown): TransactionErrorFeedback {
  const userRejected = isTransactionUserRejection(error);
  return {
    userRejected,
    message: userRejected
      ? "Transaction cancelled in your wallet. You can try again when ready."
      : getUserFriendlyError(error),
  };
}

/**
 * Formats microAlgos to ALGO with proper decimals
 * Shows up to 6 decimal places, removing trailing zeros
 */
function formatAlgo(microAlgos: number): string {
  const algo = microAlgos / 1_000_000;
  // Format with 6 decimals and remove trailing zeros
  return algo.toFixed(6).replace(/\.?0+$/, "") || "0";
}

/**
 * Parses and translates error messages to user-friendly format
 */
export function getUserFriendlyError(error: unknown): string {
  const errorMessage = error instanceof Error ? error.message : String(error);

  if (errorMessage.includes("compatible wallet")) {
    return errorMessage;
  }

  if (errorMessage.includes("insufficient liquidity for withdraw")) {
    return "Insufficient liquidity for withdraw. Please check your deposit and borrow balances, add collateral, or repay debt and try again.";
  }

  if (errorMessage.includes("insufficient collateral for borrow")) {
    return "Insufficient collateral for borrow. Please check your collateral balance, add collateral, or repay debt and try again.";
  }

  // Handle insufficient ALGO balance for transaction fees
  // Format: "transaction ...: account ... balance X below min Y (1 assets)"
  const balanceBelowMinMatch = errorMessage.match(
    /balance\s+(\d+)\s+below\s+min\s+(\d+)\s*\(/
  );
  if (balanceBelowMinMatch) {
    const currentBalance = parseInt(balanceBelowMinMatch[1], 10);
    const minRequired = parseInt(balanceBelowMinMatch[2], 10);
    const currentAlgo = formatAlgo(currentBalance);
    const requiredAlgo = formatAlgo(minRequired);
    const shortfall = formatAlgo(minRequired - currentBalance);

    return `Insufficient ALGO balance for transaction fees. You need at least ${requiredAlgo} ALGO but only have ${currentAlgo} ALGO. Please add at least ${shortfall} ALGO to your wallet.`;
  }

  // Algod overspend when building / simulating groups ("tried to spend …")
  if (errorMessage.toLowerCase().includes("tried to spend")) {
    return "Insufficient ALGO for this transaction (fees and min-balance). Top up a little ALGO and try again.";
  }

  // Handle generic insufficient balance errors
  if (
    errorMessage.toLowerCase().includes("insufficient") &&
    errorMessage.toLowerCase().includes("balance")
  ) {
    return "Insufficient balance for this transaction. Please check your wallet balance and try again.";
  }

  // Handle network/connection errors
  if (
    errorMessage.toLowerCase().includes("network") ||
    errorMessage.toLowerCase().includes("connection") ||
    errorMessage.toLowerCase().includes("fetch")
  ) {
    return "Network connection issue. Please check your internet connection and try again.";
  }

  // Handle gas/fee errors
  if (
    errorMessage.toLowerCase().includes("gas") ||
    errorMessage.toLowerCase().includes("fee")
  ) {
    return "Transaction failed due to insufficient fees. Please ensure you have enough ALGO for transaction fees.";
  }

  // Handle transaction rejection
  if (
    errorMessage.toLowerCase().includes("rejected") ||
    errorMessage.toLowerCase().includes("user cancelled") ||
    errorMessage.toLowerCase().includes("user denied")
  ) {
    return "Transaction was cancelled. No changes were made.";
  }

  // Handle timeout errors
  if (errorMessage.toLowerCase().includes("timeout")) {
    return "Transaction timed out. Please try again.";
  }

  // Handle invalid/malformed transaction errors
  if (
    errorMessage.toLowerCase().includes("invalid") ||
    errorMessage.toLowerCase().includes("malformed")
  ) {
    return "Invalid transaction parameters. Please refresh and try again.";
  }

  // Handle market paused errors
  if (errorMessage.toLowerCase().includes("paused")) {
    return "This market is currently paused. Please try again later.";
  }

  // Handle token not found errors
  if (errorMessage.toLowerCase().includes("token not found")) {
    return "Token configuration not found. Please refresh the page and try again.";
  }

  // Handle liquidity errors
  if (
    errorMessage.toLowerCase().includes("liquidity") &&
    errorMessage.toLowerCase().includes("insufficient")
  ) {
    return "Insufficient liquidity available. Please try a smaller amount or try again later.";
  }

  // Handle transaction already exists errors
  if (
    errorMessage.toLowerCase().includes("already exists") ||
    errorMessage.toLowerCase().includes("duplicate")
  ) {
    return "This transaction has already been submitted. Please wait for confirmation.";
  }

  // Return original message if no specific pattern matches
  return errorMessage;
}
