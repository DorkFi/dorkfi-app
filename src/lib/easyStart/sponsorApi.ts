/** Client helper for Easy Start ETH + ALGO gas sponsor. */

export type SponsorLegStatus = "sent" | "skipped" | "error";

export type SponsorLeg = {
  status: SponsorLegStatus;
  txHash?: string;
  reason?: string;
  error?: string;
};

export type SponsorResult = {
  evmAddress: string;
  algorandAddress: string | null;
  eth: SponsorLeg;
  algo: SponsorLeg;
};

export class SponsorFundingError extends Error {
  result?: SponsorResult;

  constructor(message: string, result?: SponsorResult) {
    super(message);
    this.name = "SponsorFundingError";
    this.result = result;
  }
}

/** A leg that actually left funds on the destination, or confirmed they were already there. */
export function isSponsorLegFunded(leg: SponsorLeg | null | undefined): boolean {
  if (!leg) return false;
  return (
    leg.status === "sent" ||
    (leg.status === "skipped" && leg.reason === "already_funded")
  );
}

export function isSponsorFullyFunded(result: SponsorResult): boolean {
  return isSponsorLegFunded(result.eth) && isSponsorLegFunded(result.algo);
}

function sponsorFailureMessage(result: SponsorResult): string {
  const algoFailed = result.algo.status === "error";
  const ethFailed = result.eth.status === "error";
  if (algoFailed && ethFailed) {
    return "Could not set up this account. Try again in a moment.";
  }
  if (algoFailed) {
    return "Could not set up this account on Algorand. Try again in a moment.";
  }
  return "Could not set up this account on Base. Try again in a moment.";
}

/** HTTP 200 can still mean a treasury send failed. Those must retry. */
export function assertSponsorReady(result: SponsorResult): SponsorResult {
  if (result.eth.status === "error" || result.algo.status === "error") {
    throw new SponsorFundingError(sponsorFailureMessage(result), result);
  }
  return result;
}

function sponsorBase(): string {
  const raw = import.meta.env.VITE_EASY_START_API_BASE as string | undefined;
  if (raw && raw.trim()) return raw.replace(/\/+$/, "");
  return "/api/easy-start";
}

async function parseJson<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error || `Sponsor API ${res.status}`
    );
  }
  return data;
}

/** Throws when a treasury leg failed so callers retry instead of treating HTTP 200 as funded. */
export async function requestEasyStartSponsor(args: {
  accessToken: string;
  evmAddress: string;
  signal?: AbortSignal;
}): Promise<SponsorResult> {
  const timeout = args.signal ? null : new AbortController();
  const timer = timeout
    ? setTimeout(() => timeout.abort(), 45_000)
    : null;
  try {
    const res = await fetch(`${sponsorBase()}/sponsor`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${args.accessToken}`,
      },
      body: JSON.stringify({ evmAddress: args.evmAddress }),
      signal: args.signal ?? timeout!.signal,
    });
    const result = await parseJson<SponsorResult>(res);
    return assertSponsorReady(result);
  } finally {
    if (timer != null) clearTimeout(timer);
  }
}
