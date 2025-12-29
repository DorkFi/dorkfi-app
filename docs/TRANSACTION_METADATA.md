# Transaction Metadata Frontend Integration Guide

## Overview

This guide explains how to use the transaction-metadata POST endpoint to immediately update the application's global state after a transaction is confirmed in the frontend, rather than waiting for background indexing tasks to process it.

## Why Use This Approach?

### Current Flow (Background Indexing)
1. User submits transaction → Transaction confirmed on blockchain
2. Wait for background task (runs every 30 minutes) → Transaction metadata indexed
3. Application state updated → User sees updated data

**Problem**: Users may wait up to 30 minutes before seeing their transaction reflected in the application state.

### Optimized Flow (Frontend Integration)
1. User submits transaction → Transaction confirmed on blockchain
2. Frontend immediately calls transaction-metadata endpoint → Metadata fetched and stored
3. Application state updated immediately → User sees updated data instantly

**Benefit**: Users see updated state immediately after transaction confirmation, providing a much better user experience.

## API Base URLs

- **Production**: `https://dorkfi-api.nautilus.sh`
- **Development**: `http://localhost:3000`

## Endpoint Details

### POST `/transaction-metadata/:transactionId`

Fetches transaction metadata from the Algorand indexer and stores it in the application's metadata store.

**Full URL Examples:**
- Production: `https://dorkfi-api.nautilus.sh/transaction-metadata/{transactionId}`
- Development: `http://localhost:3000/transaction-metadata/{transactionId}`

#### Parameters

**Path Parameter:**
- `transactionId` (required): The transaction ID to fetch and store

**Query Parameter:**
- `network` (optional): Network to search on. Options:
  - `algorand-mainnet`
  - `voi-mainnet`
  
  If not provided, the endpoint will try both networks sequentially (slower).

#### Response

**Success (200):**
```json
{
  "success": true,
  "message": "Transaction metadata successfully fetched and stored",
  "data": {
    "transactionId": "ABC123...",
    "network": "algorand-mainnet",
    "round": 12345678,
    "timestamp": 1234567890000,
    "method": "borrow",
    "args": ["1000000", "0x1234..."],
    "returnValue": "true",
    "sender": "XYZ789...",
    "lastUpdated": 1234567890000
  }
}
```

**Error (400):**
```json
{
  "success": false,
  "error": "Valid transactionId parameter is required"
}
```

**Error (404):**
```json
{
  "success": false,
  "error": "Transaction ABC123... not found on network algorand-mainnet or could not be processed"
}
```

## Implementation Guide

### Step 1: Wait for Transaction Confirmation

After submitting a transaction, wait for it to be confirmed on the blockchain:

```javascript
// Example using AlgoSDK
const waitForConfirmation = async (txId, network) => {
  const algodClient = getAlgodClient(network);
  
  let status = await algodClient.status().do();
  let lastRound = status["last-round"];
  
  while (true) {
    const pendingInfo = await algodClient.pendingTransactionInformation(txId).do();
    
    if (pendingInfo["pool-error"]) {
      throw new Error(`Transaction rejected: ${pendingInfo["pool-error"]}`);
    }
    
    if (pendingInfo["confirmed-round"]) {
      return {
        txId,
        confirmedRound: pendingInfo["confirmed-round"],
        network
      };
    }
    
    await algodClient.statusAfterBlock(lastRound + 1).do();
    lastRound++;
  }
};
```

### Step 2: Call Transaction Metadata Endpoint

Once the transaction is confirmed, immediately call the transaction-metadata endpoint:

