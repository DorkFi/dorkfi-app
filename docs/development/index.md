# Development documentation

Deep dives for **frontend features and architecture** in this repository: pages, services, multi-network behavior, and integration patterns. Add new implementation-focused guides here (distinct from [PreFi deployment](../prefi/index.md) product math and from [contributor workflows](../workflows/index.md)).

| Document | Summary |
|----------|---------|
| [Gas Station](GAS_STATION.md) | Gas Station page and `GasStationService`: minting network, ARC200, and ASA tokens across Voi/Algorand networks; UI, validation, and architecture. |
| [Haystack proxy](HAYSTACK_PROXY.md) | Keep `HAYSTACK_API_KEY` server-only; local Vite middleware vs beta/production standalone proxy; feature-flag and CORS checklist. |
| [xChain Accounts integration plan](../XCHAIN_ACCOUNTS_INTEGRATION_PLAN.md) | Planning EVM/xChain wallet support alongside native AVM wallets on Voi Mainnet and Algorand Mainnet; phases, preconditions, and QA matrix. |
