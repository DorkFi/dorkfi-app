import {
  PROFILE_SHARE_HEIGHT,
  PROFILE_SHARE_OVERLAY_HEADLINE,
  PROFILE_SHARE_WIDTH,
  type ProfileShareInput,
  type ProfileShareResult,
} from "./types";
import { formatProfileNftItemName } from "./format";
import { resolveProfileShareImageSrc } from "./resolveProfileShareImageSrc";

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
  const sourceAspect = img.width / Math.max(img.height, 1);
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

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export async function generateProfileShareImage(
  input: ProfileShareInput
): Promise<ProfileShareResult> {
  const avatarSrc = input.avatarImage?.trim();
  if (!avatarSrc) {
    throw new Error("Missing profile NFT image");
  }

  // Highforge (and similar CDNs) omit CORS headers; load via share-server proxy.
  const nftImage = await loadImage(resolveProfileShareImageSrc(avatarSrc));

  const canvas = document.createElement("canvas");
  canvas.width = PROFILE_SHARE_WIDTH;
  canvas.height = PROFILE_SHARE_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not create canvas context");
  }

  drawCover(ctx, nftImage, PROFILE_SHARE_WIDTH, PROFILE_SHARE_HEIGHT);

  // Soft top wash so top-left text stays readable over bright NFT art
  const gradient = ctx.createLinearGradient(0, 0, 0, 280);
  gradient.addColorStop(0, "rgba(0, 0, 0, 0.45)");
  gradient.addColorStop(0.7, "rgba(0, 0, 0, 0.15)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, PROFILE_SHARE_WIDTH, 280);

  const itemName = formatProfileNftItemName(input.nftName);
  // Equal outer margin for the pill so X's rounded crop doesn't look tighter on top.
  const margin = 40;
  const pillPadX = 16;
  const pillPadY = 14;
  const lineGap = 8;
  const headlineSize = 42;
  const nameSize = 36;
  const textX = margin + pillPadX;
  const textY = margin + pillPadY;

  ctx.font = `800 ${headlineSize}px Poppins, sans-serif`;
  const headlineWidth = ctx.measureText(PROFILE_SHARE_OVERLAY_HEADLINE).width;
  ctx.font = `700 ${nameSize}px Poppins, sans-serif`;
  const nameWidth = ctx.measureText(itemName).width;
  const pillW = Math.max(headlineWidth, nameWidth) + pillPadX * 2;
  const pillH = pillPadY * 2 + headlineSize + lineGap + nameSize;

  ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
  drawRoundedRect(ctx, margin, margin, pillW, pillH, 16);
  ctx.fill();

  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
  ctx.shadowBlur = 8;
  ctx.fillStyle = "#ffffff";

  ctx.font = `800 ${headlineSize}px Poppins, sans-serif`;
  ctx.fillText(PROFILE_SHARE_OVERLAY_HEADLINE, textX, textY);

  ctx.font = `700 ${nameSize}px Poppins, sans-serif`;
  ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
  ctx.fillText(itemName, textX, textY + headlineSize + lineGap);
  ctx.shadowBlur = 0;

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (!result) {
          reject(new Error("Failed to export profile share image"));
          return;
        }
        resolve(result);
      },
      "image/png",
      0.95
    );
  });

  return {
    blob,
    objectUrl: URL.createObjectURL(blob),
  };
}

export function revokeProfileShareResult(
  result: ProfileShareResult | null | undefined
): void {
  if (result?.objectUrl) {
    URL.revokeObjectURL(result.objectUrl);
  }
}
