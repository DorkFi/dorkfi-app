const XALGO_GOVERNANCE_APR_URL =
  "https://t2mirm6n2ivqbd7dwnby3gxaaa0naxxx.lambda-url.eu-central-1.on.aws/";

export type XalgoGovernanceAprResponse = {
  apr?: string;
  rates?: Array<{
    time?: number;
    algoBalance?: string;
    xAlgoCirculatingSupply?: string;
  }>;
};

/** API `apr` is basis points (100 bps = 1.00 percentage point). */
export function xalgoAprBpsToPercentPoints(apr: string | undefined): number | null {
  if (apr == null || String(apr).trim() === "") return null;
  const n = Number.parseFloat(String(apr));
  if (!Number.isFinite(n) || n < 0) return null;
  return n / 100;
}

export async function fetchXalgoGovernanceApr(): Promise<XalgoGovernanceAprResponse> {
  const res = await fetch(XALGO_GOVERNANCE_APR_URL);
  if (!res.ok) {
    throw new Error(`xALGO governance APR failed: HTTP ${res.status}`);
  }
  return (await res.json()) as XalgoGovernanceAprResponse;
}
