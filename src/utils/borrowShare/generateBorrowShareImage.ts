import { resolveAnchoredTextTopY } from "@/utils/repayShare/format";
import {
  BORROW_HEADLINE_ACTION,
  BORROW_HEADLINE_PREFIX,
  formatBorrowTickerLabel,
} from "./format";
import {
  BORROW_SHARE_HEIGHT,
  BORROW_SHARE_WIDTH,
  resolveBorrowShareTemplatePath,
  type BorrowShareInput,
  type BorrowShareResult,
} from "./types";

/** Overlay text color on warm sunset sky art. */
const TEXT_COLOR = "#0b2a4a";
const ACTION_COLOR = TEXT_COLOR;
const TEXT_SHADOW = "rgba(255, 255, 255, 0.85)";

const TEXT_LEFT_X = 48;
const SAFE_TEXT_RIGHT = 1140;
const TITLE_MAX_WIDTH = SAFE_TEXT_RIGHT - TEXT_LEFT_X;
const TEXT_TOP_Y = 72;
/** Keep overlay in the sky above the desk / whales. */
const LOGO_ZONE_TOP = 280;

const TITLE_FONT_MAX = 84;
const TITLE_FONT_MIN = 32;

const GAP_AFTER_HEADLINE = 14;
const ICON_GAP = 12;
const ICON_TO_GLYPH_RATIO = 1.15;
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
  tickerLabel: string,
  fontSize: number,
  hasIcon: boolean
): number {
  ctx.font = titleFont(fontSize);
  ctx.letterSpacing = HEADLINE_LETTER_SPACING;
  const headlineWidth = ctx.measureText(
    `${BORROW_HEADLINE_PREFIX}${BORROW_HEADLINE_ACTION}`
  ).width;
  ctx.letterSpacing = "0px";
  const tickerWidth = ctx.measureText(tickerLabel).width;
  const iconWidth = hasIcon ? estimateIconSize(fontSize) + ICON_GAP : 0;
  return headlineWidth + GAP_AFTER_HEADLINE + iconWidth + tickerWidth;
}

function resolveFontSize(
  ctx: CanvasRenderingContext2D,
  tickerLabel: string,
  hasIcon: boolean
): number {
  for (let fontSize = TITLE_FONT_MAX; fontSize >= TITLE_FONT_MIN; fontSize -= 4) {
    if (measurePrimaryLineWidth(ctx, tickerLabel, fontSize, hasIcon) <= TITLE_MAX_WIDTH) {
      return fontSize;
    }
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

function drawInlineIconLabelRow(
  ctx: CanvasRenderingContext2D,
  opts: {
    y: number;
    leading: {
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

export type GenerateBorrowShareImageOptions = {
  templateSrc?: string;
};

export async function generateBorrowShareImage(
  input: BorrowShareInput,
  options: GenerateBorrowShareImageOptions = {}
): Promise<BorrowShareResult> {
  const templateSrc =
    options.templateSrc ?? resolveBorrowShareTemplatePath();

  await ensureFontsLoaded();

  const canvas = document.createElement("canvas");
  canvas.width = BORROW_SHARE_WIDTH;
  canvas.height = BORROW_SHARE_HEIGHT;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context is not available");
  }

  const tickerLabel = formatBorrowTickerLabel(input.assetSymbol);

  const [background, tokenIcon] = await Promise.all([
    loadImage(templateSrc),
    input.assetIconSrc?.trim()
      ? tryLoadImage(input.assetIconSrc.trim())
      : Promise.resolve(null),
  ]);
  drawCover(ctx, background, BORROW_SHARE_WIDTH, BORROW_SHARE_HEIGHT);

  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  const fontSize = resolveFontSize(ctx, tickerLabel, Boolean(tokenIcon));
  const glyph = measureLabelGlyph(ctx, tickerLabel, fontSize);
  const rowHeight = Math.max(glyph.height, tokenIcon ? glyph.iconSize : 0);
  const y = resolveAnchoredTextTopY(TEXT_TOP_Y, rowHeight, LOGO_ZONE_TOP);

  // I BORROWED [icon] TICKER
  drawInlineIconLabelRow(ctx, {
    y,
    leading: {
      parts: [
        {
          text: BORROW_HEADLINE_PREFIX,
          color: TEXT_COLOR,
          letterSpacing: HEADLINE_LETTER_SPACING,
        },
        {
          text: BORROW_HEADLINE_ACTION,
          color: ACTION_COLOR,
          letterSpacing: HEADLINE_LETTER_SPACING,
        },
      ],
      gapAfter: GAP_AFTER_HEADLINE,
    },
    label: tickerLabel,
    fontSize,
    icon: tokenIcon,
  });

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result);
        else reject(new Error("Failed to export borrow share image"));
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

export function revokeBorrowShareResult(
  result: BorrowShareResult | null
): void {
  if (result?.objectUrl) {
    URL.revokeObjectURL(result.objectUrl);
  }
}
