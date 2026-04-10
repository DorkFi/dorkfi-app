# DorkFi PreFi Documentation

Welcome to the DorkFi PreFi documentation! This comprehensive guide will help you understand and use the PreFi platform effectively.

## What is PreFi?

PreFi is DorkFi's pre-launch deposit program that allows early supporters to earn VOI rewards by pre-depositing into upcoming lending markets. It's a non-custodial, on-chain tracking system that rewards users based on their deposit amount and time until launch.

## Documentation Overview

### 📖 [User Guide](prefi/USER_GUIDE_PREFI.md)
**Complete user manual for PreFi platform**

The comprehensive user guide covers everything you need to know about using PreFi:
- Getting started with wallet connection
- Understanding the dashboard and market cards
- Making deposits and withdrawals
- Reward calculations and APY estimates
- Qualification requirements
- Troubleshooting common issues
- Security features and best practices

**Perfect for:** New users, existing users looking for detailed information, troubleshooting help

### 📦 [PreFi documentation (index)](prefi/index.md)
**Catalog of PreFi guides in this repo**

- [PreFi User Guide](prefi/USER_GUIDE_PREFI.md): participant-facing manual (dashboard, deposits, rewards, troubleshooting)
- [APY Estimation Strategy](prefi/APY_ESTIMATION.md): allocation by deposit caps, normalization, risk adjustments, fallbacks, live updates
- [Pool migration configuration](prefi/POOL_MIGRATION.md): token-level migration config, old pool / nToken wiring, atomic migration UX

**Perfect for:** Finding all PreFi docs in one place; developers and operators tuning rewards, APY display, and product behavior

### 💰 [Total Deposits Guide](TOTAL_DEPOSITS.md)
**Comprehensive guide to understanding total deposits in PreFi**

Detailed explanation of how total deposits work in the platform:
- Your personal total deposits across all markets
- Market-level total deposits and capacity limits
- Cross-network aggregation and global competition
- Real-time updates and technical implementation
- Troubleshooting common deposit-related issues

**Perfect for:** Users wanting to understand deposit tracking, developers working with deposit data, those analyzing market capacity

### 🔄 [Version Management](VERSION_MANAGEMENT.md)
**Development documentation for version control**

Information about the automatic version management system:
- How version display works
- Automatic version incrementing
- Setup and configuration
- Manual version control options
- Deeper overview: [Versioning System Overview](VERSIONING_SYSTEM.md) (build flow, `prebuild`, scripts)
- Bootstrap / template: [Version implementation prompt](VERSION_IMPLEMENTATION_PROMPT.md) (for implementing similar version tracking in another Vite app)

**Perfect for:** Developers, contributors, those working with the codebase

### 🔀 [Workflows](workflows/index.md)
**Contributor procedures (fork, PR, and related tasks)**

Indexed guides for repeatable processes:
- Forking and opening pull requests with GitHub CLI (`gh`)
- Placeholder-based steps that apply to any upstream repo and branch

**Perfect for:** Contributors who push from a fork, anyone onboarding to the repo’s GitHub workflow

### 🛠️ [Development documentation](development/index.md)
**Frontend architecture and feature deep-dives**

Indexed implementation references (pages, services, cross-network behavior):
- [Gas Station](development/GAS_STATION.md): minting flow, `GasStationService`, ARC200/ASA/network tokens on Voi and Algorand

**Perfect for:** Developers extending the Gas Station, multi-network minting, or similar app features

### 🔗 [ARC200 Exchange Extension](ARC200_EXCHANGE.md)
**Technical specification for ARC200 token exchange standard**

Complete specification for the ARC200 Exchange Extension:
- Bidirectional exchange between ARC200 tokens and ASAs
- Interface definitions and method signatures
- Security considerations and validation requirements
- Implementation requirements and backward compatibility
- Use cases and future considerations

**Perfect for:** Developers implementing token standards, smart contract developers, DeFi protocol builders

### 🎁 [Claim setup (workflow)](workflows/SETUP_NEW_CLAIM.md)
**Configure reward claim functionality in this frontend**

Step-by-step workflow (same content area as a standalone claim guide):
- How the claim system works and ARC200 allowance
- Adding rewards in `MarketsTable` and network configuration
- Testing, troubleshooting, and security considerations

