import {
  formatVoteHeadlineVote,
  formatVotingPowerLabel,
  resolveShareTitleLayout,
  computeShareTextBlockHeight,
  resolveAnchoredTextTopY,
  VOTE_HEADLINE_PREFIX,
  SHARE_TITLE_LINE_HEIGHT_MULTIPLIER,
} from "./format";
import {
  GOVERNANCE_SHARE_HEIGHT,
  GOVERNANCE_SHARE_WIDTH,
  resolveGovernanceShareTemplatePath,
  type GovernanceShareInput,
  type GovernanceShareResult,
} from "./types";

const YES_COLOR = "#22c55e";
const NO_COLOR = "#ef4444";
const TEXT_COLOR = "#ffffff";
const TEXT_SHADOW = "rgba(6, 24, 56, 0.75)";

const TEXT_LEFT_X = 48;
/** Extends slightly into the whale zone for fuller titles on two lines. */
const SAFE_TEXT_RIGHT = 660;
const TITLE_MAX_WIDTH = SAFE_TEXT_RIGHT - TEXT_LEFT_X;
const TITLE_MAX_LINES = 2;
/** Aligns headline with whale head top on v7 YES template (1200×675 canvas). */
const TEXT_TOP_Y = 108;
const LOGO_ZONE_TOP = 510;

const HEADLINE_FONT_SIZE = 48;
const POWER_FONT_SIZE = 28;
const TITLE_FONT_MAX = 80;
const TITLE_FONT_MIN = 28;

const GAP_HEADLINE_TO_TITLE = 50;
const GAP_BETWEEN_TITLE_LINES = 18;
const GAP_TITLE_TO_POWER = 50;

const MAX_TITLE_BLOCK_HEIGHT =
  LOGO_ZONE_TOP -
  (HEADLINE_FONT_SIZE +
    GAP_HEADLINE_TO_TITLE +
    GAP_TITLE_TO_POWER +
    POWER_FONT_SIZE);

const HEADLINE_LETTER_SPACING = "2px";
const VOTE_OUTLINE_COLOR = "#000000";
const VOTE_OUTLINE_WIDTH = 5;

function titleFont(size: number): string {
  return `800 ${size}px "Nunito", Poppins, sans-serif`;
}

function headlineFont(): string {
  return `800 ${HEADLINE_FONT_SIZE}px "Nunito", Poppins, sans-serif`;
}

function powerFont(): string {
  return `600 ${POWER_FONT_SIZE}px "Nunito", Poppins, sans-serif`;
}

function drawVoteLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fillColor: string
): void {
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.strokeStyle = VOTE_OUTLINE_COLOR;
  ctx.lineWidth = VOTE_OUTLINE_WIDTH;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fillColor;
  ctx.fillText(text, x, y);
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

async function ensureFontsLoaded(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts?.load) return;

  const loads = [
    document.fonts.load(headlineFont()),
    document.fonts.load(powerFont()),
  ];
  for (let size = TITLE_FONT_MIN; size <= TITLE_FONT_MAX; size += 4) {
    loads.push(document.fonts.load(titleFont(size)));
  }
  await Promise.all(loads);
  await document.fonts.ready;
}

function applyTextShadow(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = TEXT_COLOR;
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

export type GenerateGovernanceShareImageOptions = {
  templateSrc?: string;
  locale?: string;
};

export async function generateGovernanceShareImage(
  input: GovernanceShareInput,
  options: GenerateGovernanceShareImageOptions = {}
): Promise<GovernanceShareResult> {
  const templateSrc =
    options.templateSrc ?? resolveGovernanceShareTemplatePath(input.support);
  const locale = options.locale ?? "en-US";

  await ensureFontsLoaded();

  const dpr = Math.min(
    typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
    2
  );

  const canvas = document.createElement("canvas");
  canvas.width = GOVERNANCE_SHARE_WIDTH * dpr;
  canvas.height = GOVERNANCE_SHARE_HEIGHT * dpr;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context is not available");
  }

  ctx.scale(dpr, dpr);

  const background = await loadImage(templateSrc);
  drawCover(ctx, background, GOVERNANCE_SHARE_WIDTH, GOVERNANCE_SHARE_HEIGHT);

  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  const titleLayout = resolveShareTitleLayout(
    input.proposalTitle,
    (text, fontSize) => {
      ctx.font = titleFont(fontSize);
      return ctx.measureText(text).width;
    },
    TITLE_MAX_WIDTH,
    MAX_TITLE_BLOCK_HEIGHT,
    GAP_BETWEEN_TITLE_LINES,
    TITLE_FONT_MIN,
    TITLE_FONT_MAX,
    TITLE_MAX_LINES
  );

  const titleLineHeight =
    titleLayout.fontSize * SHARE_TITLE_LINE_HEIGHT_MULTIPLIER;
  const blockHeight = computeShareTextBlockHeight({
    headlineFontSize: HEADLINE_FONT_SIZE,
    gapHeadlineToTitle: GAP_HEADLINE_TO_TITLE,
    titleFontSize: titleLayout.fontSize,
    titleLineCount: titleLayout.lines.length,
    gapBetweenTitleLines: GAP_BETWEEN_TITLE_LINES,
    gapTitleToPower: GAP_TITLE_TO_POWER,
    powerFontSize: POWER_FONT_SIZE,
  });

  let y = resolveAnchoredTextTopY(TEXT_TOP_Y, blockHeight, LOGO_ZONE_TOP);

  ctx.font = headlineFont();
  ctx.shadowColor = TEXT_SHADOW;
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 2;
  ctx.letterSpacing = HEADLINE_LETTER_SPACING;

  ctx.fillStyle = TEXT_COLOR;
  ctx.fillText(VOTE_HEADLINE_PREFIX, TEXT_LEFT_X, y);
  const prefixWidth = ctx.measureText(VOTE_HEADLINE_PREFIX).width;

  clearTextShadow(ctx);
  drawVoteLabel(
    ctx,
    formatVoteHeadlineVote(input.support),
    TEXT_LEFT_X + prefixWidth,
    y,
    input.support ? YES_COLOR : NO_COLOR
  );

  ctx.letterSpacing = "0px";
  y += HEADLINE_FONT_SIZE + GAP_HEADLINE_TO_TITLE;

  ctx.font = titleFont(titleLayout.fontSize);
  applyTextShadow(ctx);
  titleLayout.lines.forEach((line, index) => {
    ctx.fillText(line, TEXT_LEFT_X, y);
    y += titleLineHeight;
    if (index < titleLayout.lines.length - 1) {
      y += GAP_BETWEEN_TITLE_LINES;
    }
  });
  clearTextShadow(ctx);
  y += GAP_TITLE_TO_POWER;

  ctx.font = powerFont();
  ctx.globalAlpha = 0.7;
  applyTextShadow(ctx);
  ctx.fillText(
    formatVotingPowerLabel(input.votingPower, locale),
    TEXT_LEFT_X,
    y
  );
  ctx.globalAlpha = 1;
  clearTextShadow(ctx);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result);
        else reject(new Error("Failed to export governance share image"));
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

export function revokeGovernanceShareResult(
  result: GovernanceShareResult | null
): void {
  if (result?.objectUrl) {
    URL.revokeObjectURL(result.objectUrl);
  }
}
