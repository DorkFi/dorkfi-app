import type { GovernanceShareResult } from "@/utils/governanceShare/types";

export type XShareStatus = {
  connected: boolean;
  configured: boolean;
  linkShareEnabled?: boolean;
  username?: string;
  userId?: string;
};

export type XSharePostResult = {
  tweetId: string;
  tweetUrl: string;
};

export type GovernanceShareLinkInput = {
  proposalId: string;
  proposalTitle: string;
  support: boolean;
  votingPower: number;
  image: Blob;
};

export type GovernanceShareLinkResult = {
  shareId: string;
  shareUrl: string;
  imageUrl: string;
};

export class XShareNotConnectedError extends Error {
  constructor() {
    super("Connect your X account before sharing");
    this.name = "XShareNotConnectedError";
  }
}

export class XShareApiError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "XShareApiError";
    this.status = status;
  }
}

export function xShareApiBase(): string {
  const raw = import.meta.env.VITE_X_SHARE_API_BASE?.trim();
  if (raw) return raw.replace(/\/+$/, "");
  return "/api/x-share";
}

export function isXShareApiConfigured(): boolean {
  return Boolean(xShareApiBase());
}

function buildUrl(path: string): string {
  const base = xShareApiBase();
  if (base.startsWith("http://") || base.startsWith("https://")) {
    return `${base}${path}`;
  }
  return `${base}${path}`;
}

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!response.ok) {
    let message = text || response.statusText;
    try {
      const json = JSON.parse(text) as { error?: string };
      if (json.error) message = json.error;
    } catch {
      // keep raw text
    }
    throw new XShareApiError(message, response.status);
  }
  return JSON.parse(text) as T;
}

export async function getXShareStatus(): Promise<XShareStatus> {
  const response = await fetch(buildUrl("/auth/x/status"), {
    credentials: "include",
  });
  return parseJson<XShareStatus>(response);
}

export function startXShareConnect(returnTo = "/governance"): void {
  const url = new URL(buildUrl("/auth/x/start"), window.location.origin);
  url.searchParams.set("returnTo", returnTo);
  if (xShareApiBase().startsWith("/")) {
    window.location.href = `${url.pathname}${url.search}`;
    return;
  }
  window.location.href = url.toString();
}

export async function disconnectXShare(): Promise<void> {
  const response = await fetch(buildUrl("/auth/x/disconnect"), {
    method: "POST",
    credentials: "include",
  });
  await parseJson<{ connected: boolean }>(response);
}

export async function postGovernanceVoteToX(
  result: GovernanceShareResult,
  text: string
): Promise<XSharePostResult> {
  const form = new FormData();
  form.append(
    "image",
    new File([result.blob], "dorkfi-governance-vote.png", { type: "image/png" })
  );
  form.append("text", text);

  const response = await fetch(buildUrl("/share/governance-vote"), {
    method: "POST",
    credentials: "include",
    body: form,
  });

  const json = await parseJson<{
    ok: boolean;
    tweetId: string;
    tweetUrl: string;
  }>(response);

  return {
    tweetId: json.tweetId,
    tweetUrl: json.tweetUrl,
  };
}

export async function createGovernanceShareLink(
  input: GovernanceShareLinkInput
): Promise<GovernanceShareLinkResult> {
  const form = new FormData();
  form.append(
    "image",
    new File([input.image], "dorkfi-governance-vote.png", { type: "image/png" })
  );
  form.append("proposalId", input.proposalId);
  form.append("proposalTitle", input.proposalTitle);
  form.append("support", String(input.support));
  form.append("votingPower", String(input.votingPower));

  const response = await fetch(buildUrl("/share/governance-vote/link"), {
    method: "POST",
    body: form,
  });

  const json = await parseJson<{
    ok: boolean;
    shareId: string;
    shareUrl: string;
    imageUrl: string;
  }>(response);

  return {
    shareId: json.shareId,
    shareUrl: json.shareUrl,
    imageUrl: json.imageUrl,
  };
}

export function getXShareHelperText(
  status: XShareStatus,
  canNativeShare: boolean
): string {
  const linkShareAvailable = status.linkShareEnabled !== false;

  if (status.configured && status.connected) {
    return `Connected as ${status.username ?? "your X account"}. Share on X will post your image and tweet text automatically.`;
  }
  if (linkShareAvailable) {
    if (status.configured) {
      return "Share on X opens compose with a link — your vote card appears as a preview when you post. Connect X for one-click image posts.";
    }
    return "Share on X opens compose with a link — your vote card appears as a preview when you post.";
  }
  if (status.configured) {
    return "Connect your X account to post your vote image automatically on desktop and mobile.";
  }
  if (canNativeShare) {
    return "Tap Share on X, then choose X from the share menu to post with your image attached.";
  }
  return "Your image will be copied — paste it into the X compose window (⌘V or Ctrl+V). Tweet text opens in a new tab.";
}
