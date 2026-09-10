# Pool & Market Topology

Living reference for DorkFi lending **pools** (labeled A, B, C, …) and the markets inside them.

**Source of truth:** `src/config/index.ts`  
- Pool app IDs: `algorandProd*Market` / `prodAMarket` / `prodBMarket`  
- Letter map: `marketLabelMap` (+ `getMarketLabel` index fallback)  
- Token rows: `algorandProdTokens` / VOI `prodTokens`  
- Markets vs Pools visibility: `MARKETS_TABLE_EXCLUDED_POOL_IDS`, `isMarketsTableExcludedMarket`

When this doc and config disagree, **trust the config** and update this file.

Enabled live networks today: `algorand-mainnet`, `voi-mainnet` (`config.enabledNetworks`).

---

## Conceptual layers

From the product model (see also root `README.md`):

| Layer | Role |
|-------|------|
| **A markets** | Monetary / prime layer — core collateral and WAD credit |
| **B markets** | Sub-prime / long-tail cross-collateral liquidity |
| **Isolated / specialty pools** | Capped or themed risk (Folks assets, Tinyman LP collateral → WAD borrow) |

On Algorand prod, specialty risk is split across **C–F** (not only a single “isolated” letter). Letters are assigned by `lendingPools` order and `marketLabelMap`.

---

## Algorand Mainnet — live topology

Pool constants (`algorandProdAMarket` … `algorandProdGMarket`):

| Pool | App ID | Role (config comment) | Primary UI |
|------|--------|------------------------|------------|
| **A** | `3333688282` | A Prime | Markets |
| **B** | `3345940978` | B Sub-prime | Markets |
| **C** | `3578814346` | C UNIT Pair LPs | Pools (LP); WAD on Markets |
| **D** | `3526240577` | D Folks Markets | Markets |
| **E** | `3585829377` | WAD Pair LPs | Pools (LP); WAD on Markets |
| **F** | `3589083110` | USDC Pair LPs | Pools (LP); WAD on Markets |
| **G** | `3697602173` | USDC-only (deposit + borrow) | Markets (when nToken ID ready) |

`algorandProdCLendingPools` = **C + E + F** (LP lending group).  
Shared WAD sToken: `3333688448`. Oracle / controller / beacon / governance IDs live on `algorandProdContracts`.

**Pool G readiness:** Pool app id is set (`3697602173`); `algorandProdGUsdcNTokenId` is still TBD. `isAlgorandProdGReady` is true only when both are numeric; until then G is **not** appended to `lendingPools`, `USDC[]`, or `marketLabelMap` (avoids NaN app-id RPC calls). Replace the TBD nToken string in `src/config/index.ts` to activate.

**Visibility rules**

- C / E / F pool IDs are in `MARKETS_TABLE_EXCLUDED_POOL_IDS`.
- Exception: **WAD** borrow rows on those pools still appear on Markets / Portfolio.
- `LP_TMPOOL2_*` rows are intended for the **Pools** surface (`features.enablePools: true`; `enablePoolDepositWithdraw: false` today).
- **G** is a normal Markets pool (not excluded) once enabled — single USDC ASA market (`contractId` `3210682240`).

### Pool A — Prime (`3333688282`)

Core collateral and stables (non-exhaustive of display overrides; keys from `algorandProdTokens`):

| Key / display | Market contract | Notes |
|---------------|-----------------|-------|
| ALGO | `3207744109` | Native |
| fALGO | `3524740731` | Folks V2 ALGO (also appears on D) |
| tALGO | `3490783147` | Tinyman liquid staking |
| xALGO | `3490854290` | Governance xALGO |
| USDC | `3210682240` | |
| fUSDC / fiUSDC | `3527735223` / `3540156071` | Folks routes |
| UNIT | `3220125024` | |
| aVOI, POW, FINITE | `3210709899`, `3080081069`, `3211805086` | |
| goETH / wETH (+ Folks legs) | `3211806149`, `3211811648`, `3575840444` | |
| goBTC / wBTC (+ Folks legs) | `3211820549`, `3211827406`, `3575837891` | |
| LINK, SOL, AVAX | `3211838479`, `3211883276`, `3211885849` | |
| WAD | `3333688448` | sToken (`isStoken`) |

