export type MeasureTextWidth = (text: string) => number;

export const SHARE_TITLE_LINE_HEIGHT_MULTIPLIER = 1.16;

export const REPAY_HEADLINE_PREFIX = "I ";
export const REPAY_HEADLINE_ACTION = "REPAID";
export const REPAY_HEADLINE_SUFFIX = " MY";

export function formatRepayHeadline(): string {
  return `${REPAY_HEADLINE_PREFIX}${REPAY_HEADLINE_ACTION}${REPAY_HEADLINE_SUFFIX}`;
}

export function formatRepayDebtLoanLabel(assetSymbol: string): string {
  const ticker = (assetSymbol.trim() || "ASSET").toUpperCase();
  return `${ticker} LOAN`;
}

/** Split amount+asset title into up to two uppercase display lines for the share image. */
export function splitRepayTitleLines(title: string, maxLines = 2): string[] {
  const trimmed = title.trim();
  if (!trimmed) return ["LOAN", "REPAYMENT"];

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 1) return [words[0].toUpperCase()];
  if (words.length === 2) {
    return [words[0].toUpperCase(), words[1].toUpperCase()];
  }
  if (words.length === 3) {
    return [words[0].toUpperCase(), words.slice(1).join(" ").toUpperCase()];
  }

  const mid = Math.ceil(words.length / 2);
  return [
    words.slice(0, mid).join(" ").toUpperCase(),
    words.slice(mid).join(" ").toUpperCase(),
  ].slice(0, maxLines);
}

/** @deprecated Prefer splitRepayTitleLines — kept for shared layout helpers. */
export function splitProposalTitleLines(title: string, maxLines = 2): string[] {
  return splitRepayTitleLines(title, maxLines);
}

export function formatRepayAmountLabel(
  amount: string,
  assetSymbol: string
): string {
  const amt = amount.trim() || "0";
  const asset = assetSymbol.trim() || "ASSET";
  return `${amt} ${asset}`.trim();
}

export function formatRepayContextLabel(network?: string): string {
  const net = network?.trim();
  if (net) return `ON ${net.toUpperCase()}`;
  return "ON DORKFI";
}

export function formatRepayWithLabel(): string {
  return "WITH";
}

/** True when share should show the cross-asset "WITH / payment ticker" block. */
export function shouldShowPaidWithRow(
  debtSymbol: string,
  paidWithSymbol?: string
): boolean {
  const paid = paidWithSymbol?.trim();
  if (!paid) return false;
  return paid.toUpperCase() !== debtSymbol.trim().toUpperCase();
}

export const DEFAULT_REPAY_SHARE_LINK = "https://app.dork.fi";

export type RepayShareTweetTextInput = {
  amount: string;
  assetSymbol: string;
  /** Payment token when cross-asset repay (different from debt). */
  paidWithSymbol?: string;
  network?: string;
  shareUrl?: string;
};

/** Map app network id / label to an X hashtag (without #). */
export function resolveRepayShareNetworkHashtag(
  network?: string
): string | null {
  const raw = network?.trim().toLowerCase();
  if (!raw) return null;
  if (raw.includes("algorand") || raw === "algo") return "Algorand";
  if (raw.includes("voi")) return "VoiNetwork";
  return null;
}

export function buildRepayShareHashtagLine(network?: string): string {
  const tags = ["#DorkFi"];
  const networkTag = resolveRepayShareNetworkHashtag(network);
  if (networkTag) tags.push(`#${networkTag}`);
  return tags.join(" ");
}

export function buildRepayShareTweetText(input: RepayShareTweetTextInput): string {
  const link = input.shareUrl?.trim() || DEFAULT_REPAY_SHARE_LINK;
  const amount = input.amount.trim() || "0";
  const asset = input.assetSymbol.trim() || "ASSET";
  const paidWith = shouldShowPaidWithRow(asset, input.paidWithSymbol)
    ? input.paidWithSymbol!.trim().toUpperCase()
    : null;

  const opening = paidWith
    ? `I just repaid ${amount} ${asset} with ${paidWith} on @Dork_Fi.`
    : `I just repaid ${amount} ${asset} on @Dork_Fi.`;

  const lines = [opening];
  if (paidWith) {
    lines.push("", "Swap powered by @haydotapp");
  }
  lines.push("", "Keep your health factor happy 👇", link, "");
  lines.push(buildRepayShareHashtagLine(input.network));
  return lines.join("\n");
}

