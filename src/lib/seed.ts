"use client";

import { deriveReferralCode, replaceAll, uid } from "./db";
import { DEFAULT_SETTINGS } from "./db";
import { computeBill, type DraftLine } from "./billing";
import type {
  Customer,
  Database,
  Expense,
  Invoice,
  Item,
  PointsEntry,
} from "./types";

const PRODUCTS: [name: string, category: string, price: number, stock: number][] = [
  ["Lakme Absolute Matte Lipstick", "Lips", 749, 24],
  ["Maybelline Fit Me Foundation 30ml", "Face", 549, 15],
  ["L'Oreal Paris Kajal", "Eyes", 299, 40],
  ["Nivea Soft Light Moisturiser 100ml", "Skincare", 265, 30],
  ["Himalaya Neem Face Wash 150ml", "Skincare", 190, 6],
  ["Ponds White Beauty Cream 50g", "Skincare", 235, 18],
  ["Sugar Ace Of Face Foundation Stick", "Face", 899, 8],
  ["Mamaearth Vitamin C Serum 30ml", "Skincare", 599, 12],
  ["Colorbar Nail Paint", "Nails", 299, 3],
  ["Dove Intense Repair Shampoo 340ml", "Hair", 425, 20],
  ["Parachute Coconut Hair Oil 200ml", "Hair", 145, 45],
  ["Wow Onion Hair Conditioner", "Hair", 449, 0],
  ["Nykaa Matte Liquid Lipstick", "Lips", 425, 22],
  ["Garnier Micellar Cleansing Water", "Skincare", 349, 14],
  ["Elle 18 Compact Powder", "Face", 165, 35],
];

const PEOPLE: [name: string, phone: string, birthday?: string][] = [
  ["Priya Das", "9832145670", "1996-03-14"],
  ["Ananya Roy", "9051234867", "1999-11-02"],
  ["Sneha Ghosh", "8961472530", "1994-06-21"],
  ["Riya Banerjee", "7003985412", "2000-01-08"],
  ["Moumita Saha", "9748563210", "1992-09-30"],
  ["Puja Mondal", "8420931765", "1998-04-17"],
  ["Ishita Sen", "9903456128", "1995-12-25"],
  ["Sharmila Dutta", "9836702451", "1988-07-05"],
  ["Debjani Paul", "9007412583", "1991-02-11"],
  ["Tanushree Bose", "8697301254", "1997-10-19"],
];

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(10 + (n % 9), (n * 7) % 60, 0, 0);
  return d.toISOString();
}

