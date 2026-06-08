import {
  createGovernanceShareLink,
  getXShareStatus,
  isXShareApiConfigured,
  postGovernanceVoteToX,
} from "@/services/xShareService";
import {
  buildGenericGovernanceShareTweetText,
  buildGovernanceShareTweetText,
} from "./format";
import type {
  GovernanceShareResult,
  ShareGovernanceVoteOutcome,
} from "./types";

const SHARE_FILENAME = "dorkfi-governance-vote.png";
const X_INTENT_BASE = "https://x.com/intent/tweet";
const SHARE_TITLE = "DorkFi Governance Vote";

export { XShareNotConnectedError } from "@/services/xShareService";

export function buildXIntentUrl(text: string): string {
  return `${X_INTENT_BASE}?text=${encodeURIComponent(text)}`;
}

export function supportsNativeFileShare(file: File): boolean {
  return Boolean(navigator.canShare?.({ files: [file] }));
}

export function getGovernanceShareHelperText(canNativeShare: boolean): string {
  if (canNativeShare) {
    return "Tap Share on X, then choose X from the share menu to post with your image attached.";
  }
  return "Your image will be copied — paste it into the X compose window (⌘V or Ctrl+V). Tweet text opens in a new tab.";
}

export function getShareOutcomeMessage(
  outcome: ShareGovernanceVoteOutcome,
  tweetUrl?: string
): { title: string; description: string } {
  switch (outcome) {
    case "api":
      return {
        title: "Posted to X",
        description: tweetUrl
          ? "Your governance vote was shared with image attached."
          : "Your governance vote was shared on X.",
      };
    case "link":
      return {
        title: "Ready to share on X",
        description:
          "Compose opened with your share link. Your vote card preview appears when you post.",
      };
    case "native":
      return {
        title: "Ready to share",
        description: "Choose X from the share menu to post with your image.",
      };
    case "clipboard":
      return {
        title: "Image copied",
        description:
          "Paste into your X post with ⌘V or Ctrl+V. Compose window opened with your tweet text.",
      };
    case "download":
      return {
        title: "Image saved",
        description:
          "Attach the downloaded image to your X post. Compose window opened with your tweet text.",
      };
    case "text-only":
      return {
        title: "Opened X compose",
        description: "Save the image first, then attach it to your post.",
      };
  }
}

export function downloadGovernanceShareImage(
  blob: Blob,
  filename = SHARE_FILENAME
): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function openXCompose(text: string): void {
  window.open(buildXIntentUrl(text), "_blank", "noopener,noreferrer");
}

type NativeSharePayload = ShareData & { files?: File[] };

function canSharePayload(payload: NativeSharePayload): boolean {
  return Boolean(navigator.canShare?.(payload));
}

async function tryNativeShare(file: File, text: string): Promise<boolean> {
  if (!navigator.share) return false;

  const attempts: NativeSharePayload[] = [
    { files: [file] },
    { files: [file], text },
    { files: [file], title: SHARE_TITLE, text },
  ];

  for (const payload of attempts) {
    if (!canSharePayload(payload)) continue;

    try {
      await navigator.share(payload);
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }
    }
  }

  return false;
}

function hasLinkShareMetadata(options: ShareGovernanceVoteOptions): boolean {
  return (
    options.proposalId !== undefined &&
    options.proposalTitle !== undefined &&
    options.support !== undefined &&
    options.votingPower !== undefined
  );
}

function hasShareTweetMetadata(options: ShareGovernanceVoteOptions): boolean {
  return (
    options.proposalTitle !== undefined &&
    options.support !== undefined &&
    options.votingPower !== undefined
  );
}

function resolveShareTweetText(
  options: ShareGovernanceVoteOptions,
  shareUrl?: string
): string {
  if (options.text) return options.text;
  if (hasShareTweetMetadata(options)) {
    return buildGovernanceShareTweetText({
      support: options.support!,
      proposalTitle: options.proposalTitle!,
      votingPower: options.votingPower!,
      shareUrl,
    });
  }
  return buildGenericGovernanceShareTweetText(shareUrl);
}

async function tryApiShare(
  result: GovernanceShareResult,
  text: string
): Promise<{ outcome: "api"; tweetUrl: string } | null> {
  if (!isXShareApiConfigured()) return null;

  let status;
  try {
    status = await getXShareStatus();
  } catch {
    return null;
  }

  if (!status?.configured || !status.connected) return null;

  const posted = await postGovernanceVoteToX(result, text);
  return { outcome: "api", tweetUrl: posted.tweetUrl };
}

async function tryLinkShare(
  result: GovernanceShareResult,
  options: ShareGovernanceVoteOptions
): Promise<string | null> {
  if (!isXShareApiConfigured() || !hasLinkShareMetadata(options)) {
    return null;
  }

  try {
    const link = await createGovernanceShareLink({
      proposalId: options.proposalId!,
      proposalTitle: options.proposalTitle!,
      support: options.support!,
      votingPower: options.votingPower!,
      image: result.blob,
    });
    return link.shareUrl;
  } catch {
    return null;
  }
}

export type ShareGovernanceVoteOptions = {
  text?: string;
  filename?: string;
  proposalId?: string;
  proposalTitle?: string;
  support?: boolean;
  votingPower?: number;
};

export type ShareGovernanceVoteResult = {
  outcome: ShareGovernanceVoteOutcome;
  tweetUrl?: string;
  shareUrl?: string;
};

export async function shareGovernanceVote(
  result: GovernanceShareResult,
  options: ShareGovernanceVoteOptions = {}
): Promise<ShareGovernanceVoteResult> {
  const filename = options.filename ?? SHARE_FILENAME;
  const file = new File([result.blob], filename, { type: "image/png" });
  const defaultText = resolveShareTweetText(options);

  const apiResult = await tryApiShare(result, defaultText);
  if (apiResult) {
    return apiResult;
  }

  const shareUrl = await tryLinkShare(result, options);
  if (shareUrl) {
    const text = resolveShareTweetText(options, shareUrl);
    openXCompose(text);
    return { outcome: "link", shareUrl };
  }

  const fallbackText = resolveShareTweetText(options);

  if (supportsNativeFileShare(file)) {
    const shared = await tryNativeShare(file, fallbackText);
    if (shared) return { outcome: "native" };
  }

  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": result.blob }),
      ]);
      openXCompose(fallbackText);
      return { outcome: "clipboard" };
    } catch {
      // fall through to download
    }
  }

  try {
    downloadGovernanceShareImage(result.blob, filename);
    openXCompose(fallbackText);
    return { outcome: "download" };
  } catch {
    openXCompose(fallbackText);
    return { outcome: "text-only" };
  }
}