export function buildGenericRepayShareTweetText(
  shareUrl?: string,
  network?: string
): string {
  const link = shareUrl?.trim() || DEFAULT_REPAY_SHARE_LINK;
  return [
    "I just repaid a loan on @Dork_Fi.",
    "",
    "Keep your health factor happy 👇",
    link,
    "",
    buildRepayShareHashtagLine(network),
  ].join("\n");
}

export function truncateLineToWidth(
  text: string,
  measureWidth: MeasureTextWidth,
  maxWidth: number,
  ellipsis = "..."
): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  if (measureWidth(trimmed) <= maxWidth) return trimmed;

  let truncated = trimmed;
  while (truncated.length > 0 && measureWidth(truncated + ellipsis) > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated.length > 0 ? truncated + ellipsis : ellipsis;
}

export function breakWordAtWidth(
  word: string,
  measureWidth: MeasureTextWidth,
  maxWidth: number
): string[] {
  if (!word) return [];
  if (measureWidth(word) <= maxWidth) return [word];

  const parts: string[] = [];
  let chunk = "";

  for (const char of word) {
    const candidate = chunk + char;
    if (measureWidth(candidate) <= maxWidth) {
      chunk = candidate;
      continue;
    }
    if (chunk) parts.push(chunk);
    chunk = char;
  }

  if (chunk) parts.push(chunk);
  return parts.length > 0 ? parts : [word];
}

function hasLineLimit(maxLines: number): boolean {
  return Number.isFinite(maxLines) && maxLines > 0;
}

function pushOverflowLine(
  lines: string[],
  line: string,
  maxLines: number,
  ellipsis: boolean,
  measureWidth: MeasureTextWidth,
  maxWidth: number
): boolean {
  if (!hasLineLimit(maxLines) || lines.length < maxLines) {
    lines.push(line);
    return false;
  }

  if (ellipsis) {
    lines[maxLines - 1] = truncateLineToWidth(
      `${lines[maxLines - 1]} ${line}`,
      measureWidth,
      maxWidth
    );
    return true;
  }

  lines.push(line);
  return false;
}

/**
 * Word-wrap text to fit maxWidth. When ellipsis is true, caps at maxLines and
 * ellipsizes overflow. When ellipsis is false, wraps all content (breaking long words).
 */
export function wrapTextLines(
  text: string,
  measureWidth: MeasureTextWidth,
  maxWidth: number,
  maxLines = 3,
  ellipsis = true
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  if (hasLineLimit(maxLines) && maxLines <= 0) return [];

  const lines: string[] = [];
  let current = "";

  const flushCurrent = (): boolean => {
    if (!current) return false;
    const done = pushOverflowLine(
      lines,
      current,
      maxLines,
      ellipsis,
      measureWidth,
      maxWidth
    );
    current = "";
    return done;
  };

  const appendWordParts = (word: string): boolean => {
    const wordParts = breakWordAtWidth(word, measureWidth, maxWidth);
    for (const part of wordParts) {
      const partCandidate = current ? `${current} ${part}` : part;
      if (measureWidth(partCandidate) <= maxWidth) {
        current = partCandidate;
        continue;
      }
      if (flushCurrent()) return true;
      current = part;
    }
    return false;
  };

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const candidate = current ? `${current} ${word}` : word;

    if (measureWidth(candidate) <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) {
      if (flushCurrent()) return lines.slice(0, maxLines);
    }

    if (measureWidth(word) <= maxWidth) {
      current = word;
      continue;
    }

    if (ellipsis) {
      if (
        pushOverflowLine(
          lines,
          truncateLineToWidth(word, measureWidth, maxWidth),
          maxLines,
          ellipsis,
          measureWidth,
          maxWidth
        )
      ) {
        return lines.slice(0, maxLines);
      }
      if (hasLineLimit(maxLines) && lines.length >= maxLines) {
        const remainder = words.slice(i + 1).join(" ");
        if (remainder) {
          lines[maxLines - 1] = truncateLineToWidth(
            `${lines[maxLines - 1]} ${remainder}`,
            measureWidth,
            maxWidth
          );
        }
        return lines.slice(0, maxLines);
      }
      current = "";
      continue;
    }

    if (appendWordParts(word)) return lines;
  }

  if (current) {
    if (ellipsis && hasLineLimit(maxLines) && lines.length >= maxLines) {
      lines[maxLines - 1] = truncateLineToWidth(
        `${lines[maxLines - 1]} ${current}`,
        measureWidth,
        maxWidth
      );
    } else {
      lines.push(current);
    }
  }

  if (!ellipsis || !hasLineLimit(maxLines)) return lines;
  return lines.slice(0, maxLines);
}

