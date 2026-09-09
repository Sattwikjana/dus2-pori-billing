"use client";

import { jsPDF } from "jspdf";
import { amountInWords } from "./billing";
import type { Invoice, Settings } from "./types";

// A4 in millimetres.
const PAGE_W = 210;
const MARGIN = 14;
const CONTENT_W = PAGE_W - MARGIN * 2;

const PINK: [number, number, number] = [242, 39, 138];
const PLUM: [number, number, number] = [42, 14, 33];
const INK: [number, number, number] = [27, 22, 26];
const MUTED: [number, number, number] = [124, 111, 122];
const LINE: [number, number, number] = [233, 226, 232];
const GREEN: [number, number, number] = [5, 150, 105];

/**
 * jsPDF's built-in fonts are Latin-1 only, so anything outside that range
 * (emoji in the footer note, `₹`) would render as mojibake. Strip it.
 */
const latin = (s: string) =>
  (s ?? "")
    .replace(/\u20B9/g, "Rs.")
    .replace(/[^\u0000-\u00FF]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

const money = (n: number) =>
  `Rs. ${new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n || 0)}`;

async function loadLogo(): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const res = await fetch("/logo-print.jpg");
    if (!res.ok) return null;
    const blob = await res.blob();
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const size = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new window.Image();
      img.onload = () => resolve({ w: img.width, h: img.height });
      img.onerror = () => resolve({ w: 560, h: 446 });
      img.src = data;
    });
    return { data, ...size };
  } catch {
    return null;
  }
}

