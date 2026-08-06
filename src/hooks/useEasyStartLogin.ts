import { useCallback, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { usePrivyEasyStart } from "@/contexts/PrivySessionProvider";
import { getPrivyOriginHint } from "@/utils/privyOrigin";

const READY_WAIT_MS = 15_000;
const DROPDOWN_RELEASE_MS = 120;

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

  useEffect(() => {
    readyRef.current = privy.ready;
    loginRef.current = privy.login;
    authenticatedRef.current = privy.authenticated;
  }, [privy.ready, privy.login, privy.authenticated]);

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

    if (!loginRef.current) {
      toast({
        title: "Easy Start unavailable",
        description:
          "Privy did not initialize. Confirm VITE_PRIVY_APP_ID, then hard-refresh on an allowlisted origin (http://localhost:8080 or http://localhost:5173).",
        variant: "destructive",
      });
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
          ? "Hard-refresh (Cmd+Shift+R) on http://localhost:8080 or http://localhost:5173. If it persists, check the browser console for blocked requests to auth.privy.io."
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
    loginRef.current({ loginMethods: ["email"] });
  }, [toast]);
}
