import { useCallback, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  hasQueuedEasyStartLogin,
  queueEasyStartLogin,
  usePrivyEasyStart,
} from "@/contexts/privyEasyStartContext";
import { getPrivyOriginHint } from "@/utils/privyOrigin";

const LOGIN_ATTACH_WAIT_MS = 3_000;
const READY_WAIT_MS = 15_000;
const DROPDOWN_RELEASE_MS = 120;
const OVERLAY_RELEASE_MS = 200;

/** Let a Radix Dialog overlay unmount before opening the Privy modal. */
export function afterOverlayClose(fn: () => void, ms = OVERLAY_RELEASE_MS) {
  window.setTimeout(fn, ms);
}

function currentOrigin(): string {
  return typeof window !== "undefined" ? window.location.origin : "";
}

function refreshHint(): string {
  const origin = currentOrigin() || "this page";
  return `Hard-refresh (Cmd+Shift+R) on ${origin}. If it persists, check the browser console for blocked requests to auth.privy.io.`;
}

/**
 * Opens Privy login only after `ready` is true.
 * Calling `login()` while Privy is not ready waits forever (no modal).
 */
export function useEasyStartLogin() {
  const privy = usePrivyEasyStart();
  const { toast } = useToast();

  const readyRef = useRef(privy.ready);
  const loginRef = useRef(privy.login);
  const authenticatedRef = useRef(privy.authenticated);
  const blockReasonRef = useRef(privy.blockReason);

  useEffect(() => {
    readyRef.current = privy.ready;
    loginRef.current = privy.login;
    authenticatedRef.current = privy.authenticated;
    blockReasonRef.current = privy.blockReason;
  }, [privy.ready, privy.login, privy.authenticated, privy.blockReason]);

  return useCallback(async () => {
    const originHint = getPrivyOriginHint();
    if (originHint) {
      toast({
        title: "Wrong URL for Easy Start",
        description: originHint,
        variant: "destructive",
      });
      return;
    }

    if (blockReasonRef.current) {
      toast({
        title: "Can't open Get Started",
        description: blockReasonRef.current,
        variant: "destructive",
      });
      return;
    }

    if (!loginRef.current) {
      queueEasyStartLogin();
      toast({
        title: "Starting Easy Start…",
        description: "Loading sign-in. The login window will open in a moment.",
      });
      const deadline = Date.now() + LOGIN_ATTACH_WAIT_MS;
      while (!loginRef.current && !blockReasonRef.current && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 100));
      }
    }

    if (blockReasonRef.current) {
      toast({
        title: "Can't open Get Started",
        description: blockReasonRef.current,
        variant: "destructive",
      });
      return;
    }

    if (!loginRef.current) {
      if (hasQueuedEasyStartLogin()) {
        toast({
          title: "Privy failed to load",
          description: refreshHint(),
          variant: "destructive",
        });
      }
      return;
    }

    if (!readyRef.current) {
      toast({
        title: "Starting Easy Start…",
        description: "Waiting for Privy to finish loading.",
      });
      const deadline = Date.now() + READY_WAIT_MS;
      while (!readyRef.current && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 100));
      }
    }

    if (!readyRef.current) {
      const reloadKey = "easy-start-privy-reload";
      const alreadyReloaded = sessionStorage.getItem(reloadKey) === "1";
      toast({
        title: "Privy failed to load",
        description: alreadyReloaded
          ? refreshHint()
          : "Reloading once to recover Privy after hot-reload…",
        variant: "destructive",
      });
      if (!alreadyReloaded && import.meta.env.DEV) {
        sessionStorage.setItem(reloadKey, "1");
        window.location.reload();
      }
      return;
    }

    sessionStorage.removeItem("easy-start-privy-reload");

    if (authenticatedRef.current) {
      toast({
        title: "Already signed in",
        description: "Refreshing your Easy Start session…",
      });
      window.location.reload();
      return;
    }

    await new Promise((r) => setTimeout(r, DROPDOWN_RELEASE_MS));
    try {
      loginRef.current();
    } catch (error) {
      console.error("[Easy Start] login() threw", error);
      toast({
        title: "Get Started failed",
        description:
          error instanceof Error ? error.message : refreshHint(),
        variant: "destructive",
      });
    }
  }, [toast]);
}
