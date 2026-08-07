export const PROFILE_SHARE_WIDTH = 1200;
export const PROFILE_SHARE_HEIGHT = 675;

/** Overlay headline on the generated share card (top-left). */
export const PROFILE_SHARE_OVERLAY_HEADLINE = "NEW PFP SET";

export type ProfileShareCollection = "dorks_v1" | "dorks_v2" | "lil_chubs" | "unknown";

export type ProfileShareInput = {
  /** Profile NFT image URL (full-bleed background). */
  avatarImage: string;
  /** Display name, e.g. "DORK 12" / "CHUB 3" / "DORKS 5". */
  nftName: string;
  /** Voi ARC-72 contract id (same id used in `arc72:<contract>:<token>`). */
  contractId?: number;
  collectionId?: ProfileShareCollection;
  /** Optional corner label (enVoi / display name). */
  addressName?: string | null;
};

export type ProfileShareResult = {
  blob: Blob;
  objectUrl: string;
};

export type ShareProfileConfirmationOutcome =
  | "link"
  | "native"
  | "clipboard"
  | "download"
  | "text-only";
