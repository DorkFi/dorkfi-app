/** Image bytes. Multipart framing may add a little on top of this. */
export const SHARE_MAX_IMAGE_BYTES = 1024 * 1024;

/** Whole request body. A bit above the image cap so a 1 MB PNG still fits. */
export const SHARE_MAX_BODY_BYTES = SHARE_MAX_IMAGE_BYTES + 16 * 1024;

/** A few dozen characters: symbols, amounts, network names, NFT titles. */
export const SHARE_MAX_FIELD_CHARS = 48;

export const SHARE_CREATE_RATE_MAX = 10;
export const SHARE_CREATE_RATE_WINDOW_MS = 10 * 60 * 1000;

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

export function isPngBuffer(buffer: Buffer): boolean {
  return (
    buffer.length >= PNG_SIGNATURE.length &&
    buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)
  );
}

export type ShareFieldResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

export function readShareField(
  value: unknown,
  name: string,
  opts?: { required?: boolean }
): ShareFieldResult {
  if (value == null) {
    if (opts?.required) return { ok: false, error: `Missing ${name}` };
    return { ok: true, value: "" };
  }
  if (typeof value !== "string") {
    return { ok: false, error: `Invalid ${name}` };
  }
  const trimmed = value.trim();
  if (trimmed.length > SHARE_MAX_FIELD_CHARS) {
    return { ok: false, error: `${name} is too long` };
  }
  if (opts?.required && trimmed.length === 0) {
    return { ok: false, error: `Missing ${name}` };
  }
  return { ok: true, value: trimmed };
}

export type ShareImageResult =
  | { ok: true; buffer: Buffer }
  | { ok: false; status: 400 | 413; error: string };

export async function readShareImage(file: unknown): Promise<ShareImageResult> {
  if (!(file instanceof File)) {
    return { ok: false, status: 400, error: "Missing image file" };
  }
  if (file.size > SHARE_MAX_IMAGE_BYTES) {
    return { ok: false, status: 413, error: "Payload too large" };
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length > SHARE_MAX_IMAGE_BYTES) {
    return { ok: false, status: 413, error: "Payload too large" };
  }
  if (!isPngBuffer(buffer)) {
    return { ok: false, status: 400, error: "Image must be a PNG" };
  }
  return { ok: true, buffer };
}

export type ShareClientHeaders = {
  "cf-connecting-ip"?: string;
  "true-client-ip"?: string;
  "x-real-ip"?: string;
  "x-forwarded-for"?: string;
};

/**
 * Client address for the share-create rate limit.
 * Railway overwrites X-Real-IP and forwards CF-Connecting-IP, True-Client-IP,
 * and X-Forwarded-For unchanged, so only X-Real-IP is safe to key on.
 * Missing header shares one bucket instead of trusting a client-supplied address.
 */
export function shareClientIpFromHeaders(headers: ShareClientHeaders): string {
  const realIp = headers["x-real-ip"]?.split(",")[0]?.trim();
  if (realIp) return realIp;
  return "127.0.0.1";
}
