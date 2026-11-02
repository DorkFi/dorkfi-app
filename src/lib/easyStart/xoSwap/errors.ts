export const XO_GEO_RESTRICTED_MESSAGE =
  "USDC moves aren’t available in your region yet.";

export function isXoGeoRestricted(error: unknown): boolean {
  if (!error) return false;
  if (typeof error === "object") {
    const rec = error as { code?: unknown; details?: unknown; error?: unknown };
    const code = typeof rec.code === "string" ? rec.code : "";
    if (code.toUpperCase() === "RESTRICTED_GEOLOCATION") return true;
    if (isXoGeoRestricted(rec.details) || isXoGeoRestricted(rec.error)) {
      return true;
    }
  }
  const text = error instanceof Error ? error.message : String(error);
  const lower = text.toLowerCase();
  return (
    lower.includes("restricted_geolocation") ||
    (lower.includes("restricted") && lower.includes("location")) ||
    lower.includes("aren’t available in your region") ||
    lower.includes("aren't available in your region") ||
    lower.includes("isn’t available in your region") ||
    lower.includes("isn't available in your region")
  );
}

export function formatXoSwapError(error: unknown, fallback: string): string {
  if (isXoGeoRestricted(error)) return XO_GEO_RESTRICTED_MESSAGE;
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  if (error && typeof error === "object") {
    const rec = error as { details?: unknown; error?: unknown; code?: unknown };
    if (typeof rec.details === "string" && rec.details.trim()) return rec.details;
    if (typeof rec.error === "string" && rec.error.trim()) return rec.error;
    if (typeof rec.code === "string" && rec.code.trim()) return rec.code;
  }
  return fallback;
}
