import {
  fetchXoPairQuote,
  fetchXoPairRates,
  type XoRequest,
} from "@/lib/easyStart/xoSwap/api";
import { formatXoSwapMinUsd } from "@/lib/easyStart/xoSwap/constants";
import {
  isXoAbortError,
  isXoGeoRestricted,
  XO_GEO_RESTRICTED_MESSAGE,
} from "@/lib/easyStart/xoSwap/errors";
import { selectBestXoRate, xoRateBounds } from "@/lib/easyStart/xoSwap/selectRate";

export type XoPairQuotePreview = {
  fromAmount: number;
  toAmount: number | null;
  minerFee: number;
  min: number | null;
  max: number | null;
  expiry: number | null;
  useFloating: boolean;
  inRange: boolean;
};

function geoError(): Error {
  return new Error(XO_GEO_RESTRICTED_MESSAGE);
}

function previewFromFixed(args: {
  fromAmount: number;
  toAmount: number;
  minerFee: number;
  min: number | null;
  max: number | null;
  expiry: number | null;
}): XoPairQuotePreview {
  return {
    ...args,
    useFloating: false,
    inRange: true,
  };
}

/**
 * Rates first, then a floating quote if no live fixed rate covers `fromAmount`.
 * Out of range stays `inRange: false` so confirm can disable instead of floating.
 */
export async function quoteXoPair(
  pairId: string,
  fromAmount: number,
  req?: XoRequest
): Promise<XoPairQuotePreview> {
  if (!Number.isFinite(fromAmount) || fromAmount <= 0) {
    return {
      fromAmount,
      toAmount: null,
      minerFee: 0,
      min: null,
      max: null,
      expiry: null,
      useFloating: false,
      inRange: false,
    };
  }

  let bounds: { min: number; max: number } | null = null;

  try {
    const rates = await fetchXoPairRates(pairId, req);
    bounds = xoRateBounds(rates);
    const best = selectBestXoRate(rates, fromAmount);
    if (best) {
      return previewFromFixed({
        fromAmount,
        toAmount: best.toAmount,
        minerFee: best.rate.minerFee?.value ?? 0,
        min: bounds?.min ?? best.rate.min?.value ?? null,
        max: bounds?.max ?? best.rate.max?.value ?? null,
        expiry:
          typeof best.rate.expiry === "number" ? best.rate.expiry : null,
      });
    }
    if (
      bounds &&
      (fromAmount < bounds.min || fromAmount > bounds.max)
    ) {
      return {
        fromAmount,
        toAmount: null,
        minerFee: 0,
        min: bounds.min,
        max: bounds.max,
        expiry: null,
        useFloating: false,
        inRange: false,
      };
    }
    throw new Error("No fixed rate for this amount");
  } catch (err) {
    if (isXoGeoRestricted(err)) throw geoError();
    if (isXoAbortError(err)) throw err;
  }

  const quote = await fetchXoPairQuote(pairId, fromAmount, req).catch((err) => {
    if (isXoGeoRestricted(err)) throw geoError();
    throw err;
  });
  const quoted = quote.toAmount?.value;
  if (typeof quoted !== "number" || quoted <= 0) {
    throw new Error("Could not get an XO Swap rate for this pair");
  }
  return {
    fromAmount,
    toAmount: quoted,
    minerFee: quote.minerFee?.value ?? 0,
    min: bounds?.min ?? null,
    max: bounds?.max ?? null,
    expiry: typeof quote.expiry === "number" ? quote.expiry : null,
    useFloating: true,
    inRange: true,
  };
}

export function xoPairQuoteExpired(
  preview: XoPairQuotePreview | null | undefined,
  nowMs = Date.now()
): boolean {
  if (!preview || preview.expiry == null) return false;
  return preview.expiry <= nowMs;
}

export function xoPairQuoteOutOfRangeMessage(
  preview: XoPairQuotePreview
): string | null {
  if (preview.inRange) return null;
  if (preview.min != null && preview.fromAmount < preview.min) {
    return `XO Swap minimum is ${formatXoSwapMinUsd(preview.min)}`;
  }
  if (preview.max != null && preview.fromAmount > preview.max) {
    return `Maximum is ${preview.max} USDC`;
  }
  return "This amount is outside the USDC move range";
}
