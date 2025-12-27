import { useState, useEffect } from "react";

interface EnvoiNameResponse {
  results: Array<{
    address: string;
    type: string;
    name: string | null;
    metadata: {
      display?: string;
      bio?: string;
      avatar?: string;
      [key: string]: unknown;
    };
    cached: boolean;
  }>;
}

/**
 * Hook to check if a user owns a name (their address is associated with a name)
 * @param address - The wallet address to check
 * @returns Object with ownsName boolean, isLoading, and error
 */
export const useNameOwnership = (address: string | undefined | null) => {
  const [ownsName, setOwnsName] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const checkOwnership = async () => {
    if (!address) {
      setOwnsName(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `https://api.envoi.sh/api/name/${address}`
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch name: ${response.statusText}`);
      }
      
      const data: EnvoiNameResponse = await response.json();
      
      // Check if there's a result with type "addr" that has a name
      // and the address matches (user owns the name)
      const addrResult = data.results?.find(
        (result) => 
          result.type === "addr" && 
          result.name !== null && 
          result.name !== undefined &&
          result.address.toUpperCase() === address.toUpperCase()
      );
      
      setOwnsName(!!addrResult);
    } catch (err) {
      console.error("Error checking name ownership:", err);
      setError(err instanceof Error ? err : new Error("Unknown error"));
      setOwnsName(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkOwnership();
  }, [address, refreshKey]);

  const refetch = () => {
    setRefreshKey(prev => prev + 1);
  };

  return { ownsName, isLoading, error, refetch };
};