export function computeTitleBlockHeight(
  lineCount: number,
  fontSize: number,
  gapBetweenTitleLines: number
): number {
  if (lineCount <= 0) return 0;
  const lineHeight = fontSize * SHARE_TITLE_LINE_HEIGHT_MULTIPLIER;
  return (
    lineCount * lineHeight + Math.max(0, lineCount - 1) * gapBetweenTitleLines
  );
}

function fitSingleLine(
  text: string,
  measureWidth: MeasureTextWidth,
  maxWidth: number
): string | null {
  const trimmed = text.trim();
  if (!trimmed) return "";
  if (measureWidth(trimmed) <= maxWidth) return trimmed;

  const fittedWords: string[] = [];
  for (const word of trimmed.split(/\s+/).filter(Boolean)) {
    if (measureWidth(word) <= maxWidth) {
      fittedWords.push(word);
      continue;
    }

    const parts = breakWordAtWidth(word, measureWidth, maxWidth);
    if (parts.some((part) => measureWidth(part) > maxWidth)) return null;
    fittedWords.push(parts.join(" "));
  }

  const line = fittedWords.join(" ");
  return measureWidth(line) <= maxWidth ? line : null;
}

function splitWordAcrossLines(
  word: string,
  measureWidth: MeasureTextWidth,
  maxWidth: number,
  maxLines: number
): string[] | null {
  if (maxLines <= 1) return null;

  const trySplit = (lineCount: number): string[] | null => {
    const parts: string[] = [];
    let start = 0;

    for (let lineIndex = 0; lineIndex < lineCount; lineIndex++) {
      let end = start + 1;
      let bestEnd = -1;

      while (end <= word.length) {
        const segment = word.slice(start, end);
        if (measureWidth(segment) <= maxWidth) {
          bestEnd = end;
          end++;
          continue;
        }
        break;
      }

      if (bestEnd === -1) return null;
      parts.push(word.slice(start, bestEnd));
      start = bestEnd;
    }

    if (start < word.length) return null;
    return parts;
  };

  for (let lineCount = 2; lineCount <= maxLines; lineCount++) {
    const split = trySplit(lineCount);
    if (split) return split;
  }

  return null;
}

export function findFixedLineLayout(
  text: string,
  measureWidth: MeasureTextWidth,
  maxWidth: number,
  maxLines = 2
): string[] | null {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  if (maxLines <= 0) return null;

  if (words.length === 1) {
    const single = fitSingleLine(words[0], measureWidth, maxWidth);
    if (single) return [single];
    return splitWordAcrossLines(words[0], measureWidth, maxWidth, maxLines);
  }

  if (maxLines === 1) {
    const line = fitSingleLine(words.join(" "), measureWidth, maxWidth);
    return line ? [line] : null;
  }

  let best: string[] | null = null;
  let bestBalance = Number.POSITIVE_INFINITY;

  for (let split = 1; split < words.length; split++) {
    const line1 = fitSingleLine(words.slice(0, split).join(" "), measureWidth, maxWidth);
    const line2 = fitSingleLine(words.slice(split).join(" "), measureWidth, maxWidth);
    if (!line1 || !line2) continue;

    const balance = Math.abs(measureWidth(line1) - measureWidth(line2));
    if (balance < bestBalance) {
      bestBalance = balance;
      best = [line1, line2];
    }
  }

  return best;
}