```javascript
const updateTransactionMetadata = async (txId, network) => {
  try {
    const apiBaseUrl = process.env.API_BASE_URL || 'https://dorkfi-api.nautilus.sh';
    const networkParam = network ? `?network=${network}` : '';
    
    const response = await fetch(
      `${apiBaseUrl}/transaction-metadata/${txId}${networkParam}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update transaction metadata');
    }
    
    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Error updating transaction metadata:', error);
    // Don't throw - this is a non-critical optimization
    // The background task will eventually pick it up
    return null;
  }
};
```

### Step 3: Complete Integration Example

```javascript
const handleTransactionSubmission = async (transaction, network) => {
  try {
    // 1. Submit transaction
    const txId = await submitTransaction(transaction);
    console.log('Transaction submitted:', txId);
    
    // 2. Wait for confirmation
    const confirmation = await waitForConfirmation(txId, network);
    console.log('Transaction confirmed at round:', confirmation.confirmedRound);
    
    // 3. Immediately update transaction metadata
    const metadata = await updateTransactionMetadata(txId, network);
    
    if (metadata) {
      console.log('Transaction metadata updated:', metadata);
      // 4. Refresh application state
      await refreshApplicationState();
      
      // 5. Show success message to user
      showSuccessMessage('Transaction confirmed and state updated!');
    } else {
      // Fallback: show message that state will update shortly
      showInfoMessage('Transaction confirmed. State will update shortly...');
    }
    
    return { txId, metadata };
  } catch (error) {
    console.error('Transaction error:', error);
    showErrorMessage('Transaction failed: ' + error.message);
    throw error;
  }
};
```

## Best Practices

### 1. Always Specify Network

**Do:**
```javascript
await updateTransactionMetadata(txId, 'algorand-mainnet');
```

**Why:** This avoids trying both networks sequentially, making the call faster.

### 2. Handle Errors Gracefully

The transaction-metadata update is an optimization. If it fails, the background task will eventually process it:

```javascript
try {
  await updateTransactionMetadata(txId, network);
} catch (error) {
  // Log but don't block user flow
  console.warn('Metadata update failed, will be picked up by background task:', error);
}
```

### 3. Add Retry Logic

Sometimes the indexer may not have the transaction immediately after confirmation. Add a small retry:

```javascript
const updateTransactionMetadataWithRetry = async (txId, network, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await updateTransactionMetadata(txId, network);
      if (result) return result;
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    } catch (error) {
      if (i === maxRetries - 1) throw error;
    }
  }
  return null;
};
```

### 4. Update UI State

After successfully updating metadata, refresh the relevant parts of your application:

```javascript
const refreshApplicationState = async () => {
  // Refresh user health
  await fetchUserHealth();
  
  // Refresh pool stats
  await fetchPoolStats();
  
  // Refresh user activity
  await fetchUserActivity();
  
  // Trigger any other state updates
  updateUI();
};
```

## Network Detection

If you're unsure which network to use, you can detect it from the transaction or user context:

```javascript
const detectNetwork = (userAddress, appId) => {
  // Logic to determine network based on:
  // - User's connected wallet network
  // - Application ID
  // - Transaction context
  
  if (appId === ALGORAND_MAINNET_APP_ID) {
    return 'algorand-mainnet';
  } else if (appId === VOI_MAINNET_APP_ID) {
    return 'voi-mainnet';
  }
  
  // Default to trying both (slower)
  return null;
};
```

## Error Scenarios

### Transaction Not Found (404)

This can happen if:
- The transaction was just confirmed and the indexer hasn't indexed it yet
- The transaction ID is incorrect
- The network parameter is wrong

**Solution:** Implement retry logic with exponential backoff.

### Invalid Network (400)

This happens when an invalid network value is provided.

**Solution:** Validate network before making the request.

### Server Error (500)

This indicates a server-side issue.

**Solution:** Log the error and fall back to waiting for background indexing.

## Performance Considerations

### Speed Comparison

- **With network parameter**: ~200-500ms (single network lookup)
- **Without network parameter**: ~400-1000ms (tries both networks)
- **Background task**: Up to 30 minutes delay

### When to Use

✅ **Use this approach for:**
- User-initiated transactions (borrow, supply, repay, etc.)
- Time-sensitive operations
- Real-time UI updates

❌ **Don't use this for:**
- Batch operations (let background task handle)
- Historical transaction backfills
- Non-user-facing transactions

## Example: React Hook

```javascript
import { useState, useCallback } from 'react';

