import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Zap, AlertTriangle, CheckCircle2 } from "lucide-react";
import { getVoterBasePower } from "@/services/governanceService";
import { toast } from "sonner";

export const VoterBasePowerLookup = () => {
  const [voterAddress, setVoterAddress] = useState("");
  const [basePower, setBasePower] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLookup = async () => {
    if (!voterAddress.trim()) {
      toast.error("Please enter a voter address");
      return;
    }

    setLoading(true);
    setError(null);
    setBasePower(null);

    try {
      const power = await getVoterBasePower(voterAddress.trim());
      setBasePower(power);
      toast.success("Voter base power retrieved successfully");
    } catch (err: any) {
      const errorMsg = err?.message || "Failed to retrieve voter base power";
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setVoterAddress("");
    setBasePower(null);
    setError(null);
  };

  const formatVotePower = (power: string) => {
    const num = Number(power);
    if (isNaN(num)) return "0";
    return num.toLocaleString();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Voter Base Power Lookup
        </CardTitle>
        <CardDescription>
          Look up the base voting power for a voter address
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Input Section */}
        <div className="space-y-2">
          <Label htmlFor="voter-base-power-address">Voter Address</Label>
          <div className="flex gap-2">
            <Input
              id="voter-base-power-address"
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
                  <Zap className="h-4 w-4 mr-2" />
                  Lookup
                </>
              )}
            </Button>
            {basePower && (
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

        {/* Base Power Display */}
        {basePower && (
          <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              <h3 className="font-semibold text-lg">Voter Base Power</h3>
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
                  Base Power
                </Label>
                <p className="text-2xl font-bold mt-1 text-primary">
                  {formatVotePower(basePower)} UNIT
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
