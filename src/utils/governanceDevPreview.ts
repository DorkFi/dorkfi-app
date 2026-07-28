export type GovernanceDevPreviewMode = "proposal" | "vote-success";

export type GovernanceDevPreview = {
  enabled: boolean;
  mode: GovernanceDevPreviewMode | null;
  voteSupport: boolean;
  mockVotingPower: number;
};

function parseVoteSupport(raw: string | null): boolean {
  if (!raw) return true;
  return !["no", "against", "0", "false"].includes(raw.toLowerCase());
}

function parseMockVotingPower(raw: string | null): number {
  if (!raw) return 69_420;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 69_420;
}

export function getGovernanceDevPreview(
  search = typeof window !== "undefined" ? window.location.search : ""
): GovernanceDevPreview {
  const disabled: GovernanceDevPreview = {
    enabled: false,
    mode: null,
    voteSupport: true,
    mockVotingPower: 69_420,
  };

  if (!import.meta.env.DEV) return disabled;

  const params = new URLSearchParams(search);
  const mock = params.get("mock");
  if (!mock) return disabled;

  const voteSupport = parseVoteSupport(params.get("support"));
  const mockVotingPower = parseMockVotingPower(params.get("power"));

  if (mock === "vote-success" || mock === "success") {
    return {
      enabled: true,
      mode: "vote-success",
      voteSupport,
      mockVotingPower,
    };
  }

  if (mock === "1" || mock === "true" || mock === "proposal") {
    return {
      enabled: true,
      mode: "proposal",
      voteSupport,
      mockVotingPower,
    };
  }

  return disabled;
}
