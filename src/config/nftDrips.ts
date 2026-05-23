/** NFT drip app contract (Voi) — Dorks v1 */
export const nftDripDorkAppId = 49016540;
/** NFT drip app contract (Voi) — Dorks v2 */
export const nftDripDorkV2AppId = 49016557;

export type UnitNftDripCampaignConfig = {
  id: string;
  nftContractId: number;
  dripContractId: number;
  rewardTokenContractId: number;
  rewardTokenDecimals: number;
  /** Accrual rate in smallest token units per week (on-chain math). */
  dripPerWeekRaw: number;
  rewardSymbol: string;
  title: string;
  subtitle: string;
  collectionLabel: string;
  emptyStateEmoji: string;
};

export const DORK_DRIP_CONFIG: UnitNftDripCampaignConfig = {
  id: "dork",
  nftContractId: 313597,
  dripContractId: nftDripDorkAppId,
  rewardTokenContractId: 420069,
  rewardTokenDecimals: 8,
  dripPerWeekRaw: 400_000_000,
  rewardSymbol: "UNIT",
  title: "Dorks Drip",
  subtitle:
    "Your Dorks NFTs earn UNIT over time. Claim up to 6 NFTs per wallet approval (~1 VOI per batch).",
  collectionLabel: "Dorks",
  emptyStateEmoji: "🤓",
};

export const DORK_V2_DRIP_CONFIG: UnitNftDripCampaignConfig = {
  id: "dork-v2",
  nftContractId: 894888,
  dripContractId: nftDripDorkV2AppId,
  rewardTokenContractId: 420069,
  rewardTokenDecimals: 8,
  dripPerWeekRaw: 80_000_000,
  rewardSymbol: "UNIT",
  title: "Dorks V2 Drip",
  subtitle:
    "Your Dorks V2 NFTs earn UNIT over time. Claim up to 6 NFTs per wallet approval (~1 VOI per batch).",
  collectionLabel: "Dorks V2",
  emptyStateEmoji: "🤓",
};

export const NFT_UNIT_DRIP_CAMPAIGNS = [DORK_DRIP_CONFIG, DORK_V2_DRIP_CONFIG] as const;
