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

/** Best-effort; caller should still run ETH/ALGO balance checks. */
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
    return parseJson<SponsorResult>(res);
  } finally {
    if (timer != null) clearTimeout(timer);
  }
}
