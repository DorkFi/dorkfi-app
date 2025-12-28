# Claim Functionality Setup Guide

This guide explains how to set up and configure the claim functionality in the DorkFi PreFi frontend.

## Overview

The claim system allows users to claim rewards (typically VOI tokens) that have been allocated to them. The system uses ARC200 token standards and checks for claimable balances using the `arc200_allowance` method, which represents tokens that can be transferred from an airdrop account to the user's wallet.

## How It Works

1. **Reward Detection**: The system automatically checks for claimable rewards when a wallet is connected
2. **Balance Checking**: Uses `ARC200Service.getAllowance()` to check if the airdrop account has approved tokens for the user
3. **Claim Process**: When claiming, the system:
   - Transfers approved tokens from the airdrop account to the user's wallet
   - Supports multiple rewards in a single transaction group
   - Can optionally deposit claimed tokens directly into a market

## Configuration

### Adding a New Reward

To add a new reward that users can claim, edit the `rewards` array in `src/components/MarketsTable.tsx`:

```typescript
const rewards = [
  {
    id: 1, // Unique identifier for this reward
    name: "Prefi Incentive", // Display name
    description: "5M VOI DorkFi Prefi Incentive", // Description shown in UI
    reward: 5_000_000, // Total reward amount (for display purposes)
    icon: "/lovable-uploads/VOI.png", // Path to token icon
    airdropAccount: "PORY6TDWT5B7YIJY36NSMY3DKIIH4TAEY35NUFCQRT7QMU66NUSZHLP6VA", // Account holding the rewards
    tokenStandard: "network", // Token standard: "network", "asa", or "arc200"
    networks: {
      "algorand-mainnet": {
        contractId: "3210709899", // ARC200 contract ID on Algorand
        assetId: "2320775407", // Optional: Asset ID if applicable
      },
      "voi-mainnet": {
        contractId: "41877720", // ARC200 contract ID on Voi
        // assetId is optional for network tokens
      },
    },
    symbol: "VOI", // Token symbol
    decimals: 6, // Token decimals
  },
  // Add more rewards here
];
```

### Required Fields

- **id**: Unique numeric identifier (must be unique across all rewards)
- **name**: Display name for the reward
- **airdropAccount**: The Algorand address that holds the rewards and approves them for users
- **tokenStandard**: One of:
  - `"network"` - Native network token (VOI, ALGO)
  - `"asa"` - Algorand Standard Asset
  - `"arc200"` - ARC200 token standard
- **networks**: Object mapping network IDs to their contract/asset configuration
  - Each network must have a `contractId` (the ARC200 contract application ID)
  - `assetId` is optional and only needed for ASAs
- **symbol**: Token symbol (e.g., "VOI", "USDC")
- **decimals**: Number of decimal places (typically 6 for VOI, 6 for USDC, 8 for UNIT)

### Network Configuration

The `networks` object must include entries for each network where the reward is available. Supported network IDs:
- `"voi-mainnet"` - Voi mainnet
- `"algorand-mainnet"` - Algorand mainnet
- `"voi-testnet"` - Voi testnet (if applicable)
- `"algorand-testnet"` - Algorand testnet (if applicable)

Each network entry requires:
- **contractId**: The ARC200 smart contract application ID
- **assetId**: (Optional) Only needed for ASA tokens

## How the Claim Process Works

### 1. Reward Detection (Automatic)

The system automatically checks for claimable rewards when:
- A wallet is connected (`activeAccount?.address` changes)
- The network changes (`currentNetwork` changes)

The check uses `ARC200Service.getAllowance()` to query the airdrop account's approval for the user's address:

```typescript
const balance = await ARC200Service.getAllowance(
  reward.airdropAccount,  // From: airdrop account
  activeAccount.address,   // To: user's address
  contractId              // Contract ID
);
```

If the allowance is greater than 0, the reward is marked as claimable.

### 2. Claim Transaction

When a user clicks "Claim Rewards", the system:

1. **Validates**:
   - Wallet is connected
   - There are claimable rewards
   - Not already claiming (prevents double-claims)

2. **Builds Transactions**:
   - For each claimable reward, creates an `arc200_transferFrom` transaction
   - Transfers from `airdropAccount` to `activeAccount.address`
   - Groups all transactions together

3. **Signs and Sends**:
   - User signs the transaction group
   - Transactions are sent to the network
   - Success/error notifications are shown

### 3. Direct Deposit Option

