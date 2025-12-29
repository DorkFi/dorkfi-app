/**
 * Updates transaction metadata immediately after confirmation
 * This is a non-blocking optimization - failures are logged but don't throw
 * The background task will eventually pick up the transaction if this fails
 * 
 * @param txId - The transaction ID to fetch and store
 * @param network - Network identifier (e.g., 'algorand-mainnet', 'voi-mainnet'). Optional but recommended for faster lookups.
 * @returns Promise that resolves when metadata is updated (or fails silently)
 */
export const updateTransactionMetadata = async (
  txId: string,
  network?: string
): Promise<void> => {
  try {
    const apiBaseUrl =
      import.meta.env.VITE_DORKFI_API_URL || "https://dorkfi-api.nautilus.sh";
    const networkParam = network ? `?network=${network}` : "";

    const response = await fetch(
      `${apiBaseUrl}/transaction-metadata/${txId}${networkParam}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to update transaction metadata");
    }

    const result = await response.json();
    console.log("Transaction metadata updated:", result.data);
  } catch (error) {
    // Don't throw - this is a non-critical optimization
    // The background task will eventually pick it up
    console.warn(
      "Transaction metadata update failed (will be picked up by background task):",
      error
    );
  }
};

/**
 * Updates transaction metadata with retry logic until it succeeds
 * Retries with exponential backoff until the update is successful
 * 
 * @param txId - The transaction ID to fetch and store
 * @param network - Network identifier (e.g., 'algorand-mainnet', 'voi-mainnet'). Optional but recommended for faster lookups.
 * @param maxRetries - Maximum number of retries (default: 10)
 * @param initialDelay - Initial delay in milliseconds (default: 1000)
 * @returns Promise that resolves when metadata is successfully updated
 */
export const updateTransactionMetadataWithRetry = async (
  txId: string,
  network?: string,
  maxRetries: number = 10,
  initialDelay: number = 1000
): Promise<void> => {
  const apiBaseUrl =
    import.meta.env.VITE_DORKFI_API_URL || "https://dorkfi-api.nautilus.sh";
  const networkParam = network ? `?network=${network}` : "";

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(
        `${apiBaseUrl}/transaction-metadata/${txId}${networkParam}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update transaction metadata");
      }

      const result = await response.json();
      console.log("Transaction metadata updated successfully:", result.data);
      return; // Success, exit retry loop
    } catch (error) {
      const isLastAttempt = attempt === maxRetries - 1;
      
      if (isLastAttempt) {
        console.error(
          `Transaction metadata update failed after ${maxRetries} attempts:`,
          error
        );
        // On final failure, still don't throw to avoid blocking user flow
        // The background task will eventually pick it up
        return;
      }

      // Exponential backoff: delay increases with each attempt
      const delay = initialDelay * Math.pow(2, attempt);
      console.warn(
        `Transaction metadata update attempt ${attempt + 1} failed, retrying in ${delay}ms:`,
        error
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

