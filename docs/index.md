# DorkFi PreFi Documentation

Welcome to the DorkFi PreFi documentation! This comprehensive guide will help you understand and use the PreFi platform effectively.

## What is PreFi?

PreFi is DorkFi's pre-launch deposit program that allows early supporters to earn VOI rewards by pre-depositing into upcoming lending markets. It's a non-custodial, on-chain tracking system that rewards users based on their deposit amount and time until launch.

## Documentation Overview

### 📖 [User Guide](USER_GUIDE_PREFI.md)
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

### 📊 [APY Estimation Strategy](APY_ESTIMATION.md)
**Technical documentation on how APY calculations work**

Deep dive into the APY calculation methodology:
- Reward allocation by deposit caps
- Normalization layers for user-friendly display
- Risk and market adjustments
- Fallback strategies
- Real-time update mechanisms

**Perfect for:** Developers, advanced users, those interested in the technical details of reward calculations

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

**Perfect for:** Developers, contributors, those working with the codebase

## Quick Start Guide

### For New Users
1. **Start Here**: Read the [User Guide](USER_GUIDE_PREFI.md) to understand how PreFi works
2. **Connect Wallet**: Use the wallet connection feature to get started
3. **Make Deposits**: Choose markets and start earning VOI rewards
4. **Monitor Progress**: Track your deposits and qualification status
5. **Understand Totals**: Review the [Total Deposits Guide](TOTAL_DEPOSITS.md) to understand how deposit tracking works

### For Developers
1. **Technical Details**: Review [APY Estimation Strategy](APY_ESTIMATION.md) for calculation methods
2. **Version Control**: Check [Version Management](VERSION_MANAGEMENT.md) for development setup
3. **Codebase**: Explore the React/TypeScript frontend implementation

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

## Contributing

If you're interested in contributing to the PreFi frontend:
1. Review the version management documentation
2. Set up the development environment
3. Follow the established coding patterns
4. Test your changes thoroughly

---

*This documentation is actively maintained and updated as the PreFi platform evolves. For the latest information, always refer to the most recent version of these guides.*
