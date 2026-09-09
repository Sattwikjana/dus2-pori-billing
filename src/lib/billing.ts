import type { InvoiceLine, LoyaltyConfig } from "./types";

export interface DraftLine {
  id: string;
  itemId?: string;
  name: string;
  unit: string;
  qty: number;
  price: number;
  discountPct: number;
  taxRate: number;
}

export function computeLine(line: DraftLine, gstEnabled: boolean): InvoiceLine {
  const gross = line.qty * line.price;
  const taxable = gross - (gross * line.discountPct) / 100;
  const taxAmount = gstEnabled ? (taxable * line.taxRate) / 100 : 0;
  return {
    ...line,
    taxable: round2(taxable),
    taxAmount: round2(taxAmount),
    amount: round2(taxable + taxAmount),
  };
}

export interface BillTotals {
  lines: InvoiceLine[];
  subTotal: number;
  lineDiscount: number;
  billDiscount: number;
  taxAmount: number;
  pointsValue: number;
  roundOff: number;
  total: number;
  pointsEarned: number;
}

export function computeBill(opts: {
  lines: DraftLine[];
  gstEnabled: boolean;
  billDiscount: number;
  pointsRedeemed: number;
  loyalty: LoyaltyConfig;
  roundOffEnabled: boolean;
}): BillTotals {
  const lines = opts.lines.map((l) => computeLine(l, opts.gstEnabled));

  const subTotal = round2(lines.reduce((s, l) => s + l.qty * l.price, 0));
  const lineDiscount = round2(subTotal - lines.reduce((s, l) => s + l.taxable, 0));
  const taxAmount = round2(lines.reduce((s, l) => s + l.taxAmount, 0));

  const afterLines = subTotal - lineDiscount + taxAmount;
  const billDiscount = round2(Math.min(opts.billDiscount, afterLines));
  const pointsValue = round2(
    Math.min(
      opts.pointsRedeemed * opts.loyalty.rupeesPerPoint,
      Math.max(0, afterLines - billDiscount),
    ),
  );

  const beforeRound = Math.max(0, afterLines - billDiscount - pointsValue);
  const total = opts.roundOffEnabled ? Math.round(beforeRound) : round2(beforeRound);
  const roundOff = round2(total - beforeRound);

  // Points are earned on money actually paid, not on redeemed value.
  const pointsEarned = opts.loyalty.enabled
    ? Math.floor((total / 100) * opts.loyalty.pointsPer100)
    : 0;

  return {
    lines,
    subTotal,
    lineDiscount,
    billDiscount,
    taxAmount,
    pointsValue,
    roundOff,
    total,
    pointsEarned,
  };
}

export function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** How many points a customer may spend on this bill. */
export function maxRedeemablePoints(
  available: number,
  billAmount: number,
  loyalty: LoyaltyConfig,
) {
  if (!loyalty.enabled || available < loyalty.minRedeem) return 0;
  const byMoney = Math.floor(billAmount / Math.max(loyalty.rupeesPerPoint, 0.01));
  return Math.max(0, Math.min(available, byMoney));
}

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`;
}

/** Indian numbering system, for the printed invoice. */
export function amountInWords(amount: number): string {
  const n = Math.floor(Math.abs(amount));
  if (n === 0) return "Zero Rupees Only";

  const parts: string[] = [];
  const crore = Math.floor(n / 1e7);
  const lakh = Math.floor((n % 1e7) / 1e5);
  const thousand = Math.floor((n % 1e5) / 1e3);
  const hundred = Math.floor((n % 1e3) / 100);
  const rest = n % 100;

  if (crore) parts.push(`${twoDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (hundred) parts.push(`${ONES[hundred]} Hundred`);
  if (rest) parts.push(twoDigits(rest));

  const paise = Math.round((Math.abs(amount) - n) * 100);
  const main = `${parts.join(" ")} Rupees`;
  return paise ? `${main} and ${twoDigits(paise)} Paise Only` : `${main} Only`;
}
