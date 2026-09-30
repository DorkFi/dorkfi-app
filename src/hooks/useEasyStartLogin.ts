import { useCallback, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { usePrivyEasyStart } from "@/contexts/PrivySessionProvider";
import { getPrivyOriginHint } from "@/utils/privyOrigin";

const READY_WAIT_MS = 15_000;
const DROPDOWN_RELEASE_MS = 120;

/**
 * Opens the Easy Start email dialog only after Dynamic has finished init.
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
          "Dynamic did not initialize. Confirm VITE_DYNAMIC_ENVIRONMENT_ID, then hard-refresh on http://localhost:8080.",
        variant: "destructive",
      });
      return;
    }

    if (!readyRef.current) {
      toast({
        title: "Starting Easy Start…",
        description: "Waiting for Dynamic to finish loading.",
      });
      const deadline = Date.now() + READY_WAIT_MS;
      while (!readyRef.current && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 100));
      }
    }

    if (!readyRef.current) {
      const reloadKey = "easy-start-dynamic-reload";
      const alreadyReloaded = sessionStorage.getItem(reloadKey) === "1";
      toast({
        title: "Dynamic failed to load",
        description: alreadyReloaded
          ? "Hard-refresh (Cmd+Shift+R) on http://localhost:8080. If it persists, allowlist that origin in the Dynamic dashboard."
          : "Reloading once to recover Dynamic after hot-reload…",
        variant: "destructive",
      });
      if (!alreadyReloaded && import.meta.env.DEV) {
        sessionStorage.setItem(reloadKey, "1");
        window.location.reload();
      }
      return;
    }

    sessionStorage.removeItem("easy-start-dynamic-reload");

    if (authenticatedRef.current) {
      toast({
        title: "Already signed in",
        description: "Refreshing your Easy Start session…",
      });
      window.location.reload();
      return;
    }

    await new Promise((r) => setTimeout(r, DROPDOWN_RELEASE_MS));
    loginRef.current();
  }, [toast]);
}
