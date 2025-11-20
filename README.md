# DorkFi Protocol

DorkFi is a decentralized, non-custodial borrow/lend protocol built on the Algorand Virtual Machine (AVM), launching on Voi Network and Algorand with plans to expand to EVM & SVM. The protocol enables users to lend assets, earn interest, borrow against collateral, and mint the overcollateralized stablecoin WAD. DorkFi is designed as a modular, transparent credit layer for emerging blockchain ecosystems.

## Features

### Multi-Asset Lending Markets
Each supported asset operates within an isolated market with configurable risk parameters:
- Collateral factors  
- Liquidation thresholds  
- Deposit and borrow caps  
- Utilization-based interest rates  

### Dynamic Interest Rate Model
Borrow and supply rates adjust automatically based on market utilization. Interest accrues continuously using a scaled index system.

### Unified Collateral & Health Factor System
Users can borrow across all supported markets using global collateral valuation. Health factors are monitored continuously, and positions below threshold become liquidatable.

### WAD Stablecoin
WAD is minted only through borrowing, ensuring every unit is fully overcollateralized.

### Liquidations
Positions with a health factor below 1.0 become eligible for liquidation. Liquidators repay part of the debt and receive discounted collateral.

## Smart Contract Architecture

- **LendingPool** – Core contract for deposits, borrows, repayments, interest accrual, and liquidations  
- **NToken** – Interest-bearing deposit token  
- **DToken** – Debt token representing borrowed amounts  
- **Oracle** – Price-feed source for collateral valuation  
- **CollateralManager** – Tracks and values collateral types  
- **InterestRateModel** – Utilization-driven interest rate logic  

## User Flows

### Lenders
- Deposit assets and receive nTokens  
- Withdraw underlying assets plus accrued interest  

### Borrowers
- Deposit collateral  
- Borrow assets or mint WAD  
- Repay at any time  
- Maintain HF ≥ 1.0 to avoid liquidation  

### Liquidators
- Identify undercollateralized accounts  
- Repay borrower debt  
- Claim discounted collateral  

## Tokenomics

### UNIT Token
- Total supply: 420,069  
- Used for governance, incentives, and community alignment  

### WAD Stablecoin
- Always overcollateralized  
- Minted exclusively through borrowing  
- Supports cross-chain liquidity  

## Security

DorkFi incorporates overcollateralization, market caps, reserve accumulation, and continuous health monitoring. Third-party audits and a bug bounty program supplement protocol security.

## Roadmap

- Lending market mainnet launch on Algorand and Voi Network

- Activation of WAD stablecoin

- Additional asset markets

- DAO governance and treasury management

- Multi-chain expansion



This project is licensed under the MIT License. See the LICENSE file for details.
