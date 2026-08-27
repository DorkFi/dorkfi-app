const X_INTENT_BASE = "https://x.com/intent/tweet";
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Same-origin permalink so tweets show app.dork.fi, not the share server. */
export const GOVERNANCE_VOTE_SHARE_URL =
  "https://app.dork.fi/governance/share/";

export function formatGovernanceShareTimeLeft(
  endTime: Date,
  now: Date = new Date()
): string | null {
  const remainingMs = endTime.getTime() - now.getTime();
  if (remainingMs <= 0) return null;

  if (remainingMs < DAY_MS) {
    const hours = Math.max(1, Math.round(remainingMs / HOUR_MS));
    if (hours >= 24) return "1 day";
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }

  const days = Math.max(1, Math.round(remainingMs / DAY_MS));
  return days === 1 ? "1 day" : `${days} days`;
}

export function yesSharePercent(
  votesFor: number,
  votesAgainst: number
): number | null {
  const total = votesFor + votesAgainst;
  if (total <= 0) return null;
  return (votesFor / total) * 100;
}

export function buildGovernanceVoteShareStatusLine(input: {
  endTime: Date;
  votesFor: number;
  votesAgainst: number;
  now?: Date;
}): string | null {
  const percent = yesSharePercent(input.votesFor, input.votesAgainst);
  if (percent === null) return null;

  const rounded = Math.round(percent);
  const result = rounded > 50 ? "passing" : "failing";
  const timeLeft = formatGovernanceShareTimeLeft(
    input.endTime,
    input.now ?? new Date()
  );
  const timePhrase = timeLeft
    ? `has ${timeLeft} left`
    : "has ended";

  return `This proposal ${timePhrase}, and is currently ${result} with ${rounded}% of the vote.`;
}

export function buildGovernanceVoteShareText(input: {
  support: boolean;
  proposalTitle: string;
  endTime: Date;
  votesFor: number;
  votesAgainst: number;
  now?: Date;
}): string {
  const titleForShare =
    input.proposalTitle.length > 100
      ? `${input.proposalTitle.slice(0, 97)}...`
      : input.proposalTitle;
  const voteLabel = input.support ? "YES" : "NO";
  const firstLine = `Voted ${voteLabel} on "${titleForShare}" in @dork_fi governance 🗳️`;
  const statusLine = buildGovernanceVoteShareStatusLine({
    endTime: input.endTime,
    votesFor: input.votesFor,
    votesAgainst: input.votesAgainst,
    now: input.now,
  });
  return statusLine ? `${firstLine}\n\n${statusLine}` : firstLine;
}

export function governanceVoteShareUrl(): string {
  return GOVERNANCE_VOTE_SHARE_URL;
}

export function buildGovernanceVoteIntentUrl(
  shareText: string,
  shareUrl: string
): string {
  return `${X_INTENT_BASE}?text=${encodeURIComponent(
    shareText
  )}&url=${encodeURIComponent(shareUrl)}`;
}
