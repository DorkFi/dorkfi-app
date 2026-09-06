import {
  buildRepayShareHashtagLine,
  DEFAULT_REPAY_SHARE_LINK,
} from "@/utils/repayShare/format";

export const BORROW_HEADLINE_PREFIX = "I ";
export const BORROW_HEADLINE_ACTION = "BORROWED";

export function formatBorrowHeadline(): string {
  return `${BORROW_HEADLINE_PREFIX}${BORROW_HEADLINE_ACTION}`;
}

export function formatBorrowTickerLabel(assetSymbol: string): string {
  return (assetSymbol.trim() || "ASSET").toUpperCase();
}

export const DEFAULT_BORROW_SHARE_LINK = DEFAULT_REPAY_SHARE_LINK;

export type BorrowShareTweetTextInput = {
  amount: string;
  assetSymbol: string;
  network?: string;
  shareUrl?: string;
};

export function buildBorrowShareHashtagLine(network?: string): string {
  return buildRepayShareHashtagLine(network);
}

export function buildBorrowShareTweetText(input: BorrowShareTweetTextInput): string {
  const link = input.shareUrl?.trim() || DEFAULT_BORROW_SHARE_LINK;
  const asset = formatBorrowTickerLabel(input.assetSymbol);

  return [
    `I borrowed ${asset} from @dork_fi`,
    "",
    buildBorrowShareHashtagLine(input.network),
    "",
    link,
  ].join("\n");
}

export function buildGenericBorrowShareTweetText(
  shareUrl?: string,
  network?: string
): string {
  const link = shareUrl?.trim() || DEFAULT_BORROW_SHARE_LINK;
  return [
    "I borrowed from @dork_fi",
    "",
    buildBorrowShareHashtagLine(network),
    "",
    link,
  ].join("\n");
}
