# Pool Migration Configuration

This document provides operational instructions for configuring pool migration in the DorkFi application. Migration allows users to transfer deposits from old lending pools to new lending pools through an atomic transaction.

## Overview

Pool migration is configured at the token level in the application configuration. When a token has migration configuration, the UI automatically detects users with balances in the old pool and displays a migration button.

### Migration Flow

1. **Balance Detection**: System checks user's balance in old pool's nToken contract
2. **UI Display**: Migration button appears when balance > 0
3. **Transaction Execution**: Atomic transaction group withdraws from old pool and deposits to new pool
4. **State Update**: Market data refreshes after successful migration

## Configuration Structure

### TokenConfig Interface

Migration configuration is added to the `TokenConfig` interface in `src/config/index.ts`:

```typescript
export interface TokenConfig {
  // ... existing properties
  migration?: {
    poolId: string;      // Old lending pool application ID
    contractId: string;  // Old token contract ID (same as new contractId typically)
    nTokenId: string;    // Old nToken contract ID
  };
}
```

### Migration Properties

- **`poolId`**: The application ID of the old lending pool from which users will withdraw
- **`contractId`**: The contract ID of the token in the old pool (usually same as current `contractId`)
- **`nTokenId`**: The nToken contract ID in the old pool that holds user deposits

## Setup Procedure

### Step 1: Identify Migration Requirements

Before adding migration configuration, gather the following information:

1. **Old Pool Details**:
   - Old lending pool application ID
   - Old token contract ID
   - Old nToken contract ID

2. **New Pool Details** (already in token config):
   - New lending pool application ID (`poolId`)
   - New token contract ID (`contractId`)
   - New nToken contract ID (`nTokenId`)

3. **Network**: Determine which network this migration applies to (Voi Mainnet or Algorand Mainnet)

### Step 2: Locate Token Configuration

Navigate to `src/config/index.ts` and find the token configuration:

- **Voi Mainnet**: Look in `prodTokens` object (around line 482)
- **Algorand Mainnet**: Look in `algorandProdTokens` object (around line 1156)

### Step 3: Add Migration Configuration

Add the `migration` property to the token configuration object:

```typescript
// Example: VOI token on Voi Mainnet
VOI: {
  assetId: "0",
  poolId: "47139778",           // New pool ID
  contractId: "41877720",       // Token contract ID
  nTokenId: "47139789",         // New nToken ID
  migration: {                  // Add this block
    poolId: "41760711",         // Old pool ID
    contractId: "41877720",     // Old contract ID (usually same)
    nTokenId: "42125195",       // Old nToken ID
  },
  decimals: 6,
  name: "VOI",
  symbol: "VOI",
  // ... rest of config
}
```

### Step 4: Verify Configuration

Ensure the following:

1. **All IDs are strings**: All pool, contract, and nToken IDs must be strings
2. **Contract ID consistency**: Old `contractId` should match new `contractId` (same token)
3. **Network match**: Migration config is in the correct network's token object
4. **No syntax errors**: Proper comma placement and object structure

## Configuration Examples

### Voi Mainnet Examples

#### VOI Token Migration

```typescript
VOI: {
  assetId: "0",
  poolId: "47139778",           // New pool
  contractId: "41877720",
  nTokenId: "47139789",         // New nToken
  migration: {
    poolId: "41760711",         // Old pool
    contractId: "41877720",     // Same contract
    nTokenId: "42125195",       // Old nToken
  },
  decimals: 6,
  name: "VOI",
  symbol: "VOI",
  tokenStandard: "network",
  // ... other properties
}
```

#### aUSDC Token Migration

```typescript
aUSDC: {
  assetId: "302190",
  poolId: "47139778",           // New pool
  contractId: "395614",
  nTokenId: "47140315",          // New nToken
  migration: {
    poolId: "41760711",         // Old pool
    contractId: "395614",       // Same contract
    nTokenId: "42577758",       // Old nToken
  },
  decimals: 6,
  name: "Aramid USDC",
  symbol: "aUSDC",
  tokenStandard: "asa",
  // ... other properties
}
```

#### UNIT Token Migration