export function resolveTitleFontSize(
  lines: string[],
  measureAtSize: (text: string, fontSize: number) => number,
  maxWidth: number,
  minFontSize = 56,
  maxFontSize = 80
): { fontSize: number; lines: string[] } {
  for (let fontSize = maxFontSize; fontSize >= minFontSize; fontSize -= 4) {
    if (lines.every((line) => measureAtSize(line, fontSize) <= maxWidth)) {
      return { fontSize, lines };
    }
  }

  for (let fontSize = minFontSize - 4; fontSize >= 12; fontSize -= 4) {
    if (lines.every((line) => measureAtSize(line, fontSize) <= maxWidth)) {
      return { fontSize, lines };
    }
  }

  return { fontSize: minFontSize, lines };
}

export function resolveShareTitleLayout(
  title: string,
  measureAtSize: (text: string, fontSize: number) => number,
  maxWidth: number,
  maxTitleBlockHeight: number,
  gapBetweenTitleLines: number,
  minFontSize = 28,
  maxFontSize = 80,
  maxTitleLines = 2
): { fontSize: number; lines: string[] } {
  const text = title.trim() ? title.trim().toUpperCase() : "LOAN REPAYMENT";

  for (let fontSize = maxFontSize; fontSize >= minFontSize; fontSize -= 4) {
    const measure = (line: string) => measureAtSize(line, fontSize);
    const lines = findFixedLineLayout(text, measure, maxWidth, maxTitleLines);
    if (!lines) continue;

    const titleBlockHeight = computeTitleBlockHeight(
      lines.length,
      fontSize,
      gapBetweenTitleLines
    );

    if (
      lines.length <= maxTitleLines &&
      lines.every((line) => measure(line) <= maxWidth) &&
      titleBlockHeight <= maxTitleBlockHeight
    ) {
      return { fontSize, lines };
    }
  }

  const fontSize = minFontSize;
  const measure = (line: string) => measureAtSize(line, fontSize);
  const lines =
    findFixedLineLayout(text, measure, maxWidth, maxTitleLines) ??
    splitProposalTitleLines(text, maxTitleLines);

  return { fontSize, lines };
}

export function computeShareTextBlockHeight(params: {
  headlineFontSize: number;
  gapHeadlineToTitle: number;
  titleFontSize: number;
  titleLineCount: number;
  gapBetweenTitleLines: number;
  gapTitleToPower: number;
  powerFontSize: number;
}): number {
  const titleLineHeight = params.titleFontSize * SHARE_TITLE_LINE_HEIGHT_MULTIPLIER;
  const titleBlockHeight =
    params.titleLineCount <= 0
      ? 0
      : params.titleLineCount * titleLineHeight +
        (params.titleLineCount - 1) * params.gapBetweenTitleLines;

  return (
    params.headlineFontSize +
    params.gapHeadlineToTitle +
    titleBlockHeight +
    params.gapTitleToPower +
    params.powerFontSize
  );
}

export function resolveAnchoredTextTopY(
  anchorTop: number,
  blockHeight: number,
  logoZoneTop: number
): number {
  if (anchorTop + blockHeight <= logoZoneTop) {
    return anchorTop;
  }
  return Math.max(0, logoZoneTop - blockHeight);
}

export function computeShareTextTopY(
  blockHeight: number,
  canvasHeight: number,
  logoZoneTop: number,
  minTopMargin = 64,
  verticalBias = -20
): number {
  let top = (canvasHeight - blockHeight) / 2 + verticalBias;
  const maxTop = logoZoneTop - blockHeight;
  top = Math.min(top, maxTop);
  if (maxTop >= minTopMargin) {
    return Math.max(minTopMargin, top);
  }
  return Math.max(0, maxTop);
}