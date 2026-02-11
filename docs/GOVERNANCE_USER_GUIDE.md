# Governance User Guide

## Overview

The Governance page allows UNIT token holders to participate in the decentralized decision-making process for the DorkFi protocol. You can vote on proposals, track voting power, and participate in batch voting to efficiently manage multiple proposals.

## Table of Contents

1. [What is Governance?](#what-is-governance)
2. [Getting Started](#getting-started)
3. [Understanding Your Voting Power](#understanding-your-voting-power)
4. [Viewing Proposals](#viewing-proposals)
5. [Single Vote](#single-vote)
6. [Batch Voting](#batch-voting)
7. [Proposal Statuses](#proposal-statuses)
8. [Proposal Categories](#proposal-categories)
9. [Adding a New Category (developers)](ADDING_PROPOSAL_CATEGORY.md)
10. [Mobile Usage](#mobile-usage)
11. [Troubleshooting](#troubleshooting)

## What is Governance?

Governance is the process by which UNIT token holders make decisions about the DorkFi protocol. Through governance, you can:

- **Vote on Proposals**: Support or oppose changes to the protocol
- **Influence Decisions**: Your voting power is based on your deposited UNIT token balance and NFT multipliers
- **Shape the Future**: Participate in decisions about interest rates, new markets, treasury allocations, and more

### Key Concepts

- **Voting Power**: Determined by your deposited UNIT token balance and NFT multipliers
- **Proposals**: Formal suggestions for protocol changes
- **Active Proposals**: Proposals currently open for voting

## Getting Started

### 1. Connect Your Wallet

1. Click the **Wallet** button in the top navigation
2. Select your preferred wallet (Pera, Defly, etc.)
3. Approve the connection request in your wallet
4. Ensure you have UNIT tokens in your connected wallet

### 2. Navigate to Governance

1. Click on **Governance** in the main navigation menu
2. You'll see the governance dashboard with:
   - Your voting power
   - Active proposal

### 3. Check Your Voting Power

Your voting power is displayed at the top of the governance page. It's calculated from:
- Your deposited UNIT token balance
- NFT multipliers (if you hold qualifying NFTs)

## Understanding Your Voting Power

### Base Voting Power

Your base voting power equals your **deposited** UNIT token balance. Each deposited UNIT token gives you 1 unit of voting power. Only UNIT that you have deposited into the lending protocol counts—UNIT held in your wallet does not confer voting power.

### NFT Multipliers

If NFT multipliers are enabled, holding certain NFTs can boost your voting power:
- Check the NFT multiplier dropdown to see your current multiplier
- Multipliers are applied automatically when voting
- Your effective voting power is displayed on the dashboard

### Viewing Your Power

- **Dashboard Card**: Shows your total effective voting power
- **Proposal Cards**: Display your voting power when voting
- **Confirmation Modals**: Show how your vote will affect the proposal

## Viewing Proposals

### Filtering Proposals

Use the status tabs to filter proposals:
- **All**: View all proposals regardless of status
- **Active**: Only proposals currently open for voting
- **Passed**: Proposals that received enough support
- **Rejected**: Proposals that didn't pass

### Proposal Information

Each proposal card shows:
- **Title**: Brief description of the proposal
- **Category**: Type of proposal (Interest Rates, Market Listings, etc.)
- **Status**: Current state (Active, Passed, Rejected, etc.)
- **Vote Breakdown**: Percentage and amounts for For/Against votes
- **Time Remaining**: How long until voting ends (for active proposals)

### Proposal Details

Click on a proposal card to see:
- Full proposal description
- Current vote counts
- Your voting history (if you've already voted)
- Time remaining until voting closes

## Single Vote

Voting on a single proposal is straightforward:

### Step 1: Choose Your Vote

1. Find the proposal you want to vote on
2. Click either:
   - **Vote For** (green button) - Support the proposal
   - **Vote Against** (red button) - Oppose the proposal

### Step 2: Confirm Your Vote

1. A confirmation modal will appear showing:
   - Proposal details
   - Your voting power
   - Projected vote impact
2. Review the information carefully
3. Click **Vote For** or **Vote Against** to confirm

### Step 3: Sign Transaction

1. Your wallet will prompt you to sign the transaction
2. Review the transaction details in your wallet
3. Approve the transaction
4. Wait for confirmation (usually a few seconds)

### Step 4: Success

1. A success modal confirms your vote was recorded
2. The proposal card updates to show your vote
3. Vote counts are updated to reflect your participation

### Important Notes

- **One Vote Per Proposal**: You can only vote once per proposal
- **Cannot Change Vote**: Once submitted, your vote is final
- **On-Chain Recording**: All votes are permanently recorded on the blockchain
- **Transaction Fees**: Voting requires a small transaction fee

## Batch Voting

Batch voting allows you to vote on multiple proposals (up to 8) in a single transaction, saving time and gas fees.

### Enabling Batch Mode

1. Toggle **Batch Vote Mode** switch at the top of the proposals list
2. Checkboxes will appear on active proposals
3. Selection counter shows "0/8 selected"

### Selecting Proposals

1. **Individual Selection**: Click the checkbox on each proposal you want to vote on
2. **Select All**: Click "Select All" to select up to 8 active proposals at once
3. **Selection Limit**: You can select a maximum of 8 proposals at a time
4. **Visual Feedback**: Selected proposals are highlighted with a blue ring

### Choosing Vote Directions

For each selected proposal, you must choose a vote direction:

1. Click **For** (green button) to support the proposal
2. Click **Against** (red button) to oppose the proposal
3. Selected vote direction is highlighted
4. You can change your vote direction before submitting

### Submitting Batch Vote

1. Ensure all selected proposals have vote directions chosen
2. The "Vote on X Proposals" button appears when ready
3. Click the button to open the confirmation modal
4. Review the summary:
   - Number of votes (For vs Against)
   - Total voting power being used
   - List of all proposals and their vote directions
5. Click **Cast X Votes** to confirm
6. Sign the transaction in your wallet
7. All votes are submitted in a single transaction

### Batch Voting Tips

- **Plan Ahead**: Review all proposals before selecting
- **Check Directions**: Make sure each proposal has the correct vote direction
- **Selection Limit**: If you have more than 8 proposals, vote in batches
- **Efficiency**: Batch voting saves transaction fees compared to individual votes

### Validation

The system prevents batch voting if:
- No proposals are selected
- Any selected proposal is missing a vote direction
- You'll see a helpful error message indicating what's missing

## Proposal Statuses

Understanding proposal statuses helps you know when you can vote:

### Active
- **Status**: Currently open for voting
- **Action**: You can vote on these proposals
- **Time**: Shows time remaining until voting closes
- **Color**: Blue/primary indicator

### Pending
- **Status**: Created but not yet open for voting
- **Action**: Cannot vote yet, check back later
- **Color**: Gray/muted indicator

### Passed
- **Status**: Received enough votes and support to pass
- **Action**: Voting is closed, proposal will be executed
- **Color**: Green indicator

### Rejected
- **Status**: Did not receive enough support or had more votes against
- **Action**: Voting is closed, proposal will not be executed
- **Color**: Red/destructive indicator

## Proposal Categories

Proposals are organized by category:

### General
- General-purpose or uncategorized proposals
- Examples: "Protocol Update Announcement", "Parameter Review"

### Interest Rates
- Changes to borrowing and lending rates
- Adjustments to rate curves and parameters
- Examples: "Adjust USDC Interest Rate Parameters"

### Market Listings (Collateral Listing)
- Adding new assets as collateral
- Setting collateral factors and liquidation thresholds
- Examples: "Add ALGO as Collateral Asset"

### Liquidation Settings
- Changes to liquidation bonuses and thresholds
- Close factor adjustments
- Examples: "Increase Liquidation Bonus for WBTC"

### Treasury
- Protocol treasury allocations
- Funding for audits, development, or partnerships
- Examples: "Treasury Allocation: Security Audit Fund"

### Features
- New protocol features and capabilities
- Network expansions and integrations
- Examples: "Deploy to Arbitrum Network"

### Infrastructure
- RPC nodes, indexers, tooling, and operational infrastructure
- Examples: "Add New RPC Endpoint", "Indexer Upgrade"

## Mobile Usage

The governance page is fully optimized for mobile devices:

### Touch-Friendly Controls
- All buttons have minimum 44px touch targets
- Checkboxes are larger for easier selection
- Full-width buttons on mobile for easier tapping

### Responsive Layout
- Controls stack vertically on small screens
- Proposal cards adapt to screen size
- Modals are optimized for mobile viewing

### Batch Voting on Mobile
1. Toggle batch mode switch
2. Tap checkboxes to select proposals
3. Tap For/Against buttons for each selected proposal
4. Tap "Vote on X Proposals" when ready
5. Review and confirm in the modal
6. Sign transaction in your wallet app

### Tips for Mobile
- Use landscape mode for better viewing of proposal details
- Scroll through proposals vertically
- Tap and hold on proposal cards to see more details
- Ensure stable internet connection before voting

## Troubleshooting

### Common Issues

#### "Wallet not connected"
- **Solution**: Connect your wallet using the Wallet button in the navigation
- Ensure your wallet is unlocked and connected to the correct network

#### "Insufficient voting power"
- **Solution**: You need deposited UNIT tokens to vote
- Check your deposited UNIT balance (only deposited UNIT counts toward voting power)
- Consider depositing more UNIT tokens or holding qualifying NFTs to increase voting power

#### "Transaction failed"
- **Solution**: 
  - Check your wallet has enough funds for transaction fees
  - Ensure you're connected to the correct network
  - Try again after a few moments
  - Check network congestion

#### "Selection limit reached"
- **Solution**: You can only select 8 proposals at a time
- Deselect some proposals or vote in multiple batches
- The limit helps ensure transaction size stays manageable

#### "Missing vote directions"
- **Solution**: All selected proposals need a vote direction (For or Against)
- Check each selected proposal and choose For or Against
- The system will highlight which proposals need attention

#### "Proposal not found"
- **Solution**: 
  - Refresh the page
  - Check your internet connection
  - Try switching network filters
  - Contact support if the issue persists

### Getting Help

If you encounter issues not covered here:

1. **Check Network Status**: Ensure the blockchain network is operational
2. **Wallet Issues**: Try disconnecting and reconnecting your wallet
3. **Browser**: Try a different browser or clear cache
4. **Support**: Contact DorkFi support with:
   - Your wallet address
   - Transaction ID (if available)
   - Screenshot of the error
   - Steps to reproduce the issue

## Best Practices

### Before Voting

1. **Read Carefully**: Review the full proposal description
2. **Understand Impact**: Consider how the proposal affects the protocol
3. **Check Timing**: Note when voting closes
4. **Verify Power**: Confirm your voting power is correct

### During Voting

1. **Take Your Time**: Don't rush your decisions
2. **Double-Check**: Review your selections before confirming
3. **Batch Efficiently**: Group related proposals for batch voting
4. **Stay Connected**: Keep your wallet connected during the process

### After Voting

1. **Verify**: Check that your vote was recorded correctly
2. **Track Results**: Monitor proposal outcomes
3. **Stay Informed**: Follow proposal discussions and updates

## Additional Resources

- **Protocol Documentation**: Learn more about how governance works
- **Community Forums**: Discuss proposals with other token holders
- **Voting History**: View your past votes and participation
- **Proposal Archive**: Browse historical proposals and outcomes

---

**Note**: This guide is updated regularly. For the latest information, always refer to the governance page interface and official DorkFi documentation.
