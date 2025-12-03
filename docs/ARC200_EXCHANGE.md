# ARC-XXX: ARC200 Exchange Extension

## Preamble

**ARC:** TBD  
**Title:** ARC200 Exchange Extension  
**Author:** Shelly.Voi  
**Status:** Draft  
**Type:** Standard  
**Category:** ARC200 Extension  
**Created:** 2025-08-06  
**Requires:** ARC-0002 (ARC4), ARC-0200, ARC-0073 (ARC73)

## Summary

This ARC defines a standardized interface and behavior for enabling bidirectional exchange between ARC200 tokens and Algorand Standard Assets (ASAs). It facilitates seamless conversion between ARC200 and ASA formats while preserving ARC200's fixed-supply model and secure transfer semantics.

## Abstract

The ARC200 Exchange Extension introduces a standardized interface enabling ARC200-compliant smart contracts to support opt-in exchange of ARC200 tokens for ASA tokens, and vice versa. The extension promotes token standard interoperability without compromising supply guarantees or introducing new minting/burning mechanics.

## Motivation

Algorand applications use both ASA and ARC200 standards, but lack a common mechanism for token conversion. This limits liquidity sharing, user experience, and cross-standard dApp composition. This ARC:

- Enables seamless ASA ↔ ARC200 conversion
- Maintains fixed supply (no minting/burning)
- Validates all exchange operations atomically
- Enhances DeFi composability across token standards

## Specification

### Interface Signature

- `arc200_exchange()(uint64,address)`
- `arc200_redeem(uint64)void`
- `arc200_swapBack(uint64)void`

All functions MUST be implemented using ARC4 ABI conventions.

### Method Definitions

#### `arc200_exchange() → (uint64 exchange_asset, address sink)`

Returns configuration parameters used by the exchange mechanism:

- **exchange_asset**: The ASA ID that the ARC200 token can be exchanged with.
- **sink**: The address that holds ARC200 tokens for redemption operations.

This method MUST NOT mutate state.

#### `arc200_redeem(uint64 amount) → void`

Exchanges ASA tokens for ARC200 tokens.

**Requirements:**

- The user MUST include a valid ASA transfer to the contract in the same transaction group.
- The ASA ID MUST match the configured exchange_asset.
- The amount transferred MUST be equal to or greater than the amount requested.
- The contract MUST transfer ARC200 tokens to the user from the sink address.
- No ARC200 tokens may be minted or burned during the exchange.

