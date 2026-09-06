import {
  createProfileShareLink,
  getShareServerHealth,
  isXShareApiConfigured,
  XShareLinkUnavailableError,
} from "@/services/xShareService";
import { buildProfileShareTweetText } from "./format";
import type {
  ProfileShareResult,
  ShareProfileConfirmationOutcome,
} from "./types";
import {
  buildXIntentUrl,
  supportsNativeFileShare,
} from "@/utils/repayShare/shareRepayConfirmation";

const SHARE_FILENAME = "dorkfi-profile-update.png";
const SHARE_TITLE = "DorkFi Profile Update";

export { XShareLinkUnavailableError } from "@/services/xShareService";
export { buildXIntentUrl, supportsNativeFileShare } from "@/utils/repayShare/shareRepayConfirmation";

export function getProfileShareHelperText(
  canNativeShare: boolean,
  linkShareServerOk = true
): string {
  if (!linkShareServerOk) {
    return "Share link service is unavailable. Try again in a moment.";
  }
  if (canNativeShare) {
    return "Share on X opens compose with a link — your profile card appears as a preview when you post. On mobile you can also share the image file.";
  }
  return "Share on X opens compose with a permalink — X shows your profile card as a link preview when you post.";
}

export function getProfileShareOutcomeMessage(
  outcome: ShareProfileConfirmationOutcome
): { title: string; description: string } {
  switch (outcome) {
    case "link":
      return {
        title: "Ready to share on X",
        description:
          "Compose opened with your share link. Your profile card preview appears when you post.",
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

export function downloadProfileShareImage(
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

export type ShareProfileConfirmationOptions = {
  text?: string;
  filename?: string;
  nftName: string;
  contractId?: number;
  collectionId?: string;
};

export type ShareProfileConfirmationResult = {
  outcome: ShareProfileConfirmationOutcome;
  shareUrl?: string;
};

function resolveShareTweetText(
  options: ShareProfileConfirmationOptions,
  shareUrl?: string
): string {
  if (options.text) return options.text;
  return buildProfileShareTweetText({
    nftName: options.nftName,
    contractId: options.contractId,
    collectionId: options.collectionId as
      | "dorks_v1"
      | "dorks_v2"
      | "lil_chubs"
      | "unknown"
      | undefined,
    shareUrl,
  });
}

async function resolveLinkShare(
  result: ProfileShareResult,
  options: ShareProfileConfirmationOptions
): Promise<
  | { attempted: false }
  | { attempted: true; healthOk: false }
  | { attempted: true; healthOk: true; shareUrl: string }
  | { attempted: true; healthOk: true; shareUrl: null }
> {
  if (!isXShareApiConfigured() || !options.nftName?.trim()) {
    return { attempted: false };
  }

  const health = await getShareServerHealth();
  if (!health.ok || !health.linkShareEnabled) {
    return { attempted: true, healthOk: false };
  }

  try {
    const link = await createProfileShareLink({
      nftName: options.nftName,
      contractId: options.contractId,
      collectionId: options.collectionId,
      image: result.blob,
    });
    return { attempted: true, healthOk: true, shareUrl: link.shareUrl };
  } catch {
    return { attempted: true, healthOk: true, shareUrl: null };
  }
}

export async function shareProfileConfirmation(
  result: ProfileShareResult,
  options: ShareProfileConfirmationOptions
): Promise<ShareProfileConfirmationResult> {
  const filename = options.filename ?? SHARE_FILENAME;
  const file = new File([result.blob], filename, { type: "image/png" });

  const linkShare = await resolveLinkShare(result, options);

  if (linkShare.attempted && linkShare.healthOk && linkShare.shareUrl) {
    const text = resolveShareTweetText(options, linkShare.shareUrl);
    openXCompose(text);
    return { outcome: "link", shareUrl: linkShare.shareUrl };
  }

  if (
    linkShare.attempted &&
    linkShare.healthOk &&
    linkShare.shareUrl === null
  ) {
    throw new XShareLinkUnavailableError(
      "Could not create a share link for your profile image. Please try again."
    );
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
    downloadProfileShareImage(result.blob, filename);
    openXCompose(fallbackText);
    return { outcome: "download" };
  } catch {
    openXCompose(fallbackText);
    return { outcome: "text-only" };
  }
}
