/**
 * How far back (in Algorand rounds) to scan for `UserHealth` events on the lending pool app.
 *
 * The indexer paginates log queries; a multi-million-round window (historically `2e6`) fans out
 * into an enormous number of HTTP requests and can overwhelm the client or rate limits.
 *
 * ~120k rounds is on the order of several days at ~3.5s/round — enough for recent health
 * snapshots while keeping request volume reasonable. Increase only if you need older users
 * who have not emitted `UserHealth` recently.
 */
export const LENDING_USER_HEALTH_ROUND_LOOKBACK = 120_000;