### Pool B — Sub-prime (`3345940978`)

Long-tail and community assets, plus shared ALGO/USDC/WAD:

| Key | Market contract |
|-----|-----------------|
| ALGO | `3207744109` |
| USDC | `3210682240` |
| TINY, fiTINY | `3211740909`, `3540827780` |
| FINITE, COMPX, HAY | `3211805086`, `3211800950`, `3211890928` |
| COOP, ALPHA, AKTA | `3212524778`, `3212531816`, `3212534634` |
| BRO, PEPE, HOG | `3212768756`, `3212771255`, `3212773584` |
| GOLD$, FOLKS, USDt, xUSD | `3220347315`, `3346185062`, `3346408431`, `3346881192` |
| WAD | `3333688448` |

**Parked in config (commented out, not live):** `MONKO` — candidate for B if re-enabled.

### Pool C — UNIT Pair LPs (`3578814346`)

| Key | Role | Market contract |
|-----|------|-----------------|
| WAD | Borrow market (Markets-visible) | `3333688448` (nToken `3583297246`) |
| LP_TMPOOL2_UNIT_ALGO | UNIT–ALGO LP collateral | `3577729953` |
| LP_TMPOOL2_UNIT_GOBTC | UNIT–goBTC LP collateral | `3577777819` |
| LP_TMPOOL2_WAD_UNIT | WAD–UNIT LP | `3577783311` |

UNIT LP collateral → WAD borrow pairing is wired via Pool C helpers (`UNIT_LENDING_COLLATERAL_CONTRACT_IDS`, `getPoolCWadBorrow…`).

### Pool D — Folks Markets (`3526240577`)

Currently sparse relative to the “Folks Markets” label:

| Key | Display | Market contract |
|-----|---------|-----------------|
| ALGO (Folks row) | fALGO / Algo | `3524740731` |
| fUSDC | USDC | `3527735223` |
| WAD | WAD | `3333688448` (nToken `3527318445`) |

### Pool E — WAD Pair LPs (`3585829377`)

| Key | Pair / role | Market contract |
|-----|-------------|-----------------|
| WAD | Borrow (Markets-visible) | `3333688448` (nToken `3585972631`) |
| LP_TMPOOL2_WAD_ALGO | WAD–ALGO | `3578405588` |
| LP_TMPOOL2_WAD_USDC | WAD–USDC | `3577799583` |
| LP_TMPOOL2_WAD_GOETH | WAD–goETH | `3578394082` |
| LP_TMPOOL2_WAD_GOBTC | WAD–goBTC | `3578387558` |

### Pool F — USDC Pair LPs (`3589083110`)

| Key | Pair / role | Market contract |
|-----|-------------|-----------------|
| WAD | Borrow against USDC-base LP collateral | `3333688448` (nToken `3589241382`) |
| LP_TMPOOL2_USDC_ALGO | USDC–ALGO | `3589026317` |
| LP_TMPOOL2_TALGO_USDC | tALGO–USDC | `3589029580` |
| LP_TMPOOL2_HAY_USDC | HAY–USDC | `3589032117` |
| LP_TMPOOL2_ALPHA_USDC | ALPHA–USDC | `3589036846` |

### Pool G — USDC-only (`3697602173`)

Pool id live; inactive in UI until USDC nToken id is numeric.

| Key | Role | Market contract | nToken |
|-----|------|-----------------|--------|
| USDC | Deposit + borrow (Markets) | `3210682240` (same underlying as A/B) | `TBD_ALGORAND_PROD_G_USDC_NTOKEN` |

Tinyman pair metadata for the Pools UI also lives in `src/constants/liquidityPools.ts` (`CURATED_LIQUIDITY_POOLS`).

---

## Voi Mainnet — live topology

| Pool | App ID | Role | UI |
|------|--------|------|----|
| **A** | `47139778` | Primary / monetary | Markets |
| **B** | `47139781` | Long-tail | Markets |

Note: `marketLabelMap` still lists legacy PreFi pool IDs (`41760711` → A, `44866061` → B). Live prod A/B labels come from **lendingPools index fallback** in `getMarketLabel`.

### Pool A (`47139778`)

