import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Wallet, CheckCircle2, XCircle, Loader2 } from "lucide-react";

type SignatureStatus = "pending" | "signing" | "success" | "error";

interface SignatureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: string;
  onSign: () => Promise<void>;
  onSuccess: () => void;
  onError: (error: Error) => void;
}

export const SignatureModal = ({
  open,
  onOpenChange,
  action,
  onSign,
  onSuccess,
  onError,
}: SignatureModalProps) => {
  const [status, setStatus] = useState<SignatureStatus>("pending");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStatus("pending");
      setError(null);
    }
  }, [open]);

  const handleSign = async () => {
    setStatus("signing");
    try {
      await onSign();
      setStatus("success");
      setTimeout(() => {
        onSuccess();
        onOpenChange(false);
      }, 1500);
    } catch (err) {
      setStatus("error");
      const errorMessage = err instanceof Error ? err.message : "Transaction failed";
      setError(errorMessage);
      onError(err instanceof Error ? err : new Error(errorMessage));
    }
  };

  const renderContent = () => {
    switch (status) {
      case "pending":
        return (
          <>
            <div className="mx-auto mb-4">
              <div className="p-4 rounded-full bg-primary/10 animate-pulse">
                <Wallet className="h-8 w-8 text-primary" />
              </div>
            </div>
            <DialogTitle className="text-xl">
              Wallet Signature Required
            </DialogTitle>
            <DialogDescription className="text-center pt-2">
              Please sign the transaction in your wallet to {action}
            </DialogDescription>
          </>
        );

      case "signing":
        return (
          <>
            <div className="mx-auto mb-4">
              <div className="p-4 rounded-full bg-primary/10">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
              </div>
            </div>
            <DialogTitle className="text-xl">
              Awaiting Signature
            </DialogTitle>
            <DialogDescription className="text-center pt-2">
              Please confirm the transaction in your wallet
            </DialogDescription>
          </>
        );

      case "success":
        return (
          <>
            <div className="mx-auto mb-4">
              <div className="p-4 rounded-full bg-green-500/10">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
            </div>
            <DialogTitle className="text-xl text-green-500">
              Transaction Signed
            </DialogTitle>
            <DialogDescription className="text-center pt-2">
              Your transaction has been submitted successfully
            </DialogDescription>
          </>
        );

      case "error":
        return (
          <>
            <div className="mx-auto mb-4">
              <div className="p-4 rounded-full bg-destructive/10">
                <XCircle className="h-8 w-8 text-destructive" />
              </div>
            </div>
            <DialogTitle className="text-xl text-destructive">
              Transaction Failed
            </DialogTitle>
            <DialogDescription className="text-center pt-2">
              {error || "Something went wrong. Please try again."}
            </DialogDescription>
          </>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={status === "signing" ? undefined : onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader className="pt-6 px-6">
          {renderContent()}
        </DialogHeader>

        <div className="px-6 pb-6 pt-4">
          {status === "pending" && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <p className="text-xs text-center text-muted-foreground">
                  This signature may incur network transaction fees
                </p>
              </div>
              <Button onClick={handleSign} className="w-full">
                Sign Transaction
              </Button>
            </div>
          )}

          {status === "signing" && (
            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <p className="text-xs text-center text-muted-foreground">
                Check your wallet for the signature request
              </p>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-3">
              <Button onClick={handleSign} className="w-full">
                Try Again
              </Button>
              <Button 
                variant="outline" 
                onClick={() => onOpenChange(false)} 
                className="w-full"
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