```typescript
UNIT: {
  contractId: "420069",
  poolId: "47139778",           // New pool
  nTokenId: "47148525",         // New nToken
  migration: {
    contractId: "420069",      // Same contract
    poolId: "41760711",        // Old pool
    nTokenId: "42638644",      // Old nToken
  },
  decimals: 8,
  name: "UNIT",
  symbol: "UNIT",
  tokenStandard: "arc200",
  // ... other properties
}
```

### Algorand Mainnet Examples

#### ALGO Token Migration

```typescript
ALGO: {
  assetId: "0",
  poolId: "3333688282",         // New pool
  contractId: "3207744109",
  nTokenId: "3333724131",       // New nToken
  migration: {
    poolId: "3207735602",       // Old pool
    contractId: "3207744109",   // Same contract
    nTokenId: "3209220112",     // Old nToken
  },
  decimals: 6,
  name: "Algorand",
  symbol: "ALGO",
  tokenStandard: "network",
  // ... other properties
}
```

#### USDC Token Migration

```typescript
USDC: {
  assetId: "31566704",
  poolId: "3333688282",         // New pool
  contractId: "3210682240",
  nTokenId: "3333764003",       // New nToken
  migration: {
    poolId: "3207735602",       // Old pool
    contractId: "3210682240",   // Same contract
    nTokenId: "3210686647",     // Old nToken
  },
  decimals: 6,
  name: "USD Coin",
  symbol: "USDC",
  tokenStandard: "asa",
  // ... other properties
}
```

## Validation Requirements

### Required Fields

All three migration properties are required:

- ✅ `poolId`: Must be a valid application ID string
- ✅ `contractId`: Must be a valid contract ID string
- ✅ `nTokenId`: Must be a valid contract ID string

### Data Validation

The system validates migration configuration at runtime:

1. **Existence Check**: `tokenConfig?.migration` must exist
2. **Balance Check**: User must have balance > 0 in old nToken contract
3. **Market Validation**: Both old and new markets must exist and be accessible
4. **Pause Check**: New market must not be paused

### Common Validation Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "No migration config found" | `migration` property missing | Add migration object to token config |
| "Token config not found" | Token not in config for network | Verify token exists in correct network config |
| "No balance to migrate" | User has no balance in old pool | This is expected - migration button won't show |
| "New market is paused" | Destination market is paused | Wait for market to be unpaused |

## Testing Migration Configuration

### Manual Testing Steps

1. **Add Configuration**: Add migration config to token in `src/config/index.ts`
2. **Build Application**: Run `npm run build` or `npm run dev`
3. **Connect Wallet**: Connect wallet with balance in old pool
4. **Navigate to Markets**: Go to markets page
5. **Verify Button**: Check if migration button appears for token
6. **Test Migration**: Click button and complete migration flow
7. **Verify Result**: Check that balance moved to new pool

### Testing Checklist

- [ ] Migration config added to correct network token object
- [ ] All three migration properties present (poolId, contractId, nTokenId)
- [ ] All IDs are strings (not numbers)
- [ ] No TypeScript compilation errors
- [ ] Migration button appears when user has old pool balance
- [ ] Migration button does not appear when user has no old pool balance
- [ ] Migration transaction executes successfully
- [ ] Balance correctly moves from old pool to new pool
- [ ] Market data refreshes after migration

### Testing with Different Scenarios

1. **User with Balance**: Should see migration button
2. **User without Balance**: Should not see migration button
3. **Multiple Tokens**: Test with multiple tokens having migration config
4. **Network Switching**: Verify migration works on correct network only
5. **Error Cases**: Test with invalid IDs, paused markets, etc.

## Current Migration Configurations

### Voi Mainnet

The following tokens currently have migration configuration:

| Token | Old Pool ID | Old Contract ID | Old nToken ID | New Pool ID | New Contract ID | New nToken ID |
|-------|-------------|-----------------|---------------|-------------|-----------------|---------------|
| VOI | 41760711 | 41877720 | 42125195 | 47139778 | 41877720 | 47139789 |
| aUSDC | 41760711 | 395614 | 42577758 | 47139778 | 395614 | 47140315 |
| UNIT | 41760711 | 420069 | 42638644 | 47139778 | 420069 | 47148525 |

