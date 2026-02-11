import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import { getVoterMultiplier } from "@/services/governanceService";
import { toast } from "sonner";

export const VoterMultiplierLookup = () => {
  const [voterAddress, setVoterAddress] = useState("");
  const [multiplier, setMultiplier] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLookup = async () => {
    if (!voterAddress.trim()) {
      toast.error("Please enter a voter address");
      return;
    }

    setLoading(true);
    setError(null);
    setMultiplier(null);

    try {
      const multiplierValue = await getVoterMultiplier(voterAddress.trim());
      setMultiplier(multiplierValue);
      toast.success("Voter multiplier retrieved successfully");
    } catch (err: any) {
      const errorMsg = err?.message || "Failed to retrieve voter multiplier";
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setVoterAddress("");
    setMultiplier(null);
    setError(null);
  };

  const formatMultiplier = (multiplier: string) => {
    const num = Number(multiplier);
    if (isNaN(num)) return "0";
    // Format as multiplier (e.g., 1.5x, 2.0x)
    return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 3 });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Voter Multiplier Lookup
        </CardTitle>
        <CardDescription>
          Look up the voting power multiplier for a voter address
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Input Section */}
        <div className="space-y-2">
          <Label htmlFor="voter-multiplier-address">Voter Address</Label>
          <div className="flex gap-2">
            <Input
              id="voter-multiplier-address"
              placeholder="Enter voter address (e.g., ABC123...)"
              value={voterAddress}
              onChange={(e) => setVoterAddress(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loading) {
                  handleLookup();
                }
              }}
              disabled={loading}
              className="font-mono text-sm"
            />
            <Button
              onClick={handleLookup}
              disabled={loading || !voterAddress.trim()}
              variant="default"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Looking up...
                </>
              ) : (
                <>
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Lookup
                </>
              )}
            </Button>
            {multiplier && (
              <Button
                onClick={handleClear}
                disabled={loading}
                variant="outline"
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-red-800 dark:text-red-200">
                  Error
                </p>
                <p className="text-red-700 dark:text-red-300">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Multiplier Display */}
        {multiplier && (
          <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              <h3 className="font-semibold text-lg">Voter Multiplier</h3>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">
                  Voter Address
                </Label>
                <p className="text-sm font-mono mt-1 break-all">
                  {voterAddress}
                </p>
              </div>

              <div>
                <Label className="text-sm font-medium text-muted-foreground">
                  Multiplier
                </Label>
                <p className="text-2xl font-bold mt-1 text-primary">
                  {formatMultiplier(multiplier)}×
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
