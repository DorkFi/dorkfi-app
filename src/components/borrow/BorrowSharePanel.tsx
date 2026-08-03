import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  generateBorrowShareImage,
  revokeBorrowShareResult,
} from "@/utils/borrowShare/generateBorrowShareImage";
import {
  getBorrowShareHelperText,
  getBorrowShareOutcomeMessage,
  shareBorrowConfirmation,
  supportsNativeFileShare,
} from "@/utils/borrowShare/shareBorrowConfirmation";
import { getShareServerHealth } from "@/services/xShareService";
import type { BorrowShareResult } from "@/utils/borrowShare/types";

type BorrowSharePanelProps = {
  active: boolean;
  amount: string;
  assetSymbol: string;
  assetIconSrc?: string;
  network?: string;
};

export function BorrowSharePanel({
  active,
  amount,
  assetSymbol,
  assetIconSrc,
  network,
}: BorrowSharePanelProps) {
  const { toast } = useToast();
  const [shareImage, setShareImage] = useState<BorrowShareResult | null>(null);
  const shareImageRef = useRef<BorrowShareResult | null>(null);
  const [isGeneratingShare, setIsGeneratingShare] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [linkShareServerOk, setLinkShareServerOk] = useState(true);

  useEffect(() => {
    shareImageRef.current = shareImage;
  }, [shareImage]);

  useEffect(() => {
    if (!active) {
      revokeBorrowShareResult(shareImageRef.current);
      shareImageRef.current = null;
      setShareImage(null);
      setShareError(null);
      setIsGeneratingShare(false);
      setIsSharing(false);
      return;
    }

    let cancelled = false;

    const generate = async () => {
      setIsGeneratingShare(true);
      setShareError(null);
      revokeBorrowShareResult(shareImageRef.current);
      shareImageRef.current = null;
      setShareImage(null);

      try {
        const result = await generateBorrowShareImage({
          amount,
          assetSymbol,
          assetIconSrc,
          network,
        });
        if (cancelled) {
          revokeBorrowShareResult(result);
          return;
        }
        shareImageRef.current = result;
        setShareImage(result);
        const file = new File([result.blob], "dorkfi-borrow-confirmation.png", {
          type: "image/png",
        });
        setCanNativeShare(supportsNativeFileShare(file));
      } catch (error) {
        if (cancelled) return;
        setShareError(
          error instanceof Error
            ? error.message
            : "Could not create share image"
        );
      } finally {
        if (!cancelled) setIsGeneratingShare(false);
      }
    };

    void generate();

    return () => {
      cancelled = true;
    };
  }, [active, amount, assetSymbol, assetIconSrc, network]);

  useEffect(() => {
    return () => {
      revokeBorrowShareResult(shareImageRef.current);
      shareImageRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void getShareServerHealth().then((health) => {
      if (!cancelled) {
        setLinkShareServerOk(health.ok && health.linkShareEnabled);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [active]);

  const handleShare = useCallback(async () => {
    if (!shareImage || isSharing) return;

    setIsSharing(true);
    try {
      const result = await shareBorrowConfirmation(shareImage, {
        amount,
        assetSymbol,
        network,
      });
      toast(getBorrowShareOutcomeMessage(result.outcome));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      toast({
        title: "Share failed",
        description:
          error instanceof Error
            ? error.message
            : "Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setIsSharing(false);
    }
  }, [shareImage, isSharing, toast, amount, assetSymbol, network]);

  if (!active) return null;

  return (
    <div className="w-full space-y-3 pt-2">
      <p className="text-center text-xs text-muted-foreground">
        {shareError ??
          getBorrowShareHelperText(canNativeShare, linkShareServerOk)}
      </p>

      <button
        type="button"
        onClick={() => void handleShare()}
        disabled={!shareImage || isGeneratingShare || isSharing}
        className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-border bg-black px-6 py-3 text-center text-base font-semibold text-white transition hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-gray-100"
      >
        {isSharing || isGeneratingShare ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden
          >
            <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
          </svg>
        )}
        Share on X
      </button>
    </div>
  );
}
