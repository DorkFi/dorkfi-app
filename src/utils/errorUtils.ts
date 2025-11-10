/**
 * Converts technical error messages to user-friendly messages
 */

/**
 * Formats microAlgos to ALGO with proper decimals
 * Shows up to 6 decimal places, removing trailing zeros
 */
function formatAlgo(microAlgos: number): string {
  const algo = microAlgos / 1_000_000;
  // Format with 6 decimals and remove trailing zeros
  return algo.toFixed(6).replace(/\.?0+$/, '') || '0';
}

/**
 * Parses and translates error messages to user-friendly format
 */
export function getUserFriendlyError(error: unknown): string {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
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
  
  // Handle generic insufficient balance errors
  if (errorMessage.toLowerCase().includes('insufficient') && 
      errorMessage.toLowerCase().includes('balance')) {
    return "Insufficient balance for this transaction. Please check your wallet balance and try again.";
  }
  
  // Handle network/connection errors
  if (errorMessage.toLowerCase().includes('network') || 
      errorMessage.toLowerCase().includes('connection') ||
      errorMessage.toLowerCase().includes('fetch')) {
    return "Network connection issue. Please check your internet connection and try again.";
  }
  
  // Handle gas/fee errors
  if (errorMessage.toLowerCase().includes('gas') || 
      errorMessage.toLowerCase().includes('fee')) {
    return "Transaction failed due to insufficient fees. Please ensure you have enough ALGO for transaction fees.";
  }
  
  // Handle transaction rejection
  if (errorMessage.toLowerCase().includes('rejected') || 
      errorMessage.toLowerCase().includes('user cancelled') ||
      errorMessage.toLowerCase().includes('user denied')) {
    return "Transaction was cancelled. No changes were made.";
  }
  
  // Handle timeout errors
  if (errorMessage.toLowerCase().includes('timeout')) {
    return "Transaction timed out. Please try again.";
  }
  
  // Handle invalid/malformed transaction errors
  if (errorMessage.toLowerCase().includes('invalid') || 
      errorMessage.toLowerCase().includes('malformed')) {
    return "Invalid transaction parameters. Please refresh and try again.";
  }
  
  // Handle market paused errors
  if (errorMessage.toLowerCase().includes('paused')) {
    return "This market is currently paused. Please try again later.";
  }
  
  // Handle token not found errors
  if (errorMessage.toLowerCase().includes('token not found')) {
    return "Token configuration not found. Please refresh the page and try again.";
  }
  
  // Handle liquidity errors
  if (errorMessage.toLowerCase().includes('liquidity') && 
      errorMessage.toLowerCase().includes('insufficient')) {
    return "Insufficient liquidity available. Please try a smaller amount or try again later.";
  }
  
  // Handle transaction already exists errors
  if (errorMessage.toLowerCase().includes('already exists') ||
      errorMessage.toLowerCase().includes('duplicate')) {
    return "This transaction has already been submitted. Please wait for confirmation.";
  }
  
  // Return original message if no specific pattern matches
  return errorMessage;
}

