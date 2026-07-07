# Algorand Profile Picture (PFP) — Backend Avatar Endpoint

Handoff spec for the **Express DorkFi API** (`dorkfi-api.nautilus.sh`). The DorkFi web app now lets
users set a bridged **Dork NFT** as their profile picture on **Algorand mainnet without an enVoi
(`.voi`) name**. The client is fully implemented; this document describes the one backend capability
still required for the choice to **persist across devices**.

The backend repo is separate from the web app repo. This folder contains:

- `BACKEND_AVATAR_ENDPOINT.md` — this spec.
- `dork-nft-asset-map.json` — reverse lookup (`voiContractId:voiTokenId → Algorand assetId`), the full
  list of bridged Dork ASA ids, and the shared reserve address. Drop this into the backend for
  ownership verification.

---

## Background

- Dork NFTs are native **Voi ARC-72** tokens. They have been bridged to Algorand as **ARC-69 ASAs**
  (one ASA per NFT, 600 total across Dorks v1 / Lil Chubs / Dorks v2).
- All bridged Dork ASAs share one reserve address:
  `DORKHJKTKPZPV2ZLS45X4P6FV7VLE7QZQ7RZCN3DNRKXB56K22LX4RTXDI`.
- The existing `POST /user-profile` only **derives** an avatar from the enVoi record + mimir (Voi)
  ownership. Algorand-only users have no `.voi` record, so there is currently no way to set/persist
  a PFP for them.

## What the client already does

- **Discovery:** reads the user's Algorand ASA holdings and filters to bridged Dorks via the registry.
- **Set:** on confirm, calls `POST /user-profile` with an explicit avatar (see below) and caches the
  choice locally for an instant repaint.
- **Read:** on load, the connected user's avatar is resolved from the local cache, then falls back to
  `GET /user-profile/{address}` so it appears on any device once the backend stores it.

## Required change

Extend `POST /user-profile` to **store an explicitly provided avatar**, keyed by address, in the same
store the read endpoints already use. No changes required to the read endpoints' shape.

### Request — `POST /user-profile`

New Algorand branch (explicit avatar):

```jsonc
{
  "address": "GABC...58CHARS",
  "avatar": "https://prod.cdn.highforge.io/m/313597/1.webp", // image URL (what GET returns)
  "avatarDorkfi": "arc72:313597:1",                          // canonical <contract>:<token>
  "network": "algorand-mainnet"
}
```

Existing branch (unchanged — derive from enVoi):

```jsonc
{ "address": "GABC...58CHARS" }
```

### Response

```jsonc
{ "success": true, "data": { "avatar": "https://prod.cdn.highforge.io/m/313597/1.webp" } }
```

### Reads (must reflect the stored value — already the correct shape)

- `GET /user-profile/{address}` → `{ "success": true, "data": { "avatar": "…" | null } }`
- `GET /users/{address}` → `data.avatar`

## Reference handler (Express + algosdk)

```js
const assetMap = require("./dork-nft-asset-map.json"); // this folder's JSON

function dorkAsaFor(contractId, tokenId) {
  return assetMap.byCanonical[`${contractId}:${tokenId}`] ?? null;
}

async function ownsAsa(algod, address, assetId) {
  try {
    const info = await algod.accountAssetInformation(address, assetId).do();
    const amt =
      info?.assetHolding?.amount ??
      info?.["asset-holding"]?.amount ??
      info?.amount;
    return amt != null && BigInt(String(amt)) > 0n;
  } catch {
    return false;
  }
}

app.post("/user-profile", async (req, res) => {
  const { address, avatar, avatarDorkfi, network } = req.body;
  if (!address) {
    return res.status(400).json({ success: false, error: "address required" });
  }

  // NEW: explicit avatar (Algorand PFP, no .voi required)
  if (avatar && avatarDorkfi) {
    const m = /^arc72:(\d+):(\d+)$/.exec(avatarDorkfi);
    if (!m) {
      return res.status(400).json({ success: false, error: "bad avatarDorkfi" });
    }
    const assetId = dorkAsaFor(Number(m[1]), Number(m[2]));
    if (!assetId) {
      return res.status(400).json({ success: false, error: "unknown Dork NFT" });
    }
    if (!(await ownsAsa(algod, address, assetId))) {
      return res.status(403).json({ success: false, error: "not the owner" });
    }

    await profileStore.set(address, {
      avatar, // image URL — what GET returns
      avatarDorkfi, // canonical arc72
      network: network || "algorand-mainnet",
      lastUpdated: Date.now(),
    });
    return res.json({ success: true, data: { avatar } });
  }

  // EXISTING: derive from enVoi + mimir (unchanged)
  // ...
});
```

## Gotchas

1. **Do not clobber.** The existing address-only enVoi path must not overwrite an explicitly set
   avatar with `null` when no `.voi` record exists. Prefer leaving a stored explicit avatar untouched
   unless a new explicit value (or a verified enVoi value) replaces it.
2. **Same store.** Persist to whatever store `GET /user-profile/{address}` and `GET /users/{address}`
   already read from, so cross-device works with no further client changes.
3. **Ownership check.** Verify ASA ownership (amount > 0) before caching — mirrors the current
   "only if the user owns the NFT" behavior, but via Algorand algod/indexer instead of mimir/Voi.
   You may verify by exact `assetId` (see `dork-nft-asset-map.json`) or by the shared `reserve`.

## Client contract (already shipped)

- Write: `POST /user-profile` `{ address, avatar, avatarDorkfi, network }`
  (see `src/services/dorkfiAPIService.ts` → `setUserAvatar`).
- Read: `GET /user-profile/{address}` → `data.avatar`
  (see `src/services/dorkfiAPIService.ts` → `getUserAvatar`, consumed by `useAvatarImage`).
