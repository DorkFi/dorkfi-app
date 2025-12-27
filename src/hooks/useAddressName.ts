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
 * Hook to resolve an address name using the Envoi API
 * @param address - The wallet address to resolve
 * @returns The resolved name or null if not found/loading
 */
export const useAddressName = (address: string | undefined | null) => {
  const [name, setName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!address) {
      setName(null);
      setIsLoading(false);
      return;
    }

    const fetchName = async () => {
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
        
        // Find the first result with type "addr" that has a name
        // Prefer metadata.display, fallback to name
        const addrResult = data.results?.find(
          (result) => result.type === "addr"
        );
        
        if (addrResult) {
          // Use name directly, or lowercase if name exists
          const nameValue = addrResult.name;
          
          if (nameValue) {
            setName(nameValue.toLowerCase());
          } else {
            setName(null);
          }
        } else {
          setName(null);
        }
      } catch (err) {
        console.error("Error fetching address name:", err);
        setError(err instanceof Error ? err : new Error("Unknown error"));
        setName(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchName();
  }, [address]);

  return { name, isLoading, error };
};

