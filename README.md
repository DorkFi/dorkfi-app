# DorkFi App

The official web application for **DorkFi**, a modular, multi-chain decentralized credit protocol enabling stable borrowing, lending, and liquidity markets powered by fully on-chain governance.

DorkFi introduces a new primitive: **Stable Credit Markets** — capital-efficient lending markets that unify collateral, credit issuance, and risk management across multiple blockchain ecosystems.

---

## Overview

DorkFi is a decentralized finance protocol designed to provide:

- Overcollateralized lending markets
- Stablecoin-based credit issuance (WAD)
- Modular isolated lending markets
- Fully on-chain governance via UNIT
- Cross-chain deployment across AVM, EVM, and beyond

This repository contains the primary frontend interface for interacting with the DorkFi protocol, including deposit, borrow, repay, governance, and analytics functionality.

---

## Core Concepts

### Stable Credit Markets
DorkFi introduces a modular lending architecture where curated collateral enables stable credit issuance while preserving peg stability and risk isolation.

### WAD — Stable Credit Unit
WAD is the protocol’s fully collateralized stablecoin used for borrowing, liquidity routing, and cross-market credit settlement.

### UNIT — Governance Token
UNIT governs all protocol parameters on-chain, including:
- Collateral risk parameters
- Asset listings
- Interest rate curves
- Treasury and reserve policies
- Cross-chain expansion decisions

### Modular Market Architecture
DorkFi separates markets into distinct layers:

| Market Type | Purpose |
|-------------|---------|
| A-Markets | Monetary layer for WAD minting |
| B-Markets | Cross-collateral liquidity markets |
| Isolated Markets | Single-collateral, capped risk markets |

This architecture improves peg resilience, risk pricing, and scalability across assets and chains.

---

## Features

- Deposit collateral to earn yield
- Borrow stable credit using WAD
- Monitor health factors and liquidation thresholds
- Participate in fully on-chain governance
- View protocol analytics and utilization metrics
- Interact with isolated markets for targeted risk exposure

---

## Multichain Strategy

DorkFi is modular by design and can be deployed across multiple blockchain ecosystems.

Current and planned deployments include:
- AVM-based chains (e.g., Algorand, Voi Network)
- EVM networks (e.g., Base and others)
- Future expansion to additional VM environments

This enables unified credit markets with shared governance and cross-chain risk coordination.

---

## Repository Structure

dorkfi-app/
├── src/
│ ├── components/ # UI components
│ ├── pages/ # Application routes and views
│ ├── hooks/ # Protocol and wallet hooks
│ ├── services/ # Contract interaction logic
│ ├── state/ # App state and stores
│ └── utils/ # Helper utilities
├── public/ # Static assets
├── styles/ # Global styles and themes
└── config/ # Network and protocol configs

---

## Getting Started

### Prerequisites
- Node.js >= 18
- npm, pnpm, or yarn
- A compatible crypto wallet

### Installation

```bash
git clone https://github.com/DorkFi/dorkfi-app.git
cd dorkfi-app
npm install
Development
npm run dev

Build
npm run build

Preview Production Build
npm run preview

Environment Variables

Create a .env file in the root directory:

VITE_NETWORK=voi
VITE_RPC_URL=
VITE_ANALYTICS_ENDPOINT=


Additional variables may be required depending on deployed networks, oracle integrations, and analytics configuration.

Governance

DorkFi operates with fully on-chain governance. UNIT token holders can:

Propose parameter changes

Vote on new market listings

Adjust collateral and liquidation thresholds

Direct treasury allocations

Govern cross-chain risk parameters

All approved proposals directly update protocol behavior via smart contracts without centralized intervention.

Security & Risk Considerations

All borrowing is overcollateralized

Isolated markets prevent contagion across assets

Liquidation thresholds enforce solvency

Reserve factors help absorb systemic risk

Parameter updates are governed fully on-chain

Users should understand liquidation risk and collateral volatility before borrowing.

Roadmap

Cross-chain credit markets (EVM expansion)

Advanced isolated market routing

DAO treasury credit tools

Perpetual lending rate optimization

Unified multi-chain governance layer

Contributing

We welcome contributions from developers, researchers, and ecosystem partners.

Fork the repository

Create a feature branch

Submit a pull request with clear context and testing notes

License

This project is released under the MIT License.

Links

App: https://app.dork.fi

Website: https://dork.fi

Governance Token: UNIT

Stable Credit Unit: WAD

About DorkFi

DorkFi is building a unified on-chain credit system designed to scale across multiple blockchain ecosystems. By combining modular lending markets, stable credit issuance, and fully on-chain governance, DorkFi aims to become the foundational liquidity layer for decentralized finance.
