import {
  resolveAnchoredTextTopY,
  REPAY_HEADLINE_PREFIX,
  REPAY_HEADLINE_ACTION,
  REPAY_HEADLINE_SUFFIX,
  shouldShowPaidWithRow,
  formatRepayWithLabel,
  formatRepayDebtLoanLabel,
} from "./format";
import {
  REPAY_SHARE_HEIGHT,
  REPAY_SHARE_WIDTH,
  resolveRepayShareTemplatePath,
  type RepayShareInput,
  type RepayShareResult,
} from "./types";

/** Overlay text color on light sky art. */
const TEXT_COLOR = "#0b2a4a";
const ACTION_COLOR = TEXT_COLOR;
const WITH_COLOR = TEXT_COLOR;
const TEXT_SHADOW = "rgba(255, 255, 255, 0.85)";

/** Left-aligned overlay; may extend over whales for cross-asset rows. */
const TEXT_LEFT_X = 48;
const SAFE_TEXT_RIGHT = 1140;
const TITLE_MAX_WIDTH = SAFE_TEXT_RIGHT - TEXT_LEFT_X;
const TEXT_TOP_Y = 110;
/** Allow overlay into the illustration (cross-asset rows may overlap whales). */
const LOGO_ZONE_TOP = 640;

const TITLE_FONT_MAX = 84;
const TITLE_FONT_MIN = 32;

const GAP_BETWEEN_ROWS = 28;
const GAP_AFTER_HEADLINE = 14;
const GAP_AFTER_WITH = 14;
const ICON_GAP = 12;
/** Icon diameter as a fraction of measured label glyph height. */
const ICON_TO_GLYPH_RATIO = 1.15;
/** Slight upward nudge so round icons optically match capital letters. */
const ICON_OPTICAL_NUDGE_Y = -2;

const HEADLINE_LETTER_SPACING = "2px";

function titleFont(size: number): string {
  return `800 ${size}px Poppins, sans-serif`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (typeof img.decode === "function") {
        img.decode().then(() => resolve(img)).catch(() => resolve(img));
      } else {
        resolve(img);
      }
    };
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

async function tryLoadImage(src: string): Promise<HTMLImageElement | null> {
  try {
    return await loadImage(src);
  } catch {
    return null;
  }
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  width: number,
  height: number
): void {
  const sourceAspect = img.width / img.height;
  const destAspect = width / height;

  let sx = 0;
  let sy = 0;
  let sw = img.width;
  let sh = img.height;

  if (sourceAspect > destAspect) {
    sw = img.height * destAspect;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / destAspect;
    sy = (img.height - sh) / 2;
  }

  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);
}

