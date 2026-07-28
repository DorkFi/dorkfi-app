/** Deploy `server/` to Railway and set VITE_X_SHARE_API_BASE to this origin in production builds. */
export const X_SHARE_API_DEFAULT_ORIGIN =
  "https://dorkfi-app-repay-share-production.up.railway.app";

export type XShareHealth = {
  ok: boolean;
  linkShareEnabled: boolean;
  sharePublicBase?: string;
};

export type RepayShareLinkInput = {
  amount: string;
  assetSymbol: string;
  paidWithSymbol?: string;
  network?: string;
  image: Blob;
};

export type RepayShareLinkResult = {
  shareId: string;
  shareUrl: string;
  imageUrl: string;
};

export class XShareApiError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "XShareApiError";
    this.status = status;
  }
}

export class XShareLinkUnavailableError extends Error {
  constructor(message = "Repay share links are unavailable right now") {
    super(message);
    this.name = "XShareLinkUnavailableError";
  }
}

export function xShareApiBase(): string {
  const raw = import.meta.env.VITE_X_SHARE_API_BASE?.trim();
  const trimmed = raw?.replace(/\/+$/, "") ?? "";
  if (trimmed) return trimmed;

  // Static hosting cannot serve /api/x-share — use the Railway share server in prod.
  if (import.meta.env.PROD) {
    return X_SHARE_API_DEFAULT_ORIGIN;
  }

  return "/api/x-share";
}

export function isXShareApiConfigured(): boolean {
  return Boolean(xShareApiBase());
}

function buildUrl(path: string): string {
  const base = xShareApiBase().replace(/\/+$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new XShareApiError(
      "Share server returned an invalid response",
      response.status
    );
  }

  if (!response.ok) {
    const message =
      typeof json === "object" &&
      json !== null &&
      "error" in json &&
      typeof (json as { error: unknown }).error === "string"
        ? (json as { error: string }).error
        : `Share server error (${response.status})`;
    throw new XShareApiError(message, response.status);
  }

  return json as T;
}

export async function getShareServerHealth(): Promise<XShareHealth> {
  try {
    // No credentials — this is a public health check; credentialed
    // cross-origin fetches are stricter and can fail unnecessarily.
    const response = await fetch(buildUrl("/health"), {
      method: "GET",
    });
    if (!response.ok) {
      return { ok: false, linkShareEnabled: false };
    }
    const json = (await response.json()) as Partial<XShareHealth>;
    return {
      ok: Boolean(json.ok),
      linkShareEnabled: json.linkShareEnabled !== false,
      sharePublicBase: json.sharePublicBase,
    };
  } catch {
    return { ok: false, linkShareEnabled: false };
  }
}

export async function createRepayShareLink(
  input: RepayShareLinkInput
): Promise<RepayShareLinkResult> {
  const form = new FormData();
  form.append(
    "image",
    new File([input.image], "dorkfi-repay-confirmation.png", {
      type: "image/png",
    })
  );
  form.append("amount", input.amount);
  form.append("assetSymbol", input.assetSymbol);
  if (input.paidWithSymbol) {
    form.append("paidWithSymbol", input.paidWithSymbol);
  }
  if (input.network) {
    form.append("network", input.network);
  }

  const response = await fetch(buildUrl("/share/repay-confirmation/link"), {
    method: "POST",
    body: form,
  });

  const json = await parseJson<{
    ok: boolean;
    shareId: string;
    shareUrl: string;
    imageUrl: string;
  }>(response);

  return {
    shareId: json.shareId,
    shareUrl: json.shareUrl,
    imageUrl: json.imageUrl,
  };
}
