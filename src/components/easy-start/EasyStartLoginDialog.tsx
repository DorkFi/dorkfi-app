import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useSendEmailOTP, useVerifyOTP } from "@dynamic-labs-sdk/react-hooks";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface EasyStartLoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EasyStartLoginDialog({
  open,
  onOpenChange,
}: EasyStartLoginDialogProps) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const send = useSendEmailOTP();
  const verify = useVerifyOTP();

  useEffect(() => {
    if (open) return;
    setEmail("");
    setCode("");
    setError(null);
    send.reset();
    verify.reset();
  }, [open, send.reset, verify.reset]);

  useEffect(() => {
    if (!verify.isSuccess) return;
    onOpenChange(false);
  }, [onOpenChange, verify.isSuccess]);

  const sendCode = async () => {
    setError(null);
    const trimmed = email.trim();
    if (!trimmed.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    try {
      await send.mutateAsync({ email: trimmed });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn’t send the code.");
    }
  };

  const verifyCode = async () => {
    if (!send.data) return;
    setError(null);
    try {
      await verify.mutateAsync({
        otpVerification: send.data,
        verificationToken: code.trim(),
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "That code didn’t work.");
    }
  };

  const pending = send.isPending || verify.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 text-slate-800 dark:text-white rounded-xl border border-gray-200/50 dark:border-ocean-teal/20 shadow-xl max-w-[95vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center text-slate-800 dark:text-white">
            Get started
          </DialogTitle>
          <DialogDescription className="text-center text-sm text-slate-600 dark:text-slate-400">
            {send.data
              ? `Enter the code sent to ${email.trim()}.`
              : "We’ll email you a code and create a wallet on Base."}
          </DialogDescription>
        </DialogHeader>

        {send.data ? (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void verifyCode();
            }}
          >
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className="bg-white/80 dark:bg-slate-900/60"
            />
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <Button
              type="submit"
              className="w-full bg-ocean-teal hover:bg-ocean-teal/90 text-white"
              disabled={pending || code.trim().length < 4}
            >
              {verify.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Verify
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              disabled={pending}
              onClick={() => {
                setCode("");
                setError(null);
                send.reset();
              }}
            >
              Use a different email
            </Button>
          </form>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void sendCode();
            }}
          >
            <Input
              type="email"
              autoComplete="email"
              placeholder="you@email.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="bg-white/80 dark:bg-slate-900/60"
            />
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <Button
              type="submit"
              className="w-full bg-ocean-teal hover:bg-ocean-teal/90 text-white"
              disabled={pending || email.trim().length === 0}
            >
              {send.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Email me a code
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