**Perfect for:** Developers setting up rewards, administrators managing airdrops, those implementing claim functionality

### ⚡ [Transaction Metadata Integration](TRANSACTION_METADATA.md)
**Frontend integration guide for immediate transaction state updates**

Complete guide for integrating the transaction-metadata endpoint to update application state immediately after transaction confirmation:
- Why use frontend integration vs background indexing
- API endpoint details and usage
- Step-by-step implementation guide
- Best practices and error handling
- Performance considerations
- React hook examples

**Perfect for:** Frontend developers, those implementing real-time transaction updates, developers optimizing user experience

### 🗳️ [Governance documentation (index)](governance/index.md)
**Catalog of governance guides in this repo**

- [Governance User Guide](governance/GOVERNANCE_USER_GUIDE.md): UNIT voting power, proposals, single and batch voting, statuses, categories, mobile, troubleshooting

**Perfect for:** UNIT holders using Governance, anyone reviewing how proposals appear in the UI; use the index to find all governance docs in one place

### 🏷️ [Adding a governance proposal category (workflow)](workflows/ADD_PROPOSAL_CATEGORY_TO_GOVERNANCE.md)
**Wire a new on-chain category ID through the frontend**

Types, constants, labels, Admin UI, proposal cards, and badge colors (requires contract support for the new category ID).

**Perfect for:** Developers adding or changing governance proposal categories

### 🛡️ [Health Factor Calculation](HEALTH_FACTOR_CALCULATION.md)
**How health factor is computed for lending positions**

Collateral vs liquidation threshold, user-level and network-level formulas, and related implementation notes.

**Perfect for:** Developers working on portfolio, borrow/repay, or liquidation-related UI and logic

### 📐 [Asset Decimals and Display](ASSET_DECIMALS_AND_DISPLAY.md)
**Reference for balance/amount decimals and withdraw modal USD consistency**

How the frontend handles token decimals and deposited value display:
- Showing up to 8 decimals for assets (e.g. goBTC) on portfolio and withdraw
- Using the deposit’s network (not current network) for token price in the withdraw modal so USD matches the Supplied Assets table
- Where token decimals are applied (WithdrawModal, DepositsList, Supplied Assets table, etc.)
- Oracle price scale and adding new amount displays

**Perfect for:** Developers touching balance/amount formatting, withdraw flow, or multi-network portfolio display

### ✅ [Portfolio Withdraw Flow – Verification](PORTFOLIO_WITHDRAW_FLOW_VERIFICATION.md)
**QA / verification report for the portfolio withdraw flow**

Recorded checks for withdraw modal (desktop and mobile), supplied/borrowed actions, quick actions, and related regressions.

**Perfect for:** QA, reviewers validating withdraw UX parity with the test plan, developers tracing modal wiring

## Quick Start Guide

### For New Users
1. **Start Here**: Read the [User Guide](prefi/USER_GUIDE_PREFI.md) to understand how PreFi works
2. **Connect Wallet**: Use the wallet connection feature to get started
3. **Make Deposits**: Choose markets and start earning VOI rewards
4. **Monitor Progress**: Track your deposits and qualification status
5. **Understand Totals**: Review the [Total Deposits Guide](TOTAL_DEPOSITS.md) to understand how deposit tracking works