Users can also claim and deposit in one action:
- Claims all rewards
- Immediately deposits the claimed amount into a selected market
- All in a single transaction group

## Testing the Claim Setup

### 1. Verify Reward Configuration

Check that your reward configuration is correct:
- Contract IDs are valid for each network
- Airdrop account address is correct
- Token decimals match the actual token

### 2. Test on Testnet First

Before deploying to mainnet:
1. Add testnet network configurations
2. Deploy test contracts
3. Set up test airdrop account with approvals
4. Test the full claim flow

### 3. Verify Airdrop Account Setup

The airdrop account must:
- Hold the reward tokens
- Have approved users via `arc200_approve` method
- The approval amount should be the claimable amount for each user

### 4. Check Console Logs

The system logs helpful debug information:
- `"Reward X is claimable: Y Z"` - Shows detected claimable rewards
- `"No contract ID found for reward X on network Y"` - Configuration issue
- `"Error fetching balance for reward X"` - Network or contract issue

## Common Issues and Solutions

### Issue: Rewards Not Detected

**Possible Causes:**
1. Contract ID is incorrect for the current network
2. Airdrop account hasn't approved tokens for the user
3. Network mismatch (reward configured for different network)

**Solutions:**
- Verify contract IDs match the deployed contracts
- Check that `arc200_approve` was called on the airdrop account
- Ensure you're on the correct network

### Issue: Claim Transaction Fails

**Possible Causes:**
1. Insufficient balance in airdrop account
2. Approval amount is 0
3. Network congestion or RPC issues

**Solutions:**
- Verify airdrop account has sufficient balance
- Check approval amounts using `arc200_allowance`
- Retry the transaction

### Issue: Wrong Token Amount Claimed

**Possible Causes:**
1. Decimals mismatch
2. Approval amount is different than expected

**Solutions:**
- Verify `decimals` field matches the actual token
- Check the actual approval amount on-chain

## Example: Adding a New Reward

Here's a complete example of adding a new USDC reward:

```typescript
const rewards = [
  {
    id: 1,
    name: "Prefi Incentive",
    description: "5M VOI DorkFi Prefi Incentive",
    reward: 5_000_000,
    icon: "/lovable-uploads/VOI.png",
    airdropAccount: "PORY6TDWT5B7YIJY36NSMY3DKIIH4TAEY35NUFCQRT7QMU66NUSZHLP6VA",
    tokenStandard: "network",
    networks: {
      "algorand-mainnet": {
        contractId: "3210709899",
        assetId: "2320775407",
      },
      "voi-mainnet": {
        contractId: "41877720",
      },
    },
    symbol: "VOI",
    decimals: 6,
  },
  {
    id: 2, // New reward
    name: "USDC Bonus",
    description: "Early adopter USDC bonus",
    reward: 100_000,
    icon: "/lovable-uploads/USDC.webp",
    airdropAccount: "YOUR_AIRDROP_ACCOUNT_ADDRESS_HERE",
    tokenStandard: "arc200", // USDC is ARC200
    networks: {
      "algorand-mainnet": {
        contractId: "YOUR_USDC_CONTRACT_ID", // ARC200 contract ID
      },
      "voi-mainnet": {
        contractId: "YOUR_VOI_USDC_CONTRACT_ID",
      },
    },
    symbol: "USDC",
    decimals: 6,
  },
];
```

## UI Components

The claim functionality is integrated into:
- **MarketsTable Component**: Main table showing markets with a "Claim Rewards" button
- **Claim Modal**: Modal dialog that shows:
  - Available rewards breakdown
  - Total claimable amount
  - Claim button
  - Direct deposit option
  - Success/error messages

## Security Considerations

1. **Airdrop Account Security**: The airdrop account must be secure and properly managed
2. **Approval Limits**: Consider setting approval limits per user to prevent over-claiming
3. **Network Verification**: Always verify contract IDs and network configurations
4. **Transaction Validation**: The system validates all transactions before sending

## Related Files

- `src/components/MarketsTable.tsx` - Main component with claim logic
- `src/services/arc200Service.ts` - ARC200 token interaction service
- `src/config/index.ts` - Network and token configurations

## Next Steps

1. Configure your reward in the `rewards` array
2. Set up the airdrop account with proper approvals
3. Test on testnet
4. Deploy to mainnet
5. Monitor claim transactions

---

*For questions or issues, refer to the main documentation or contact the development team.*

