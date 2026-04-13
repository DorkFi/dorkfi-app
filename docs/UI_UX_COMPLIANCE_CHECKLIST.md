# 🧾 UI/UX Compliance Checklist (DeFi Interface Safe Zone)

## Overview

This checklist ensures that our applications (DorkFi, UluOS, agents, and interfaces) remain compliant with SEC guidance by operating strictly as **non-custodial, neutral tools** rather than financial intermediaries.

---

## 1. 🔐 Self-Custody Enforcement

### ✅ Required

- Users connect their own wallet (no hosted accounts)
- All actions require explicit user signatures
- Display:
  - “You control your assets”
  - “Transactions are executed directly on-chain”

### 🚫 Avoid

- “Deposit into our platform”
- Any flow where funds are held off-chain or by backend services

---

## 2. ✍️ Explicit User Intent (No Implicit Actions)

### ✅ Required

- All actions must be:
  - Button-triggered
  - Clearly labeled (e.g. “Deposit 100 WAD”)
- Show full transaction preview before signing:
  - asset
  - amount
  - contract
  - expected result

### 🚫 Avoid

- Auto-executing transactions
- Background rebalancing
- “Set and forget” flows without explicit approval per action

---

## 3. 🧠 No Investment Advice / Recommendations

### ✅ Required

- Use neutral language:
  - “APR: 4.2%”
  - “Utilization: 68%”
- Present raw data only

### 🚫 Avoid

- “Best pool”
- “Recommended strategy”
- “Optimal yield”
- Highlighting options as “better”

### 📝 Optional

- Disclaimer:
  - “This interface does not provide investment advice.”

---

## 4. 🔄 No Order Routing / Execution Logic

### ✅ Required

- User selects:
  - market
  - asset
  - amount
- System passes inputs directly to contracts

### 🚫 Avoid

- Auto-selecting pools
- Smart routing between markets
- Aggregation logic that determines execution paths

---

## 5. 💰 Fee Transparency (Fixed + Neutral)

### ✅ Required

- Clearly display:
  - protocol fee (e.g. 0.3%)
  - gas/network fee (estimated)
- Same fee structure for all users

### 🚫 Avoid

- Dynamic fees based on:
  - user size
  - behavior
  - routing logic
- Hidden spreads or implicit fees

---

## 6. 🎛️ No Discretion / No Control Layer

### ✅ Required

- Deterministic UI:
  - Input → Transaction → Result
- Show contract address and method being called

### 🚫 Avoid

- Backend altering:
  - timing
  - order
  - destination
- Admin overrides affecting user transactions

---

## 7. 🤖 Agent / Automation Guardrails (CRITICAL)

### ✅ Required

- Agents must:
  - Act only on explicit user-defined instructions
  - Require signature per action OR pre-approved constraints
- Show:
  - “Agent is acting on your instructions”
  - Full action preview before execution

### 🚫 Avoid

- Platform-controlled optimization
- Autonomous strategies without user-defined rules
- Hidden decision-making logic

### ✅ Safe Pattern Example

- “If HF < 1.2 → repay 10 WAD” (user-defined rule)

---

## 8. 🧾 Clear Role Framing (Interface, Not Intermediary)

### ✅ Required

- Messaging:
  - “This app is a non-custodial interface”
  - “All transactions occur directly on blockchain networks”
- Link to:
  - contract addresses
  - open-source code (if available)

### 🚫 Avoid

- Language implying:
  - custody
  - fund management
  - optimization on behalf of users

---

## 9. 📊 Data Presentation (Neutral + Complete)

### ✅ Required

- Display:
  - APR
  - utilization
  - collateral factor
  - liquidation threshold
- Provide full context without bias

### 🚫 Avoid

- Sorting/highlighting implying “best choice”
- Gamified nudges pushing user decisions

---

## 10. ⚠️ Risk Disclosure (Light but Clear)

### ✅ Required

- Surface key risks:
  - liquidation risk
  - smart contract risk
  - market volatility
- Contextual placement (e.g. near borrow/lever actions)

---

## 🔥 Golden Rule

> If the UI **suggests, decides, or acts**, it is risky.  
> If the UI **shows, enables, and executes user intent**, it is safe.

---

## 🧠 Quick Self-Test (Pre-Launch)

- Did the user explicitly choose this action?
- Are we avoiding suggestions or recommendations?
- Are we passing inputs directly to contracts?
- Could this be interpreted as acting on behalf of the user?

If any answer is unclear → revise before shipping.

---

## 🧩 Notes

- This checklist applies to:
  - Frontends
  - Wallet integrations
  - Agent systems
  - Automation layers
- Especially critical for:
  - UluOS agents
  - DorkFi execution flows
  - Any “smart” UX features

---
