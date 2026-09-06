import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getShareServerHealth } from "@/services/xShareService";
import {
  generateProfileShareImage,
  revokeProfileShareResult,
} from "@/utils/profileShare/generateProfileShareImage";
import {
  getProfileShareHelperText,
  getProfileShareOutcomeMessage,
  shareProfileConfirmation,
  supportsNativeFileShare,
  XShareLinkUnavailableError,
} from "@/utils/profileShare/shareProfileConfirmation";
import type { ProfileShareResult } from "@/utils/profileShare/types";
import { resolveProfileShareCollection } from "@/utils/profileShare/format";

interface TopAsset {
  asset: string;
  icon: string;
  value: number;
  apy?: number;
}

interface ProfileUpdateSuccessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  avatarImage?: string;
  /** Selected NFT display name, e.g. "DORK 12". */
  nftName?: string;
  /** Voi ARC-72 contract id (also used for bridged Algorand avatars). */
  nftContractId?: number;
  collectionName?: string;
  /** Kept for call-site compatibility; no longer shown in the modal preview. */
  healthFactor?: number | null;
  deposits?: TopAsset[];
  borrows?: TopAsset[];
  netLTV?: number;
  addressName?: string | null;
}

const ProfileUpdateSuccessModal: React.FC<ProfileUpdateSuccessModalProps> = ({
  open,
  onOpenChange,
  avatarImage,
  nftName,
  nftContractId,
  collectionName,
  addressName,
}) => {
  const { toast } = useToast();
  const resolvedNftName = nftName?.trim() || "my NFT";
  const collectionId = resolveProfileShareCollection({
    contractId: nftContractId,
    nftName: resolvedNftName,
  });

  const [celebrationParticles, setCelebrationParticles] = useState<
    Array<{
      id: number;
      type: "bubble";
      x: number;
      y: number;
      size: number;
      speed: number;
      delay: number;
      driftX: number;
    }>
  >([]);

  const [shareImage, setShareImage] = useState<ProfileShareResult | null>(null);
  const shareImageRef = useRef<ProfileShareResult | null>(null);
  const [isGeneratingShare, setIsGeneratingShare] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [linkShareServerOk, setLinkShareServerOk] = useState(true);

  useEffect(() => {
    shareImageRef.current = shareImage;
  }, [shareImage]);

  useEffect(() => {
    if (open) {
      const particles: Array<{
        id: number;
        type: "bubble";
        x: number;
        y: number;
        size: number;
        speed: number;
        delay: number;
        driftX: number;
      }> = [];

      for (let i = 0; i < 20; i++) {
        particles.push({
          id: i,
          type: "bubble",
          x: Math.random() * 100,
          y: 100 + Math.random() * 20,
          size: 8 + Math.random() * 12,
          speed: 0.3 + Math.random() * 0.4,
          delay: Math.random() * 2,
          driftX: (Math.random() - 0.5) * 100,
        });
      }

      setCelebrationParticles(particles);
      const timer = setTimeout(() => setCelebrationParticles([]), 5000);
      return () => clearTimeout(timer);
    }
    setCelebrationParticles([]);
  }, [open]);

  useEffect(() => {
    if (open) {
      const styleId = "profile-update-celebration-styles";
      if (!document.getElementById(styleId)) {
        const style = document.createElement("style");
        style.id = styleId;
        style.textContent = `
          @keyframes bubble-rise {
            0% { transform: translateY(0) translateX(0) scale(0.8); opacity: 0; }
            10% { opacity: 0.7; }
            90% { opacity: 0.5; }
            100% { transform: translateY(-100vh) translateX(var(--drift-x, 0px)) scale(1.2); opacity: 0; }
          }
          .celebration-bubble {
            position: absolute;
            border-radius: 50%;
            background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.8), rgba(0,200,255,0.3));
            border: 1px solid rgba(255,255,255,0.4);
            animation: bubble-rise var(--duration, 4s) ease-out var(--delay, 0s) forwards;
            pointer-events: none;
          }
        `;
        document.head.appendChild(style);
      }
      return () => {
        const styleTag = document.getElementById(styleId);
        if (styleTag && !open) styleTag.remove();
      };
    }
  }, [open]);

  useEffect(() => {
    if (!open || !avatarImage) {
      revokeProfileShareResult(shareImageRef.current);
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
      revokeProfileShareResult(shareImageRef.current);
      shareImageRef.current = null;
      setShareImage(null);

      try {
        const [result, health] = await Promise.all([
          generateProfileShareImage({
            avatarImage,
            nftName: resolvedNftName,
            contractId: nftContractId,
            collectionId,
            addressName,
          }),
          getShareServerHealth(),
        ]);
        if (cancelled) {
          revokeProfileShareResult(result);
          return;
        }
        shareImageRef.current = result;
        setShareImage(result);
        setLinkShareServerOk(Boolean(health.ok && health.linkShareEnabled));
        const file = new File([result.blob], "dorkfi-profile-update.png", {
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
  }, [
    open,
    avatarImage,
    resolvedNftName,
    nftContractId,
    collectionId,
    addressName,
  ]);

  useEffect(() => {
    return () => {
      revokeProfileShareResult(shareImageRef.current);
    };
  }, []);

  const handleShare = useCallback(async () => {
    if (!shareImage || isSharing) return;

    setIsSharing(true);
    try {
      const result = await shareProfileConfirmation(shareImage, {
        nftName: resolvedNftName,
        contractId: nftContractId,
        collectionId,
      });
      const message = getProfileShareOutcomeMessage(result.outcome);
      toast({
        title: message.title,
        description: message.description,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      const description =
        error instanceof XShareLinkUnavailableError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Could not share on X";
      toast({
        title: "Share failed",
        description,
        variant: "destructive",
      });
    } finally {
      setIsSharing(false);
    }
  }, [
    shareImage,
    isSharing,
    resolvedNftName,
    nftContractId,
    collectionId,
    toast,
  ]);

  const shareDisabled =
    isSharing || isGeneratingShare || !shareImage || Boolean(shareError);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg lg:max-w-xl p-6 overflow-hidden [&>button:has(span.sr-only)]:hidden relative z-50">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="h-6 w-6 text-green-500" />
            <DialogTitle>Profile Updated Successfully</DialogTitle>
          </div>
          <DialogDescription>
            Your profile NFT has been set. Share your new look with the
            community!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
            {celebrationParticles.map((particle) => (
              <div
                key={particle.id}
                className="celebration-bubble"
                style={
                  {
                    left: `${particle.x}%`,
                    bottom: "0%",
                    width: `${particle.size}px`,
                    height: `${particle.size}px`,
                    "--duration": "4s",
                    "--delay": `${particle.delay}s`,
                    "--drift-x": `${particle.driftX}px`,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>

          <div className="relative w-full max-w-lg mx-auto rounded-2xl overflow-hidden border-2 border-ocean-teal/30 bg-slate-900/40 aspect-[1200/675]">
            {shareImage ? (
              <img
                src={shareImage.objectUrl}
                alt={`${resolvedNftName} share card`}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground gap-2">
                {shareError ? (
                  <span className="px-4 text-center text-destructive">
                    {shareError}
                  </span>
                ) : (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Preparing share card…
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <p className="text-xs text-muted-foreground text-center">
              {shareError
                ? shareError
                : getProfileShareHelperText(canNativeShare, linkShareServerOk)}
            </p>
            {(collectionName || resolvedNftName) && (
              <p className="text-xs text-muted-foreground text-center">
                Sharing {resolvedNftName}
                {collectionName ? ` · ${collectionName}` : ""}
              </p>
            )}
            <Button
              onClick={() => void handleShare()}
              className="w-full bg-[#1DA1F2] hover:bg-[#1a8cd8] text-white"
              size="lg"
              disabled={shareDisabled}
            >
              {isGeneratingShare || isSharing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isSharing ? "Opening X…" : "Preparing card…"}
                </>
              ) : (
                "Share on X"
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProfileUpdateSuccessModal;
