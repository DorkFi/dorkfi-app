# Development documentation

Deep dives for **frontend features and architecture** in this repository: pages, services, multi-network behavior, and integration patterns. Add new implementation-focused guides here (distinct from [PreFi deployment](../prefi/index.md) product math and from [contributor workflows](../workflows/index.md)).

| Document | Summary |
|----------|---------|
| [Lending Supply](../LENDING_SUPPLY.md) | Supply (deposit) flow: `SupplyBorrowModal`, `lendingService.deposit()`, Folks/xALGO/tALGO preambles, config, portfolio display, APY, and transaction metadata. |
| [Voi Mainnet A Market — VOI Supply](../VOI_MAINNET_A_MARKET_VOI_SUPPLY.md) | Native VOI on A market (`47139778` / `41877720`): config IDs, txn group, wallet balance, portfolio keys, migration from legacy pool. |
| [Gas Station](GAS_STATION.md) | Gas Station page and `GasStationService`: minting network, ARC200, and ASA tokens across Voi/Algorand networks; UI, validation, and architecture. |
| [xChain Accounts integration plan](../XCHAIN_ACCOUNTS_INTEGRATION_PLAN.md) | Planning EVM/xChain wallet support alongside native AVM wallets on Voi Mainnet and Algorand Mainnet; phases, preconditions, and QA matrix. |
