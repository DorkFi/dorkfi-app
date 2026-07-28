export const GOVERNANCE_SHARE_WIDTH = 1200;
export const GOVERNANCE_SHARE_HEIGHT = 675;
export const GOVERNANCE_SHARE_TEMPLATE_YES_PATH =
  "/images/share/governance-vote-template-yes.png";
export const GOVERNANCE_SHARE_TEMPLATE_NO_PATH =
  "/images/share/governance-vote-template-no.png";
/** @deprecated Use resolveGovernanceShareTemplatePath */
export const GOVERNANCE_SHARE_TEMPLATE_PATH = GOVERNANCE_SHARE_TEMPLATE_YES_PATH;

export function resolveGovernanceShareTemplatePath(support: boolean): string {
  return support
    ? GOVERNANCE_SHARE_TEMPLATE_YES_PATH
    : GOVERNANCE_SHARE_TEMPLATE_NO_PATH;
}

export type GovernanceShareInput = {
  votingPower: number;
  support: boolean;
  proposalTitle: string;
};

export type GovernanceShareResult = {
  blob: Blob;
  objectUrl: string;
};

export type ShareGovernanceVoteOutcome =
  | "api"
  | "link"
  | "native"
  | "clipboard"
  | "download"
  | "text-only";