### Algorand Mainnet

The following tokens currently have migration configuration:

| Token | Old Pool ID | Old Contract ID | Old nToken ID | New Pool ID | New Contract ID | New nToken ID |
|-------|-------------|-----------------|---------------|-------------|-----------------|---------------|
| ALGO | 3207735602 | 3207744109 | 3209220112 | 3333688282 | 3207744109 | 3333724131 |
| USDC | 3207735602 | 3210682240 | 3210686647 | 3333688282 | 3210682240 | 3333764003 |
| UNIT | 3207735602 | 3220125024 | 3220137925 | 3333688282 | 3220125024 | 3333783429 |

## Removing Migration Configuration

### When to Remove

Migration configuration should be removed when:

1. **Migration Period Ended**: All users have migrated or migration deadline passed
2. **Old Pool Deprecated**: Old pool is no longer accessible
3. **No More Balances**: No users have balances in old pool

### Removal Procedure

1. **Locate Config**: Find token in `src/config/index.ts`
2. **Remove Property**: Delete the `migration` object
3. **Verify**: Ensure no syntax errors
4. **Test**: Verify migration button no longer appears
5. **Deploy**: Deploy updated configuration

### Example Removal

```typescript
// Before
VOI: {
  poolId: "47139778",
  contractId: "41877720",
  nTokenId: "47139789",
  migration: {                    // Remove this block
    poolId: "41760711",
    contractId: "41877720",
    nTokenId: "42125195",
  },
  // ... rest of config
}

// After
VOI: {
  poolId: "47139778",
  contractId: "41877720",
  nTokenId: "47139789",
  // migration property removed
  // ... rest of config
}
```

## Troubleshooting

### Configuration Not Working

**Issue**: Migration button doesn't appear despite having config

**Solutions**:
1. Verify migration object syntax is correct
2. Check that all three properties are present
3. Ensure you're on the correct network
4. Verify user has balance in old pool's nToken contract
5. Check browser console for errors

### TypeScript Errors

**Issue**: TypeScript compilation fails after adding migration

**Solutions**:
1. Verify migration object matches `TokenConfig` interface
2. Check for missing commas in object
3. Ensure all IDs are strings (not numbers)
4. Run `npm run build` to see specific errors

### Migration Button Appears Incorrectly

**Issue**: Button appears when it shouldn't or doesn't appear when it should

**Solutions**:
1. Check balance detection logic in UI components
2. Verify nToken ID is correct
3. Check network configuration
4. Verify token symbol matches between config and UI

## Best Practices

1. **Document Changes**: Document why migration is needed and when it was added
2. **Test Thoroughly**: Test on testnet before mainnet deployment
3. **Verify IDs**: Double-check all pool, contract, and nToken IDs
4. **Monitor Usage**: Track migration usage to determine when to remove config
5. **Coordinate Deployment**: Coordinate with backend/pool changes
6. **User Communication**: Inform users about migration availability
7. **Remove When Done**: Clean up migration config after migration period

## Related Files

- **Configuration**: `src/config/index.ts` - Token configuration
- **Migration Service**: `src/services/lendingService.ts` - Migration execution logic
- **UI Components**: 
  - `src/components/MarketsTable.tsx` - Main migration handler
  - `src/components/markets/MarketsDesktopTable.tsx` - Desktop table migration display
  - `src/components/markets/MarketsTabletTable.tsx` - Tablet table migration display
  - `src/components/markets/MarketCardView.tsx` - Card view migration display
  - `src/components/markets/MarketsTableActions.tsx` - Migration button component

## Summary

Pool migration configuration is straightforward:

1. **Add `migration` object** to token config with old pool details
2. **Verify configuration** matches expected structure
3. **Test** that migration button appears and works correctly
4. **Remove** when migration period ends

The system automatically handles balance detection, UI display, and transaction execution once configuration is in place.

---

*This documentation covers the operational setup of pool migration. For user-facing documentation, refer to the user guide.*