/** Builds the invoice as a real (vector, selectable-text) A4 PDF. */
export async function buildInvoicePdf(invoice: Invoice, settings: Settings) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const logo = await loadLogo();
  let y = MARGIN;

  // ── Header ──────────────────────────────────────────────────────────
  if (logo) {
    const w = 46;
    doc.addImage(logo.data, "JPEG", MARGIN, y, w, (w * logo.h) / logo.w, undefined, "FAST");
  } else {
    doc.setFont("helvetica", "bold").setFontSize(20).setTextColor(...PINK);
    doc.text(latin(settings.shopName), MARGIN, y + 8);
  }

  doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...MUTED);
  doc.text((settings.gstEnabled ? "TAX INVOICE" : "INVOICE").toUpperCase(),
    PAGE_W - MARGIN, y + 4, { align: "right" });
  doc.setFont("helvetica", "bold").setFontSize(16).setTextColor(...PINK);
  doc.text(latin(invoice.number), PAGE_W - MARGIN, y + 12, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...MUTED);
  doc.text(
    new Date(invoice.date).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    PAGE_W - MARGIN,
    y + 18,
    { align: "right" },
  );

  const statusLabel =
    invoice.status === "paid"
      ? "PAID"
      : invoice.status === "partial"
        ? "PARTIALLY PAID"
        : "UNPAID";
  const statusColor: [number, number, number] =
    invoice.status === "paid" ? GREEN : invoice.status === "partial" ? [180, 130, 20] : [200, 40, 60];
  doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...statusColor);
  doc.text(statusLabel, PAGE_W - MARGIN, y + 24, { align: "right" });

  y += logo ? (46 * logo.h) / logo.w + 3 : 16;

  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...MUTED);
  for (const line of [
    settings.tagline,
    settings.address,
    settings.phone ? `Phone: ${settings.phone}` : "",
    settings.gstin ? `GSTIN: ${settings.gstin}` : "",
  ].filter(Boolean)) {
    doc.text(latin(line), MARGIN, y);
    y += 4;
  }

  y += 4;
  doc.setDrawColor(...LINE).setLineWidth(0.3).line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 7;

  // ── Bill to ─────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(...MUTED);
  doc.text("BILLED TO", MARGIN, y);
  doc.text("PAYMENT MODE", PAGE_W - MARGIN, y, { align: "right" });
  y += 5;
  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...INK);
  doc.text(latin(invoice.customerName), MARGIN, y);
  doc.text(latin(invoice.paymentMode), PAGE_W - MARGIN, y, { align: "right" });
  if (invoice.customerPhone) {
    y += 4.5;
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...MUTED);
    doc.text(latin(invoice.customerPhone), MARGIN, y);
  }
  y += 8;

  // ── Line items ──────────────────────────────────────────────────────
  const hasDiscount = invoice.lines.some((l) => l.discountPct > 0);
  const showTax = settings.gstEnabled && invoice.taxAmount > 0;

  const cols: { label: string; x: number; align: "left" | "right" }[] = [
    { label: "#", x: MARGIN + 2, align: "left" },
    { label: "ITEM", x: MARGIN + 9, align: "left" },
    { label: "QTY", x: MARGIN + 108, align: "right" },
    { label: "RATE", x: MARGIN + 133, align: "right" },
  ];
  if (hasDiscount) cols.push({ label: "DISC", x: MARGIN + 152, align: "right" });
  if (showTax) cols.push({ label: "GST", x: MARGIN + 166, align: "right" });
  cols.push({ label: "AMOUNT", x: PAGE_W - MARGIN - 2, align: "right" });

  doc.setFillColor(250, 244, 248);
  doc.roundedRect(MARGIN, y - 4.5, CONTENT_W, 8, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(...MUTED);
  for (const c of cols) doc.text(c.label, c.x, y, { align: c.align });
  y += 7;

  doc.setFontSize(9);
  invoice.lines.forEach((line, i) => {
    if (y > 250) {
      doc.addPage();
      y = MARGIN + 6;
    }
    doc.setFont("helvetica", "normal").setTextColor(...MUTED);
    doc.text(String(i + 1), MARGIN + 2, y);

    doc.setFont("helvetica", "bold").setTextColor(...INK);
    const name = doc.splitTextToSize(latin(line.name), 92)[0] as string;
    doc.text(name, MARGIN + 9, y);

    doc.setFont("helvetica", "normal").setTextColor(...INK);
    doc.text(latin(`${line.qty} ${line.unit}`), MARGIN + 108, y, { align: "right" });
    doc.text(line.price.toFixed(2), MARGIN + 133, y, { align: "right" });
    if (hasDiscount) {
      doc.text(line.discountPct ? `${line.discountPct}%` : "-", MARGIN + 152, y, {
        align: "right",
      });
    }
    if (showTax) {
      doc.text(line.taxAmount.toFixed(2), MARGIN + 166, y, { align: "right" });
    }
    doc.setFont("helvetica", "bold");
    doc.text(line.amount.toFixed(2), PAGE_W - MARGIN - 2, y, { align: "right" });

    y += 4;
    doc.setDrawColor(...LINE).setLineWidth(0.15).line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 5;
  });

  // ── Totals ──────────────────────────────────────────────────────────
  const boxX = PAGE_W - MARGIN - 72;
  let ty = y + 3;

  const row = (label: string, value: string, color = INK) => {
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...MUTED);
    doc.text(latin(label), boxX, ty);
    doc.setFont("helvetica", "bold").setTextColor(...color);
    doc.text(value, PAGE_W - MARGIN, ty, { align: "right" });
    ty += 5.5;
  };

  row("Sub total", money(invoice.subTotal));
  if (invoice.lineDiscount > 0)
    row("Item discount", `- ${money(invoice.lineDiscount)}`, GREEN);
  if (showTax) row("GST", money(invoice.taxAmount));
  if (invoice.billDiscount > 0)
    row("Discount", `- ${money(invoice.billDiscount)}`, GREEN);
  if (invoice.pointsValue > 0)
    row(`Points used (${invoice.pointsRedeemed})`, `- ${money(invoice.pointsValue)}`, GREEN);
  if (invoice.roundOff !== 0) row("Round off", money(invoice.roundOff));

  ty += 1;
  doc.setFillColor(...PINK);
  doc.roundedRect(boxX - 4, ty - 5, PAGE_W - MARGIN - boxX + 4, 11, 2, 2, "F");
  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(255, 255, 255);
  doc.text("TOTAL", boxX, ty + 1.5);
  doc.text(money(invoice.total), PAGE_W - MARGIN - 3, ty + 1.5, { align: "right" });
  ty += 11;

  row("Paid", money(invoice.paid));
  if (invoice.due > 0) row("Balance due", money(invoice.due), [200, 40, 60]);

  // ── Left column: words, note, UPI ───────────────────────────────────
  let ly = y + 3;
  doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(...MUTED);
  doc.text("AMOUNT IN WORDS", MARGIN, ly);
  ly += 4.5;
  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...INK);
  for (const l of doc.splitTextToSize(amountInWords(invoice.total), 95) as string[]) {
    doc.text(l, MARGIN, ly);
    ly += 4;
  }
  if (invoice.notes) {
    ly += 2;
    doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(...MUTED);
    doc.text("NOTE", MARGIN, ly);
    ly += 4.5;
    doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...INK);
    for (const l of doc.splitTextToSize(latin(invoice.notes), 95) as string[]) {
      doc.text(l, MARGIN, ly);
      ly += 4;
    }
  }
  if (settings.upiId) {
    ly += 2;
    doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(...MUTED);
    doc.text("PAY VIA UPI", MARGIN, ly);
    ly += 4.5;
    doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...INK);
    doc.text(latin(settings.upiId), MARGIN, ly);
    ly += 4;
  }

  // ── Loyalty + footer ────────────────────────────────────────────────
  let fy = Math.max(ty, ly) + 6;
  if (invoice.pointsEarned > 0 || invoice.pointsRedeemed > 0) {
    doc.setFillColor(249, 239, 214);
    doc.roundedRect(MARGIN, fy - 4.5, CONTENT_W, 9, 2, 2, "F");
    doc.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(168, 134, 28);
    doc.text(latin(`Loyalty summary for ${invoice.customerName}`), MARGIN + 4, fy + 1);
    doc.text(
      `${invoice.pointsRedeemed > 0 ? `${invoice.pointsRedeemed} used  |  ` : ""}${invoice.pointsEarned} points earned`,
      PAGE_W - MARGIN - 4,
      fy + 1,
      { align: "right" },
    );
    fy += 13;
  }

  doc.setDrawColor(...LINE).setLineWidth(0.3).line(MARGIN, fy, PAGE_W - MARGIN, fy);
  fy += 6;
  doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...PLUM);
  doc.text(latin(settings.footerNote), PAGE_W / 2, fy, { align: "center" });
  doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(...MUTED);
  doc.text("This is a computer-generated invoice.", PAGE_W / 2, fy + 4.5, {
    align: "center",
  });

  return doc;
}

export async function downloadInvoicePdf(invoice: Invoice, settings: Settings) {
  const doc = await buildInvoicePdf(invoice, settings);
  doc.save(
    `${invoice.number}-${invoice.customerName.replace(/[^\w]+/g, "-")}.pdf`,
  );
}

/** Returns the PDF as a File, ready to hand to the Web Share sheet. */
export async function invoicePdfFile(invoice: Invoice, settings: Settings) {
  const doc = await buildInvoicePdf(invoice, settings);
  return new File([doc.output("blob")], `${invoice.number}.pdf`, {
    type: "application/pdf",
  });
}