**Implementation References:**
- Deposit: [`src/services/lendingService.ts`](../src/services/lendingService.ts#L1677-L1689)
- Repay: [`src/services/lendingService.ts`](../src/services/lendingService.ts#L2768-L2780)

#### `arc200_swapBack(uint64 amount) → void`

Exchanges ARC200 tokens back into ASA tokens.

**Requirements:**

- The user MUST transfer ARC200 tokens to the configured sink address.
- Upon receiving the ARC200 tokens, the contract MUST transfer the equivalent amount of ASA tokens to the user.
- The ASA MUST be transferred from the application's own account.
- No ARC200 tokens may be minted or burned during the exchange.

**Implementation Reference:**
- Withdraw: [`src/services/lendingService.ts`](../src/services/lendingService.ts#L2454-L2466)

### Interface Support Declaration

To comply with ARC-73, contracts implementing this extension MUST implement the `supportsInterface` method with the following identifier:

**Interface ID (ARC-73-compliant)**

```
0xf7bde749
```

This value is computed as the XOR of the first 4 bytes of the SHA-512/256 hashes of the following method signatures:

- `arc200_exchange()(uint64,address)`
- `arc200_redeem(uint64)void`
- `arc200_swapBack(uint64)void`

### Implementation Requirement

Contracts implementing this extension MUST return `true` from:

```
supportsInterface(0xf7bde749)
```

### Validation Requirements

- The contract MUST validate that all expected transfers (ASA and ARC200) are part of the atomic transaction group.
- The ASA ID MUST match the configured exchange asset.
- The contract MUST reject operations with insufficient balances, incorrect asset IDs, or misordered group transactions.
- Exchange operations MUST be permissionless and open to all users.

## Security Considerations

- ARC200 supply MUST remain fixed—no minting or burning is allowed.
- The sink account MUST be pre-funded and secured.
- Atomic transaction validation MUST be enforced to prevent partial execution.
- The contract SHOULD emit standard ARC200 events during transfers to support indexers and explorers.

## Rationale

This extension is minimal by design to reduce attack surface and implementation complexity. It assumes a 1:1 fixed exchange rate and does not introduce slippage, pricing logic, or market dynamics. This ensures predictable behavior and easy implementation while enabling cross-standard token mobility.

## Reference Implementation

A reference implementation will be maintained under the open-submarine repository as a reusable ARC4-compatible module. It will demonstrate the proper atomic validation patterns and ARC200 compliance.

## Use Cases

- **Cross-standard DEXs**: Allow ARC200-ASA liquidity pairs
- **Wallet Interoperability**: Users can hold either format
- **Bridges**: Enable cross-chain and cross-standard bridges
- **DeFi Protocols**: Accept either ARC200 or ASA for deposits
- **Governance Systems**: Enable backward compatibility across token types

## Backward Compatibility

This is an optional extension. ARC200 tokens that do not implement the exchange interface remain fully compliant. ARC200 tokens that do implement it MUST follow the specifications in this ARC.

## Future Considerations

This ARC may be extended via future proposals to support:

- Multiple exchange pairs
- Variable or dynamic exchange rates
- Slippage controls
- Protocol fees
- Governance over sink/exchange configuration
- AMM-style liquidity integrations

## Code References

This implementation demonstrates how the ARC200 Exchange Extension is used in the DorkFi PreFi frontend:

### Type Definition

The `arc200-exchange` token standard is defined in the `TokenStandard` type:

- **File**: [`src/config/index.ts`](../src/config/index.ts#L34)
- **Type**: `export type TokenStandard = "network" | "asa" | "arc200" | "arc200-exchange";`

### Token Configuration

Tokens using the ARC200 Exchange Extension are configured with `tokenStandard: "arc200-exchange"`:

- **File**: [`src/config/index.ts`](../src/config/index.ts#L1590-L1603)
- **Example**: WAD token configuration for Voi Network

### Deposit Implementation

The `arc200_redeem` method is used when depositing ASA tokens to exchange them for ARC200 tokens:

- **File**: [`src/services/lendingService.ts`](../src/services/lendingService.ts#L1677-L1689)
- **Function**: `deposit()`
- **Method**: `arc200_redeem(uint64 amount)`
- **Usage**: Exchanges ASA tokens for ARC200 tokens during deposit operations

### Withdraw Implementation

The `arc200_swapBack` method is used when withdrawing ARC200 tokens to exchange them back to ASA tokens:

- **File**: [`src/services/lendingService.ts`](../src/services/lendingService.ts#L2454-L2466)
- **Function**: `withdraw()`
- **Method**: `arc200_swapBack(uint64 amount)`
- **Usage**: Exchanges ARC200 tokens back to ASA tokens during withdrawal operations

### Repay Implementation

The `arc200_redeem` method is also used when repaying borrowed tokens:

- **File**: [`src/services/lendingService.ts`](../src/services/lendingService.ts#L2768-L2780)
- **Function**: `repay()`
- **Method**: `arc200_redeem(uint64 amount)`
- **Usage**: Exchanges ASA tokens for ARC200 tokens during repayment operations

### Balance Fetching

Balance fetching for `arc200-exchange` tokens queries the underlying ASA balance:

- **File**: [`src/components/Portfolio.tsx`](../src/components/Portfolio.tsx#L522-L540)
- **File**: [`src/components/MarketsTable.tsx`](../src/components/MarketsTable.tsx#L693-L711)
- **Implementation**: Fetches ASA balance using the `underlyingAssetId` since the exchange tokens are represented as ASAs

### Contract Builder

The exchange contract is initialized using the ARC200 Exchange interface:

- **File**: [`src/services/lendingService.ts`](../src/services/lendingService.ts#L1582-L1607)
- **Contract**: `arc200Exchange` builder with methods:
  - `arc200_redeem(uint64)void`
  - `arc200_swapBack(uint64)void`

## Copyright

This specification is licensed under the MIT License.