export const useTransactionMetadata = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const updateMetadata = useCallback(async (txId, network) => {
    setLoading(true);
    setError(null);
    
    try {
      const apiBaseUrl = process.env.REACT_APP_API_URL || 'https://dorkfi-api.nautilus.sh';
      const networkParam = network ? `?network=${network}` : '';
      
      const response = await fetch(
        `${apiBaseUrl}/transaction-metadata/${txId}${networkParam}`,
        { method: 'POST' }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update metadata');
      }
      
      const result = await response.json();
      return result.data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);
  
  return { updateMetadata, loading, error };
};
```

## Recommended Integration Points in Application

Based on the codebase analysis, here are the specific locations where the transaction-metadata endpoint should be integrated:

### 1. Supply/Borrow Transactions (`src/components/SupplyBorrowModal.tsx`)

**Location:** After `waitForConfirmation` at line 602

**Current Flow:**
```typescript
await waitForConfirmation(algorandClients.algod, res.txid, 4);
// Then calls fetchFreshUserData and fetchFreshMarketData
```

**Recommended Integration:**
```typescript
await waitForConfirmation(algorandClients.algod, res.txid, 4);

// Immediately update transaction metadata
await updateTransactionMetadata(res.txid, networkToUse).catch(err => {
  console.warn('Metadata update failed, will be picked up by background task:', err);
});

// Then proceed with existing fetchFreshUserData calls
Promise.all([
  dorkfiAPIService.fetchFreshUserData(...),
  dorkfiAPIService.fetchFreshMarketData(...),
])
```

**Why:** Supply and borrow transactions directly affect user health, collateral, and borrowing power. Immediate metadata update ensures users see accurate health metrics right away.

---

### 2. Withdraw Transactions (`src/components/PortfolioModals.tsx`)

**Location:** After `waitForConfirmation` at line 587

**Current Flow:**
```typescript
await waitForConfirmation(algorandClients.algod, res.txid, 4);
console.log("Withdraw transaction confirmed:", res);
// Then calls fetchFreshUserData and fetchFreshMarketData
```

**Recommended Integration:**
```typescript
await waitForConfirmation(algorandClients.algod, res.txid, 4);

// Immediately update transaction metadata
await updateTransactionMetadata(res.txid, networkToUse).catch(err => {
  console.warn('Metadata update failed:', err);
});

console.log("Withdraw transaction confirmed:", res);
// Then proceed with existing refresh calls
```

**Why:** Withdrawals affect user positions and available liquidity. Immediate update prevents confusion about remaining balances.

---

### 3. Repay Transactions (`src/components/PortfolioModals.tsx`)

**Location:** After `waitForConfirmation` at line 795

**Current Flow:**
```typescript
await waitForConfirmation(algorandClients.algod, res.txid, 4);
console.log("Repay transaction confirmed:", res);
// Then calls fetchFreshUserData
```

**Recommended Integration:**
```typescript
await waitForConfirmation(algorandClients.algod, res.txid, 4);

// Immediately update transaction metadata
await updateTransactionMetadata(res.txid, networkToUse).catch(err => {
  console.warn('Metadata update failed:', err);
});

console.log("Repay transaction confirmed:", res);
// Then proceed with existing fetchFreshUserData call
```

**Why:** Repayments directly impact borrowing health and liquidation risk. Users need immediate feedback on their improved position.

---

### 4. PreFi Deposits (`src/pages/PreFi.tsx`)

**Location:** After `waitForConfirmation` at line 1498

**Current Flow:**
```typescript
await waitForConfirmation(algorandClients.algod, res.txid, 4);
console.log("Transaction confirmed:", res);
// Then updates local state optimistically
```

**Recommended Integration:**
```typescript
await waitForConfirmation(algorandClients.algod, res.txid, 4);

// Immediately update transaction metadata
const networkId = isCurrentNetworkVOI() ? 'voi-mainnet' : 'algorand-mainnet';
await updateTransactionMetadata(res.txid, networkId).catch(err => {
  console.warn('Metadata update failed:', err);
});

console.log("Transaction confirmed:", res);
// Then proceed with existing state updates
```

**Why:** PreFi deposits affect reward calculations and qualification status. Immediate update ensures accurate APY estimates and deposit tracking.

---

### 5. Deposit Transactions (`src/components/PortfolioModals.tsx`)

**Location:** In the `onTransactionSuccess` callback around line 878

**Current Flow:**
```typescript
onTransactionSuccess={async () => {
  // Calls fetchFreshUserData after deposit
}}
```

**Recommended Integration:**
```typescript
onTransactionSuccess={async () => {
  // Get transaction ID from the modal state or pass it through callback
  if (transactionId && networkToUse) {
    await updateTransactionMetadata(transactionId, networkToUse).catch(err => {
      console.warn('Metadata update failed:', err);
    });
  }
  
  // Then proceed with existing fetchFreshUserData call
  dorkfiAPIService.fetchFreshUserData(...)
}}
```

**Why:** Deposits affect supply positions and earning calculations. Immediate metadata ensures accurate position tracking.

---

### 6. Mint Transactions (`src/components/MintModal.tsx`)

**Location:** After `waitForConfirmation` at line 357

**Current Flow:**
```typescript
await waitForConfirmation(algorandClients.algod, res.txid, 4);
setTransactionId(res.txid || "Unknown");
setIsLoading(false);
setShowSuccess(true);
```

**Recommended Integration:**
```typescript
await waitForConfirmation(algorandClients.algod, res.txid, 4);

// Immediately update transaction metadata
if (res.txid) {
  await updateTransactionMetadata(res.txid, networkToUse).catch(err => {
    console.warn('Metadata update failed:', err);
  });
}

setTransactionId(res.txid || "Unknown");
setIsLoading(false);
setShowSuccess(true);
```

**Why:** Minting transactions create new positions. Immediate update ensures users see their new assets right away.

---

### 7. Claim and Deposit Transactions (`src/components/MarketsTable.tsx`)

**Location:** After transaction confirmation around line 1406

**Current Flow:**
```typescript
// Wait for confirmation
await new Promise((resolve) => setTimeout(resolve, 3000));
// Then shows success toast
```

**Recommended Integration:**
```typescript
// Wait for confirmation (consider replacing setTimeout with proper waitForConfirmation)
await waitForConfirmation(algorandClients.algod, res.txid, 4);

// Immediately update transaction metadata
await updateTransactionMetadata(res.txid, currentNetwork).catch(err => {
  console.warn('Metadata update failed:', err);
});

// Then proceed with existing success handling
```

**Why:** Combined claim and deposit operations affect both rewards and positions. Immediate update ensures both are reflected accurately.

---

### 8. Liquidation Transactions

**Locations:**
- `src/components/liquidation/EnhancedAccountDetailModal.tsx` (line 309)
- `src/components/liquidation/AccountOverview.tsx` (line 411)

**Recommended Integration:**
```typescript
await algosdk.waitForConfirmation(algorandClients.algod, res.txid, 4);

// Immediately update transaction metadata
await updateTransactionMetadata(res.txid, networkId).catch(err => {
  console.warn('Metadata update failed:', err);
});

// Then proceed with existing liquidation handling
```

**Why:** Liquidations are critical events that significantly change account health. Immediate metadata ensures accurate post-liquidation state.

---

## Implementation Priority

### High Priority (User-Facing Transactions)
1. ✅ **Supply/Borrow** - Most common user actions
2. ✅ **Withdraw** - Directly affects user balances
3. ✅ **Repay** - Critical for health calculations
4. ✅ **Deposit** - Affects position tracking

### Medium Priority (Important but Less Frequent)
5. ✅ **PreFi Deposits** - Affects reward calculations
6. ✅ **Mint** - Creates new positions

### Lower Priority (Edge Cases)
7. ✅ **Claim and Deposit** - Combined operations
8. ✅ **Liquidations** - Less frequent but critical

---

## Helper Function to Create

Create a reusable utility function in `src/utils/transactionUtils.ts`:

```typescript
import { dorkfiAPIService } from '@/services/dorkfiAPIService';

/**
 * Updates transaction metadata immediately after confirmation
 * This is a non-blocking optimization - failures are logged but don't throw
 */
export const updateTransactionMetadata = async (
  txId: string,
  network: string
): Promise<void> => {
  try {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://dorkfi-api.nautilus.sh';
    const networkParam = network ? `?network=${network}` : '';
    
    const response = await fetch(
      `${apiBaseUrl}/transaction-metadata/${txId}${networkParam}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update transaction metadata');
    }
    
    const result = await response.json();
    console.log('Transaction metadata updated:', result.data);
  } catch (error) {
    // Don't throw - this is a non-critical optimization
    // The background task will eventually pick it up
    console.warn('Transaction metadata update failed (will be picked up by background task):', error);
  }
};
```

Then import and use it consistently across all transaction handlers:

```typescript
import { updateTransactionMetadata } from '@/utils/transactionUtils';

// After waitForConfirmation
await updateTransactionMetadata(res.txid, networkToUse);
```

---

## Summary

By calling the transaction-metadata endpoint immediately after transaction confirmation, you can:

1. **Improve UX**: Users see updated state instantly
2. **Reduce latency**: No waiting for background tasks
3. **Better feedback**: Immediate confirmation of transaction processing

Remember to:
- Always specify the network parameter for faster lookups
- Handle errors gracefully (background task is fallback)
- Add retry logic for indexer delays
- Refresh application state after successful update

