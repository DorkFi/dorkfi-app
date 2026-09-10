import { useState } from "react";

/** Optional helper if a thin app wants tab state without re-implementing it. */
export function useSimplFiTabState(initial = "savings") {
  return useState(initial);
}
