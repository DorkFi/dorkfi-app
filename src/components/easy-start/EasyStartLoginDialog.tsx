import { useEffect, useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { useSendEmailOTP, useVerifyOTP } from "@dynamic-labs-sdk/react-hooks";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  EASY_START_FUNDING_DIALOG_CLASS,
  FundingPrimaryButton,
  FundingSheetHeader,
} from "@/components/easy-start/EasyStartFundingUi";

interface EasyStartLoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FIELD_CLASS =
  "h-12 rounded-xl border-border bg-background text-base";

function MailMark() {
  return (
    <span
      className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-ocean-teal/15 text-ocean-teal"
      aria-hidden
    >
      <Mail className="h-7 w-7" />
    </span>
  );
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
  const onCodeStep = Boolean(send.data);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={EASY_START_FUNDING_DIALOG_CLASS}>
        <div className="flex flex-col min-h-0">
          <FundingSheetHeader
            title="Get started"
            subtitle={
              onCodeStep
                ? `Enter the code sent to ${email.trim()}.`
                : "Sign up or sign in with your email."
            }
            icon={<MailMark />}
          />
          {onCodeStep ? (
            <form
              className="space-y-4 px-6 pb-6 pt-2"
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
                className={FIELD_CLASS}
              />
              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
              <FundingPrimaryButton
                type="submit"
                disabled={pending || code.trim().length < 4}
              >
                {verify.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Verify
              </FundingPrimaryButton>
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
              className="space-y-4 px-6 pb-6 pt-2"
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
                className={FIELD_CLASS}
              />
              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
              <FundingPrimaryButton
                type="submit"
                disabled={pending || email.trim().length === 0}
              >
                {send.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Email me a code
              </FundingPrimaryButton>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
