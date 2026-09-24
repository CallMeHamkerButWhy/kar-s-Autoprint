import type { ColorMode, PaperSize, Rates } from "@/lib/types";

/** Sheets actually consumed, which is what the shop charges for. */
export function sheetsFor(pages: number, copies: number, duplex: boolean) {
  const perCopy = duplex ? Math.ceil(pages / 2) : pages;
  return Math.max(perCopy, 1) * Math.max(copies, 1);
}

function bigPaperRate(rates: Rates, paperSize: PaperSize, color: ColorMode) {
  const table =
    paperSize === "A3"
      ? rates.a3
      : paperSize === "A2"
        ? rates.a2
        : paperSize === "A1"
          ? rates.a1
          : null;
  if (!table) return null;
  const value = color === "color" ? table.color : table.bw;
  return value > 0 ? value : null;
}

/**
 * Rate for one sheet. Big paper has its own rate; otherwise volume tiers
 * apply, and the plain per-page rate is the fallback.
 */
export function ratePerSheet(
  rates: Rates,
  {
    paperSize,
    color,
    sheets,
  }: { paperSize: PaperSize; color: ColorMode; sheets: number },
) {
  const big = bigPaperRate(rates, paperSize, color);
  if (big != null) return big;

  const tier = [...rates.pageRanges]
    .filter((item) => item.fromPages > 0 && sheets >= item.fromPages)
    .sort((a, b) => b.fromPages - a.fromPages)[0];

  if (tier) {
    const value = color === "color" ? tier.color : tier.bw;
    if (value > 0) return value;
  }

  return color === "color" ? rates.color : rates.bw;
}

export interface PriceableDocument {
  pages: number;
  copies: number;
  color: ColorMode;
  paperSize: PaperSize;
  duplex: boolean;
}

export function priceDocument(rates: Rates, document: PriceableDocument) {
  const sheets = sheetsFor(document.pages, document.copies, document.duplex);
  const rate = ratePerSheet(rates, {
    paperSize: document.paperSize,
    color: document.color,
    sheets,
  });
  return { sheets, rate, amount: Math.round(sheets * rate) };
}

export function priceOrder(rates: Rates, documents: PriceableDocument[]) {
  const lines = documents.map((document) => priceDocument(rates, document));
  return {
    lines,
    sheets: lines.reduce((total, line) => total + line.sheets, 0),
    amount: lines.reduce((total, line) => total + line.amount, 0),
  };
}

export function formatRupees(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}
