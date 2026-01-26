import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, CheckCircle2, Loader2, Zap, RefreshCw } from "lucide-react";
import { getPowerMultiplier } from "@/services/governanceService";
import { useNetwork } from "@/contexts/NetworkContext";
import { isCurrentNetworkAVM, getContractAddress, GovernanceConfig, PowerMultiplier as ConfigPowerMultiplier } from "@/config";
import DorkFiButton from "@/components/ui/DorkFiButton";

interface PowerMultiplierData {
  collection: string;
  contractId: number;
  bonus: number;
  powerMultiplierId: string;
  powerMultiplierValue: string;
  powerMultiplierSupportedModes: string;
  error?: string;
}

export const PowerMultiplierLookup = () => {
  const { currentNetwork } = useNetwork();
  const [address, setAddress] = useState("");
  const [selectedPowerMultiplier, setSelectedPowerMultiplier] = useState<string>("all");
  const [powerMultiplierId, setPowerMultiplierId] = useState("");
  const [results, setResults] = useState<PowerMultiplierData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get power multipliers from config
  const powerMultipliers = useMemo(() => {
    const governanceConfig = getContractAddress(
      currentNetwork,
      "governance"
    ) as GovernanceConfig | string | undefined;

    if (!governanceConfig || typeof governanceConfig === "string") {
      return [];
    }

    return governanceConfig.powerMultipliers || [];
  }, [currentNetwork]);

  const handleLookupByCollection = async () => {
    if (!isCurrentNetworkAVM()) {
      setError("Power multipliers are only available on AVM networks");
      return;
    }

    if (powerMultipliers.length === 0) {
      setError("No power multipliers configured for this network");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults([]);

    try {
      const collectionsToLookup = selectedPowerMultiplier && selectedPowerMultiplier !== "all"
        ? powerMultipliers.filter((pm) => pm.id === selectedPowerMultiplier)
        : powerMultipliers;

      const lookupPromises = collectionsToLookup.map(async (collection) => {
        try {
          // Try using contract ID as power multiplier ID
          const powerMultiplier = await getPowerMultiplier(collection.contractId);
          
          return {
            collection: collection.label,
            contractId: collection.contractId,
            bonus: collection.bonus,
            powerMultiplierId: powerMultiplier.powerMultiplierId,
            powerMultiplierValue: powerMultiplier.powerMultiplierValue,
            powerMultiplierSupportedModes: powerMultiplier.powerMultiplierSupportedModes,
          } as PowerMultiplierData;
        } catch (err: any) {
          return {
            collection: collection.label,
            contractId: collection.contractId,
            bonus: collection.bonus,
            powerMultiplierId: "",
            powerMultiplierValue: "",
            powerMultiplierSupportedModes: "",
            error: err?.message || "Failed to fetch power multiplier",
          } as PowerMultiplierData;
        }
      });

      const results = await Promise.all(lookupPromises);
      setResults(results);
    } catch (err: any) {
      setError(err?.message || "Failed to lookup power multipliers");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLookupById = async () => {
    if (!powerMultiplierId.trim()) {
      setError("Please enter a power multiplier ID");
      return;
    }

    if (!isCurrentNetworkAVM()) {
      setError("Power multipliers are only available on AVM networks");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults([]);

    try {
      const id = parseInt(powerMultiplierId, 10);
      if (isNaN(id)) {
        setError("Power multiplier ID must be a number");
        setIsLoading(false);
        return;
      }

      const powerMultiplier = await getPowerMultiplier(id);
      
      // Find matching collection if any
      const collectionEntry = powerMultipliers.find(
        (pm) => pm.contractId === id
      );

      const result: PowerMultiplierData = {
        collection: collectionEntry ? collectionEntry.label : "Unknown Collection",
        contractId: collectionEntry ? collectionEntry.contractId : id,
        bonus: collectionEntry ? collectionEntry.bonus : 0,
        powerMultiplierId: powerMultiplier.powerMultiplierId,
        powerMultiplierValue: powerMultiplier.powerMultiplierValue,
        powerMultiplierSupportedModes: powerMultiplier.powerMultiplierSupportedModes,
      };

      setResults([result]);
    } catch (err: any) {
      setError(err?.message || "Failed to lookup power multiplier");
    } finally {
      setIsLoading(false);
    }
  };

  const formatSupportedModes = (modes: string) => {
    if (!modes || modes === "0") return "N/A";
    // Display the supported modes value
    return modes;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Power Multiplier Lookup
        </CardTitle>
        <CardDescription>
          Look up power multipliers for NFT collections or by power multiplier ID
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Input Section */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="power-multiplier-collection">Power Multiplier Collection</Label>
            <Select
              value={selectedPowerMultiplier || "all"}
              onValueChange={(value) => {
                setSelectedPowerMultiplier(value);
                setPowerMultiplierId(""); // Clear manual ID when selecting collection
              }}
            >
              <SelectTrigger id="power-multiplier-collection">
                <SelectValue placeholder={powerMultipliers.length === 0 ? "No power multipliers configured" : "Select a collection"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Collections</SelectItem>
                {powerMultipliers.map((pm) => (
                  <SelectItem key={pm.id} value={pm.id}>
                    {pm.label} (Contract ID: {pm.contractId}, {(pm.bonus * 100).toFixed(1)}% bonus)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Select a specific collection to lookup, or leave as "All Collections" to lookup all configured power multipliers.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="power-multiplier-address">Address (Optional)</Label>
            <Input
              id="power-multiplier-address"
              placeholder="Enter address to filter by owner"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Address is currently used for reference. Power multipliers are looked up by collection contract ID.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="power-multiplier-id">Power Multiplier ID (Optional - Alternative to Collection)</Label>
            <Input
              id="power-multiplier-id"
              placeholder="Enter specific power multiplier ID"
              value={powerMultiplierId}
              onChange={(e) => {
                setPowerMultiplierId(e.target.value);
                setSelectedPowerMultiplier("all"); // Reset to "all" when entering manual ID
              }}
              type="number"
            />
            <p className="text-xs text-muted-foreground">
              Enter a specific power multiplier ID to lookup directly (this will override collection selection).
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <DorkFiButton
            variant="primary"
            onClick={powerMultiplierId ? handleLookupById : handleLookupByCollection}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                {powerMultiplierId
                  ? "Lookup by ID"
                  : selectedPowerMultiplier === "all"
                  ? "Lookup All Collections"
                  : "Lookup Selected Collection"}
              </>
            )}
          </DorkFiButton>
          <DorkFiButton
            variant="secondary"
            onClick={() => {
              setResults([]);
              setError(null);
              setAddress("");
              setPowerMultiplierId("");
              setSelectedPowerMultiplier("all");
            }}
            disabled={isLoading}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Clear
          </DorkFiButton>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-red-800 dark:text-red-200">Error</p>
                <p className="text-red-700 dark:text-red-300">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Results</h3>
            <div className="space-y-4">
              {results.map((result, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border ${
                    result.error
                      ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
                      : "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-sm">{result.collection}</h4>
                      <p className="text-xs text-muted-foreground">
                        Contract ID: {result.contractId} | Bonus: {(result.bonus * 100).toFixed(1)}%
                      </p>
                    </div>
                    {result.error ? (
                      <Badge variant="destructive">Error</Badge>
                    ) : (
                      <Badge variant="default" className="bg-green-600">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Found
                      </Badge>
                    )}
                  </div>

                  {result.error ? (
                    <p className="text-sm text-red-700 dark:text-red-300">{result.error}</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-muted-foreground">Power Multiplier ID:</span>
                        <p className="font-mono font-semibold">{result.powerMultiplierId}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Value:</span>
                        <p className="font-mono font-semibold">{result.powerMultiplierValue}</p>
                      </div>
                      <div className="md:col-span-2">
                        <span className="text-muted-foreground">Supported Modes:</span>
                        <p className="font-mono font-semibold">{formatSupportedModes(result.powerMultiplierSupportedModes)}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info about NFT Collections */}
        {powerMultipliers.length > 0 && (
          <div className="p-3 bg-muted/30 border border-border rounded-lg">
            <p className="text-xs text-muted-foreground mb-2 font-semibold">Configured Power Multipliers:</p>
            <div className="space-y-1">
              {powerMultipliers.map((pm) => (
                <div key={pm.id} className="text-xs text-muted-foreground flex justify-between">
                  <span>{pm.label}:</span>
                  <span className="font-mono">Contract ID {pm.contractId} ({(pm.bonus * 100).toFixed(1)}% bonus)</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