VOI, aUSDC, UNIT, aALGO, aETH, aBTC, acbBTC, POW, WAD (`47138068`).

### Pool B (`47139781`)

FV, NV, EV, bVOI, NODE, BUIDL, SHELLY, AMMO, GM, CORN, F, IAT, WAD (`47138068`).

Historical PreFi pools remain only as migration sources on token rows, not as active `lendingPools`.

---

## Planned / forward-looking

Items below are **not** fully live or are incomplete in config. Treat as direction of travel; ship dates and final IDs belong in config when ready.

### Near-term product / config gaps

| Item | Intent | Status in repo |
|------|--------|----------------|
| **Pool G USDC** | Isolated USDC deposit/borrow on Algorand | Pool `3697602173` set; `algorandProdGUsdcNTokenId` still TBD — auto-wires when nToken ID is numeric |
| **Pool D Folks expansion** | Broader Folks-wrapped / isolated assets on D | Label + pool live; only fALGO, fUSDC, WAD configured |
| **Additional C/E/F LP markets** | More Tinyman TMPOOL2 pairs as LP collateral → WAD | Pattern established; new rows need token config + `liquidityPools` + borrow helpers |
| **Pool deposit / withdraw on Pools page** | Direct LP market supply UX | `enablePoolDepositWithdraw: false` |
| **MONKO (Algorand B)** | Community asset on B | Present but commented out in `algorandProdTokens` |
| **Liquidation engine / treasury** | Full Algorand prod contract set | `undefined` on `algorandProdContracts` |

### Architecture letters (future Algorand)

Keep letter semantics stable as new pools land:

| Letter family | Intended use |
|---------------|--------------|
| **A** | Prime monetary collateral + WAD |
| **B** | Sub-prime / long-tail |
| **C** | UNIT-base LP collateral markets |
| **D** | Folks (and similar) isolated / bridged credit |
| **E** | WAD-base LP collateral markets |
| **F** | USDC-base LP collateral markets |
| **G** | USDC-only isolated deposit/borrow (pool `3697602173`; nToken TBD) |
| **H+** | Next specialty or chain-local isolation buckets (assign via `lendingPools` order + `marketLabelMap`) |

### Multichain (placeholders only)

Networks exist in `config.networks` but are **not** in `enabledNetworks`:

- `algorand-testnet`
- `base-mainnet` / `base-testnet`
- `ethereum-mainnet` / `ethereum-testnet`
- `localnet`

These still use TODO pool / token placeholders. Expected eventual shape mirrors Algorand: at least an **A** (and often **B**) lending pool per chain, then specialty pools as needed. See also `docs/XCHAIN_ACCOUNTS_INTEGRATION_PLAN.md` for wallet/xChain work.

### Cross-chain credit (product direction)

README positions WAD as the stable credit unit across markets and chains. Forward work likely includes:

- Shared governance (UNIT) over risk params and listings  
- Additional AVM deployments beyond Voi / Algorand  
- EVM deployments (e.g. Base) once contracts and frontend network configs are real  

Do not invent pool app IDs in this doc until they land in `src/config/index.ts`.

---

## How to update this document

1. Change pool IDs, labels, or token rows in `src/config/index.ts` (and LP pairs in `src/constants/liquidityPools.ts` if needed).  
2. Update the matching table(s) above.  
3. Move items from **Planned** → **Live** only when they appear in enabled network config and ship behind the right feature flags.

### Quick config anchors

| Concern | Location in `src/config/index.ts` |
|---------|-------------------------------------|
| Algorand pool IDs A–G | `algorandProdAMarket` … `algorandProdGMarket` (+ `algorandProdGUsdcNTokenId`, `isAlgorandProdGReady`) |
| Algorand token rows | `algorandProdTokens` |
| VOI pool IDs / tokens | `prodAMarket`, `prodBMarket`, `prodTokens` |
| Letter map | `marketLabelMap`, `getMarketLabel` |
| Markets table exclusions | `MARKETS_TABLE_EXCLUDED_POOL_IDS` |
| LP → WAD borrow wiring | Pool C/E/F helpers near `LENDING_POOL_BY_MARKET_CONTRACT` |
| Feature flags | `config.features` (`enablePools`, `enablePoolDepositWithdraw`, …) |