### For Developers
1. **Technical Details**: Review [PreFi documentation](prefi/index.md) and [APY Estimation Strategy](prefi/APY_ESTIMATION.md) for calculation methods
2. **Version Control**: Check [Version Management](VERSION_MANAGEMENT.md) for development setup
3. **Forks & PRs**: See [Workflows](workflows/index.md) for fork and pull-request steps with GitHub CLI
4. **Feature deep-dives**: See [Development documentation](development/index.md) for architecture guides (e.g. Gas Station)
5. **Token Standards**: Review [ARC200 Exchange Extension](ARC200_EXCHANGE.md) for token exchange specifications
6. **Claim Setup**: Follow [Claim setup (workflow)](workflows/SETUP_NEW_CLAIM.md) to configure reward claims
7. **Transaction Updates**: Review [Transaction Metadata Integration](TRANSACTION_METADATA.md) for real-time state updates
8. **Governance**: Read the [Governance User Guide](governance/GOVERNANCE_USER_GUIDE.md) (see [Governance documentation](governance/index.md)); to add a category, use [Adding a governance proposal category](workflows/ADD_PROPOSAL_CATEGORY_TO_GOVERNANCE.md)
9. **Health Factor**: See [Health Factor Calculation](HEALTH_FACTOR_CALCULATION.md) for position safety math
10. **Asset Decimals & Withdraw Value**: See [Asset Decimals and Display](ASSET_DECIMALS_AND_DISPLAY.md) for balance/amount formatting and withdraw modal USD consistency
11. **Withdraw flow QA**: See [Portfolio Withdraw Flow – Verification](PORTFOLIO_WITHDRAW_FLOW_VERIFICATION.md) for the recorded verification pass
12. **Codebase**: Explore the React/TypeScript frontend implementation

## Key Features

### 🎯 **Cross-Network Support**
- **Algorand Network**: Traditional Algorand-based tokens (ALGO, aUSD, etc.)
- **Voi Network**: VOI-based tokens and assets
- **Unified Rewards**: All networks compete for the same 5M VOI reward pool

### 💰 **Reward System**
- **Total Pool**: 5,000,000 VOI tokens
- **Time-Weighted**: Rewards based on amount × time until launch
- **Fair Distribution**: Global competition across all networks
- **Dynamic Allocation**: Market shares based on actual USD deposits

### 🔒 **Security & Transparency**
- **Non-Custodial**: Your deposits remain in your wallet
- **On-Chain Tracking**: All transactions visible on blockchain
- **Real-Time Updates**: Live price and balance updates
- **Qualification Tracking**: Clear progress indicators

## Supported Markets

### Voi Network Markets
- **VOI** - Native Voi token
- **aUSD** - Algorand USD stablecoin
- **UNIT** - Governance token
- **BTC** - Bitcoin (bridged)
- **ETH** - Ethereum (bridged)
- **ALGO** - Algorand token
- **POW** - Power token

### Algorand Network Markets
- **USDC** - USD Coin
- **ALGO** - Algorand
- **VOI** - Voi token
- **UNIT** - Governance token
- **POW** - Power token
- **TINY** - Community token
- **COMPX** - Community token
- **FINITE** - Community token

## Important Dates

- **Launch Date**: September 12, 2025 at 5:29 PM PDT
- **Phase 0 Duration**: From now until launch
- **Reward Distribution**: After mainnet launch

## Getting Help

### Common Resources
- **User Guide**: Comprehensive step-by-step instructions
- **Total Deposits**: Understanding deposit tracking and calculations
- **Troubleshooting**: Common issues and solutions
- **APY Calculations**: Understanding reward estimates
- **Security**: Best practices and safety tips

### Support Channels
- Check the troubleshooting section in the User Guide
- Review the technical documentation for advanced questions
- Contact official DorkFi support channels

## Technology Stack

This frontend is built with modern web technologies:
- **React 18** - User interface framework
- **TypeScript** - Type-safe JavaScript
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - High-quality component library
- **Algorand SDK** - Blockchain integration
- **React Query** - Data fetching and caching

## Testing

Unit tests use [Vitest](https://vitest.dev/) (Jest-compatible API). Run them locally:

- `npm run test` — run all tests once
- `npm run test:watch` — run tests in watch mode

The **Test** GitHub Action (`.github/workflows/test.yml`) runs on push/PR to `main` and `next`: it runs `npm run test` and `npm run lint`. New tests live alongside source (e.g. `src/utils/__tests__/assetDecimals.test.ts`). See `vitest.config.ts` for exclusions (e.g. config-dependent service tests).

## Contributing

If you're interested in contributing to the PreFi frontend:
1. Review the version management documentation
2. If you contribute via a fork, follow [Workflows: Fork and open a PR](workflows/FORK_AND_PR.md)
3. Set up the development environment
4. Follow the established coding patterns
5. Run `npm run test` and fix any failures before opening a PR

---

*This documentation is actively maintained and updated as the PreFi platform evolves. For the latest information, always refer to the most recent version of these guides.*
