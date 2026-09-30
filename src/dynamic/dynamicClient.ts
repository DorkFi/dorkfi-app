import { createDynamicClient } from "@dynamic-labs-sdk/client";
import { addEvmExtension } from "@dynamic-labs-sdk/evm";

const environmentId = (import.meta.env.VITE_DYNAMIC_ENVIRONMENT_ID ?? "").trim();

function appOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "http://localhost:8080";
}

/** Public Dynamic environment id. Empty when Easy Start should stay off. */
export const dynamicEnvironmentId = environmentId;

/**
 * Module singleton. Importing this file registers the EVM extension before
 * any Dynamic hook runs.
 */
export const dynamicClient = environmentId
  ? createDynamicClient({
      environmentId,
      metadata: {
        name: "DorkFi",
        universalLink: appOrigin(),
      },
    })
  : null;

if (dynamicClient) {
  addEvmExtension();
}