/** Circular token icon, cover-fitted into a clip circle. */
function drawCircularIcon(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  size: number
): void {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const r = size / 2;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  const sourceAspect = img.width / Math.max(img.height, 1);
  let dw = size;
  let dh = size;
  let dx = x;
  let dy = y;
  if (sourceAspect > 1) {
    dw = size * sourceAspect;
    dx = x - (dw - size) / 2;
  } else {
    dh = size / sourceAspect;
    dy = y - (dh - size) / 2;
  }
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r - 0.5, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(11, 42, 74, 0.25)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function measureLabelGlyph(
  ctx: CanvasRenderingContext2D,
  label: string,
  fontSize: number
): { ascent: number; descent: number; height: number; iconSize: number } {
  ctx.font = titleFont(fontSize);
  ctx.textBaseline = "alphabetic";
  const metrics = ctx.measureText(label);
  const ascent = metrics.actualBoundingBoxAscent || fontSize * 0.72;
  const descent = metrics.actualBoundingBoxDescent || 0;
  const height = Math.max(1, ascent + descent);
  const iconSize = Math.max(16, Math.round(height * ICON_TO_GLYPH_RATIO));
  return { ascent, descent, height, iconSize };
}

function estimateIconSize(fontSize: number): number {
  return Math.max(16, Math.round(fontSize * 0.72 * ICON_TO_GLYPH_RATIO));
}

function measurePrimaryLineWidth(
  ctx: CanvasRenderingContext2D,
  debtLoanLabel: string,
  fontSize: number,
  hasIcon: boolean
): number {
  ctx.font = titleFont(fontSize);
  ctx.letterSpacing = HEADLINE_LETTER_SPACING;
  const headlineWidth = ctx.measureText(
    `${REPAY_HEADLINE_PREFIX}${REPAY_HEADLINE_ACTION}${REPAY_HEADLINE_SUFFIX}`
  ).width;
  ctx.letterSpacing = "0px";
  const loanWidth = ctx.measureText(debtLoanLabel).width;
  const iconWidth = hasIcon ? estimateIconSize(fontSize) + ICON_GAP : 0;
  return headlineWidth + GAP_AFTER_HEADLINE + iconWidth + loanWidth;
}

function measureWithLineWidth(
  ctx: CanvasRenderingContext2D,
  paidWithTicker: string,
  fontSize: number,
  hasIcon: boolean
): number {
  ctx.font = titleFont(fontSize);
  const withWidth = ctx.measureText(formatRepayWithLabel()).width;
  const tickerWidth = ctx.measureText(paidWithTicker).width;
  const iconWidth = hasIcon ? estimateIconSize(fontSize) + ICON_GAP : 0;
  return withWidth + GAP_AFTER_WITH + iconWidth + tickerWidth;
}

function resolveSharedFontSize(
  ctx: CanvasRenderingContext2D,
  debtLoanLabel: string,
  hasDebtIcon: boolean,
  paidWithTicker: string | null,
  hasPaidIcon: boolean
): number {
  for (let fontSize = TITLE_FONT_MAX; fontSize >= TITLE_FONT_MIN; fontSize -= 4) {
    const primaryOk =
      measurePrimaryLineWidth(ctx, debtLoanLabel, fontSize, hasDebtIcon) <=
      TITLE_MAX_WIDTH;
    const withOk =
      !paidWithTicker ||
      measureWithLineWidth(ctx, paidWithTicker, fontSize, hasPaidIcon) <=
        TITLE_MAX_WIDTH;
    if (primaryOk && withOk) return fontSize;
  }
  return TITLE_FONT_MIN;
}

function applyTextShadow(ctx: CanvasRenderingContext2D, color = TEXT_COLOR): void {
  ctx.fillStyle = color;
  ctx.shadowColor = TEXT_SHADOW;
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2;
}

function clearTextShadow(ctx: CanvasRenderingContext2D): void {
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

/**
 * Draws optional leading text, then [icon] LABEL on one row.
 * Returns Y just below the row.
 */
function drawInlineIconLabelRow(
  ctx: CanvasRenderingContext2D,
  opts: {
    y: number;
    leading?: {
      parts: Array<{ text: string; color: string; letterSpacing?: string }>;
      gapAfter: number;
    };
    label: string;
    fontSize: number;
    icon: HTMLImageElement | null;
  }
): number {
  const { y, leading, label, fontSize, icon } = opts;
  const { ascent, height, iconSize } = measureLabelGlyph(ctx, label, fontSize);
  const rowHeight = Math.max(height, icon ? iconSize : 0);
  const baselineY = y + ascent + (rowHeight - height) / 2;
  const glyphMidY = y + rowHeight / 2;

  let x = TEXT_LEFT_X;

  if (leading) {
    ctx.font = titleFont(fontSize);
    ctx.textBaseline = "alphabetic";
    for (const part of leading.parts) {
      ctx.letterSpacing = part.letterSpacing ?? "0px";
      applyTextShadow(ctx, part.color);
      ctx.fillText(part.text, x, baselineY);
      x += ctx.measureText(part.text).width;
      clearTextShadow(ctx);
    }
    ctx.letterSpacing = "0px";
    x += leading.gapAfter;
  }

  if (icon) {
    drawCircularIcon(
      ctx,
      icon,
      x,
      glyphMidY - iconSize / 2 + ICON_OPTICAL_NUDGE_Y,
      iconSize
    );
    x += iconSize + ICON_GAP;
  }

  ctx.font = titleFont(fontSize);
  ctx.textBaseline = "alphabetic";
  applyTextShadow(ctx);
  ctx.fillText(label, x, baselineY);
  clearTextShadow(ctx);
  ctx.textBaseline = "top";

  return y + rowHeight;
}

async function ensureFontsLoaded(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts?.load) return;

  const loads: Promise<FontFace[]>[] = [];
  for (let size = TITLE_FONT_MIN; size <= TITLE_FONT_MAX; size += 4) {
    loads.push(document.fonts.load(titleFont(size)));
  }
  await Promise.all(loads);
  await document.fonts.ready;
}

function resolvePaidWithTicker(
  debtSymbol: string,
  paidWithSymbol?: string
): string | null {
  if (!shouldShowPaidWithRow(debtSymbol, paidWithSymbol)) return null;
  return paidWithSymbol!.trim().toUpperCase();
}

export type GenerateRepayShareImageOptions = {
  templateSrc?: string;
};

export async function generateRepayShareImage(
  input: RepayShareInput,
  options: GenerateRepayShareImageOptions = {}
): Promise<RepayShareResult> {
  const templateSrc =
    options.templateSrc ?? resolveRepayShareTemplatePath();

  await ensureFontsLoaded();

  // Export at exactly REPAY_SHARE_WIDTH×REPAY_SHARE_HEIGHT: the share permalink
  // declares these values in og:image:width/height, and X drops the card image
  // when the real file disagrees. Scaling by devicePixelRatio also produced
  // fractional sizes (e.g. 2159×1214) on scaled Retina displays.
  const canvas = document.createElement("canvas");
  canvas.width = REPAY_SHARE_WIDTH;
  canvas.height = REPAY_SHARE_HEIGHT;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context is not available");
  }

  const ticker = (input.assetSymbol.trim() || "ASSET").toUpperCase();
  const debtLoanLabel = formatRepayDebtLoanLabel(ticker);
  const paidWithTicker = resolvePaidWithTicker(ticker, input.paidWithSymbol);

  const [background, tokenIcon, paidWithIcon] = await Promise.all([
    loadImage(templateSrc),
    input.assetIconSrc?.trim()
      ? tryLoadImage(input.assetIconSrc.trim())
      : Promise.resolve(null),
    paidWithTicker && input.paidWithIconSrc?.trim()
      ? tryLoadImage(input.paidWithIconSrc.trim())
      : Promise.resolve(null),
  ]);
  drawCover(ctx, background, REPAY_SHARE_WIDTH, REPAY_SHARE_HEIGHT);

  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  const sharedFontSize = resolveSharedFontSize(
    ctx,
    debtLoanLabel,
    Boolean(tokenIcon),
    paidWithTicker,
    Boolean(paidWithIcon)
  );
  const primaryGlyph = measureLabelGlyph(ctx, debtLoanLabel, sharedFontSize);
  const primaryRowHeight = Math.max(
    primaryGlyph.height,
    tokenIcon ? primaryGlyph.iconSize : 0
  );

  let paidRowHeight = 0;
  if (paidWithTicker) {
    const paidGlyph = measureLabelGlyph(ctx, paidWithTicker, sharedFontSize);
    paidRowHeight = Math.max(
      paidGlyph.height,
      paidWithIcon ? paidGlyph.iconSize : 0
    );
  }

  const blockHeight =
    primaryRowHeight +
    (paidWithTicker ? GAP_BETWEEN_ROWS + paidRowHeight : 0);

  let y = resolveAnchoredTextTopY(TEXT_TOP_Y, blockHeight, LOGO_ZONE_TOP);

  // I REPAID MY [icon] WAD LOAN
  y = drawInlineIconLabelRow(ctx, {
    y,
    leading: {
      parts: [
        {
          text: REPAY_HEADLINE_PREFIX,
          color: TEXT_COLOR,
          letterSpacing: HEADLINE_LETTER_SPACING,
        },
        {
          text: REPAY_HEADLINE_ACTION,
          color: ACTION_COLOR,
          letterSpacing: HEADLINE_LETTER_SPACING,
        },
        {
          text: REPAY_HEADLINE_SUFFIX,
          color: TEXT_COLOR,
          letterSpacing: HEADLINE_LETTER_SPACING,
        },
      ],
      gapAfter: GAP_AFTER_HEADLINE,
    },
    label: debtLoanLabel,
    fontSize: sharedFontSize,
    icon: tokenIcon,
  });

  // WITH [icon] USDC
  if (paidWithTicker) {
    y += GAP_BETWEEN_ROWS;
    y = drawInlineIconLabelRow(ctx, {
      y,
      leading: {
        parts: [{ text: formatRepayWithLabel(), color: WITH_COLOR }],
        gapAfter: GAP_AFTER_WITH,
      },
      label: paidWithTicker,
      fontSize: sharedFontSize,
      icon: paidWithIcon,
    });
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result);
        else reject(new Error("Failed to export repay share image"));
      },
      "image/png",
      1
    );
  });

  return {
    blob,
    objectUrl: URL.createObjectURL(blob),
  };
}

export function revokeRepayShareResult(
  result: RepayShareResult | null
): void {
  if (result?.objectUrl) {
    URL.revokeObjectURL(result.objectUrl);
  }
}