/** Deterministic pseudo-random so the demo shop looks the same every time. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

export function installDemoData() {
  const rand = rng(20260909);
  const settings = {
    ...DEFAULT_SETTINGS,
    phone: "98765 43210",
    address: "Main Road, Near Bus Stand, West Bengal",
    upiId: "dus2pori@upi",
  };

  const items: Item[] = PRODUCTS.map(([name, category, sellPrice, stock], i) => ({
    id: `demo_i_${i}`,
    name,
    sku: `DP${String(i + 1).padStart(3, "0")}`,
    category,
    unit: "pcs",
    sellPrice,
    costPrice: Math.round(sellPrice * 0.68),
    stock,
    lowStockAt: 5,
    taxRate: 18,
    hsn: "3304",
    createdAt: daysAgo(120),
  }));

  const customers: Customer[] = PEOPLE.map(([name, phone, birthday], i) => ({
    id: `demo_c_${i}`,
    name,
    phone,
    birthday,
    loyaltyPoints: 0,
    totalSpent: 0,
    visits: 0,
    createdAt: daysAgo(90 - i * 3),
    referralCode: deriveReferralCode(`demo_c_${i}`, name),
  }));

  const pointsLog: PointsEntry[] = [];

  // A small referral chain, so the leaderboard has something to show.
  const { referrerBonus, friendBonus } = settings.referral;
  for (const [friendIdx, referrerIdx] of [
    [3, 0],
    [5, 0],
    [7, 1],
    [8, 3],
  ]) {
    const friend = customers[friendIdx];
    const referrer = customers[referrerIdx];
    friend.referredBy = referrer.id;
    friend.referralRewarded = true;
    friend.loyaltyPoints += friendBonus;
    referrer.loyaltyPoints += referrerBonus;
    pointsLog.push(
      {
        id: uid("p_"),
        customerId: friend.id,
        date: friend.createdAt,
        points: friendBonus,
        reason: "referral-welcome",
        note: `Joined using ${referrer.name}'s code`,
      },
      {
        id: uid("p_"),
        customerId: referrer.id,
        date: friend.createdAt,
        points: referrerBonus,
        reason: "referral-reward",
        note: `Referred ${friend.name}`,
      },
    );
  }

  const invoices: Invoice[] = [];
  let invoiceNo = 1;

  // Roughly 45 bills spread across the last 30 days.
  for (let day = 29; day >= 0; day--) {
    const billsToday = 1 + Math.floor(rand() * 3);
    for (let b = 0; b < billsToday; b++) {
      const walkIn = rand() < 0.25;
      const customer = walkIn
        ? null
        : customers[Math.floor(rand() * customers.length)];

      const lineCount = 1 + Math.floor(rand() * 3);
      const lines: DraftLine[] = [];
      for (let l = 0; l < lineCount; l++) {
        const item = items[Math.floor(rand() * items.length)];
        if (lines.some((x) => x.itemId === item.id)) continue;
        lines.push({
          id: uid("l_"),
          itemId: item.id,
          name: item.name,
          unit: item.unit,
          qty: 1 + Math.floor(rand() * 2),
          price: item.sellPrice,
          discountPct: rand() < 0.25 ? 10 : 0,
          taxRate: item.taxRate,
        });
      }
      if (!lines.length) continue;

      const available = customer?.loyaltyPoints ?? 0;
      const redeem =
        customer && available >= settings.loyalty.minRedeem && rand() < 0.3
          ? Math.min(available, 50)
          : 0;

      const bill = computeBill({
        lines,
        gstEnabled: settings.gstEnabled,
        billDiscount: 0,
        pointsRedeemed: redeem,
        loyalty: settings.loyalty,
        roundOffEnabled: settings.roundOffEnabled,
      });

      const date = daysAgo(day);
      const modes = ["Cash", "UPI", "UPI", "Card"] as const;
      const paymentMode = modes[Math.floor(rand() * modes.length)];
      const unpaid = rand() < 0.07;

      const invoice: Invoice = {
        id: `demo_inv_${invoiceNo}`,
        number: `${settings.invoicePrefix}-${String(invoiceNo).padStart(4, "0")}`,
        date,
        customerId: customer?.id,
        customerName: customer?.name ?? "Walk-in Customer",
        customerPhone: customer?.phone ?? "",
        lines: bill.lines,
        subTotal: bill.subTotal,
        lineDiscount: bill.lineDiscount,
        billDiscount: 0,
        taxAmount: bill.taxAmount,
        pointsRedeemed: redeem,
        pointsValue: bill.pointsValue,
        roundOff: bill.roundOff,
        total: bill.total,
        paid: unpaid ? 0 : bill.total,
        due: unpaid ? bill.total : 0,
        paymentMode: unpaid ? "Credit" : paymentMode,
        status: unpaid ? "unpaid" : "paid",
        pointsEarned: customer ? bill.pointsEarned : 0,
        createdAt: date,
      };
      invoices.push(invoice);
      invoiceNo++;

      // Keep derived customer + stock figures consistent with the bills.
      for (const line of bill.lines) {
        const item = items.find((i) => i.id === line.itemId);
        if (item) item.stock = Math.max(0, item.stock - line.qty);
      }
      if (customer) {
        customer.visits += 1;
        customer.totalSpent += invoice.total;
        customer.lastVisit = date;
        customer.loyaltyPoints += invoice.pointsEarned - redeem;
        if (redeem > 0) {
          pointsLog.push({
            id: uid("p_"),
            customerId: customer.id,
            date,
            points: -redeem,
            reason: "redeem",
            note: `Used on ${invoice.number}`,
            invoiceId: invoice.id,
          });
        }
        if (invoice.pointsEarned > 0) {
          pointsLog.push({
            id: uid("p_"),
            customerId: customer.id,
            date,
            points: invoice.pointsEarned,
            reason: "purchase",
            note: `Bill ${invoice.number}`,
            invoiceId: invoice.id,
          });
        }
      }
    }
  }

  const EXPENSE_KINDS: [category: string, note: string, amount: number][] = [
    ["Stock purchase", "Wholesale restock", 8500],
    ["Rent", "Monthly shop rent", 12000],
    ["Electricity", "Electricity bill", 1850],
    ["Salary", "Helper salary", 7000],
    ["Transport", "Goods pickup", 450],
    ["Packaging", "Carry bags", 900],
  ];
  const expenses: Expense[] = [];
  for (let day = 28; day >= 0; day -= 4) {
    const [category, note, base] = EXPENSE_KINDS[day % EXPENSE_KINDS.length];
    expenses.push({
      id: `demo_e_${day}`,
      date: daysAgo(day),
      category,
      note,
      amount: Math.round(base * (0.8 + rand() * 0.4)),
      paymentMode: rand() < 0.5 ? "Cash" : "UPI",
      createdAt: daysAgo(day),
    });
  }

  const db: Database = {
    version: 1,
    settings: { ...settings, nextInvoiceNo: invoiceNo },
    customers,
    items,
    invoices: invoices.reverse(),
    expenses,
    pointsLog: pointsLog.sort((a, b) => b.date.localeCompare(a.date)),
  };
  replaceAll(db);
}
