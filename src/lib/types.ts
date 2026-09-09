// ── Core domain types for Dus2 PORI billing ─────────────────────────────

export type PaymentMode = "Cash" | "UPI" | "Card" | "Credit";
export type InvoiceStatus = "paid" | "partial" | "unpaid";

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  birthday?: string; // YYYY-MM-DD
  notes?: string;
  loyaltyPoints: number;
  totalSpent: number;
  visits: number;
  lastVisit?: string; // ISO
  createdAt: string; // ISO
  /** Shareable code this customer gives to friends. */
  referralCode: string;
  /** Customer id of whoever referred them. */
  referredBy?: string;
  /** Set once the referrer has been paid their share of the first purchase. */
  referralRewarded?: boolean;
}

export type PointsReason =
  | "purchase"
  | "redeem"
  | "referral-reward"
  | "referral-welcome"
  | "referral-purchase"
  | "birthday"
  | "manual";

/** Every movement of a customer's points, so the balance is always explainable. */
export interface PointsEntry {
  id: string;
  customerId: string;
  date: string; // ISO
  /** Positive when earned, negative when spent. */
  points: number;
  reason: PointsReason;
  note?: string;
  invoiceId?: string;
}

export interface Item {
  id: string;
  name: string;
  sku?: string;
  category?: string;
  unit: string; // pcs, ml, gm, box...
  sellPrice: number;
  costPrice?: number;
  stock: number;
  lowStockAt: number;
  taxRate: number; // %
  hsn?: string;
  createdAt: string;
}

export interface InvoiceLine {
  id: string;
  itemId?: string;
  name: string;
  unit: string;
  qty: number;
  price: number;
  discountPct: number;
  taxRate: number;
  /** Line total after discount, excluding tax. */
  taxable: number;
  taxAmount: number;
  amount: number; // taxable + taxAmount
}

export interface Invoice {
  id: string;
  number: string;
  date: string; // ISO
  customerId?: string;
  customerName: string;
  customerPhone: string;
  lines: InvoiceLine[];
  subTotal: number; // sum of qty*price before line discount
  lineDiscount: number;
  billDiscount: number;
  taxAmount: number;
  pointsRedeemed: number;
  pointsValue: number; // rupee value of redeemed points
  roundOff: number;
  total: number;
  paid: number;
  due: number;
  paymentMode: PaymentMode;
  status: InvoiceStatus;
  pointsEarned: number;
  notes?: string;
  createdAt: string;
}

export interface Expense {
  id: string;
  date: string; // ISO
  category: string;
  note?: string;
  amount: number;
  paymentMode: PaymentMode;
  createdAt: string;
}

export interface LoyaltyConfig {
  enabled: boolean;
  /** Points earned for every ₹100 spent. */
  pointsPer100: number;
  /** Rupee value of 1 point when redeeming. */
  rupeesPerPoint: number;
  /** Minimum points required before redeeming. */
  minRedeem: number;
  /** Bonus points gifted on a birthday-month visit. */
  birthdayBonus: number;
}

export interface ReferralConfig {
  enabled: boolean;
  /** Points to the referrer, the moment their code is used. */
  referrerBonus: number;
  /** Welcome points to the friend who entered the code. */
  friendBonus: number;
  /**
   * Extra points to the referrer worth this percentage of the friend's first
   * bill. 0 turns it off.
   */
  firstPurchasePercent: number;
}

export interface Settings {
  shopName: string;
  tagline: string;
  phone: string;
  address: string;
  gstin: string;
  upiId: string;
  invoicePrefix: string;
  nextInvoiceNo: number;
  gstEnabled: boolean;
  defaultTaxRate: number;
  roundOffEnabled: boolean;
  loyalty: LoyaltyConfig;
  referral: ReferralConfig;
  footerNote: string;
}

export interface Database {
  version: number;
  settings: Settings;
  customers: Customer[];
  items: Item[];
  invoices: Invoice[];
  expenses: Expense[];
  pointsLog: PointsEntry[];
}
