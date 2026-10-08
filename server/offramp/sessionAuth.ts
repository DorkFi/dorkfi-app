import type { IncomingMessage } from "node:http";
import { isDynamicIssuer, requireDynamicAuth } from "./dynamicAuth.ts";
import { AuthError, bearerToken, requirePrivyAuth } from "./privyAuth.ts";

export type EasyStartSession = {
  userId: string;
  provider: "privy" | "dynamic";
  /** Present for Dynamic sessions when the access token lists wallets. */
  walletAddresses: string[];
};

function issuerOf(token: string): string {
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[1]) return "";
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8")
    ) as { iss?: unknown };
    return typeof payload.iss === "string" ? payload.iss : "";
  } catch {
    return "";
  }
}

export async function requireEasyStartAuth(
  req: IncomingMessage,
  opts: { privyAppId?: string; dynamicEnvironmentId?: string }
): Promise<EasyStartSession> {
  const token = bearerToken(req);
  if (!token) {
    throw new AuthError(401, "Authentication required");
  }
  if (isDynamicIssuer(issuerOf(token))) {
    const session = await requireDynamicAuth(token, opts.dynamicEnvironmentId);
    return {
      userId: session.userId,
      provider: "dynamic",
      walletAddresses: session.walletAddresses,
    };
  }
  const privy = await requirePrivyAuth(req, opts.privyAppId);
  return { userId: privy.userId, provider: "privy", walletAddresses: [] };
}
