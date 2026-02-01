import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, UserCheck, AlertTriangle, CheckCircle2 } from "lucide-react";
import { getVoter, Voter } from "@/services/governanceService";
import { toast } from "sonner";

export const VoterInfoLookup = () => {
  const [voterAddress, setVoterAddress] = useState("");
  const [voterData, setVoterData] = useState<Voter | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLookup = async () => {
    if (!voterAddress.trim()) {
      toast.error("Please enter a voter address");
      return;
    }

    setLoading(true);
    setError(null);
    setVoterData(null);

    try {
      const voter = await getVoter(voterAddress.trim());
      setVoterData(voter);
      toast.success("Voter information retrieved successfully");
    } catch (err: any) {
      const errorMsg = err?.message || "Failed to retrieve voter information";
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setVoterAddress("");
    setVoterData(null);
    setError(null);
  };

  const formatTimestamp = (timestamp: string) => {
    const ts = Number(timestamp);
    if (isNaN(ts) || ts === 0) return "Never";
    return new Date(ts * 1000).toLocaleString();
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
          <UserCheck className="h-5 w-5" />
          Voter Information Lookup
        </CardTitle>
        <CardDescription>
          Look up voter information by address
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Input Section */}
        <div className="space-y-2">
          <Label htmlFor="voter-address">Voter Address</Label>
          <div className="flex gap-2">
            <Input
              id="voter-address"
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
                "Lookup"
              )}
            </Button>
            {voterData && (
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

        {/* Voter Data Display */}
        {voterData && (
          <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              <h3 className="font-semibold text-lg">Voter Information</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">
                  Voter Address
                </Label>
                <p className="text-sm font-mono mt-1 break-all">
                  {voterData.voterAddress}
                </p>
              </div>

              <div>
                <Label className="text-sm font-medium text-muted-foreground">
                  Vote Base Power
                </Label>
                <p className="text-sm font-semibold mt-1">
                  {formatVotePower(voterData.voteBasePower)} UNIT
                </p>
              </div>

              <div>
                <Label className="text-sm font-medium text-muted-foreground">
                  Vote Multiplier
                </Label>
                <p className="text-sm font-semibold mt-1">
                  {formatVotePower(voterData.voteMultiplier)}×
                </p>
              </div>

              <div>
                <Label className="text-sm font-medium text-muted-foreground">
                  Vote Total Power
                </Label>
                <p className="text-sm font-semibold mt-1 text-primary">
                  {formatVotePower(voterData.voteTotalPower)} UNIT
                </p>
              </div>

              <div>
                <Label className="text-sm font-medium text-muted-foreground">
                  Vote Timestamp
                </Label>
                <p className="text-sm mt-1">
                  {formatTimestamp(voterData.voteTimestamp)}
                </p>
              </div>

              <div>
                <Label className="text-sm font-medium text-muted-foreground">
                  Proposals Participated
                </Label>
                <p className="text-sm font-semibold mt-1">
                  {voterData.proposalsParticipated}
                </p>
              </div>

              <div>
                <Label className="text-sm font-medium text-muted-foreground">
                  Last Participation Timestamp
                </Label>
                <p className="text-sm mt-1">
                  {formatTimestamp(voterData.lastParticipationTimestamp)}
                </p>
              </div>

              <div>
                <Label className="text-sm font-medium text-muted-foreground">
                  Last Snapshot Timestamp
                </Label>
                <p className="text-sm mt-1">
                  {formatTimestamp(voterData.lastSnapshotTimestamp)}
                </p>
              </div>

              <div>
                <Label className="text-sm font-medium text-muted-foreground">
                  Last Proposal Node
                </Label>
                <p className="text-sm font-mono mt-1 break-all">
                  {voterData.lastProposalNode || "None"}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
