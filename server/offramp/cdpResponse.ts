/**
 * Coinbase sometimes returns plain text ("Unauthorized ") instead of JSON.
 * Never call Response.json() on those bodies.
 */

export function parseCdpBody(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return { message: trimmed };
  } catch {
    return { message: trimmed };
  }
}

export function cdpFailureMessage(
  status: number,
  body: Record<string, unknown>,
  fallback: string
): string {
  const fromJson =
    (typeof body.error === "string" && body.error) ||
    (typeof body.message === "string" && body.message) ||
    "";
  const text = fromJson.trim();
  if (status === 401 || /^unauthorized$/i.test(text)) {
    return "Coinbase CDP unauthorized (401). Use a Secret API key (CDP_API_KEY_ID / CDP_API_KEY_SECRET) with Onramp enabled, and keep PEM newlines intact.";
  }
  return text || `${fallback} (${status})`;
}
