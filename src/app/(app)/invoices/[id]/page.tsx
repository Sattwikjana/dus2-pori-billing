"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Download,
  Loader2,
  MessageCircle,
  Printer,
  Share2,
  Trash2,
} from "lucide-react";
import { BrandLogo } from "@/components/Brand";
import { Badge, Button } from "@/components/ui";
import { amountInWords } from "@/lib/billing";
import { deleteInvoice, recordPayment } from "@/lib/db";
import { downloadInvoicePdf, invoicePdfFile } from "@/lib/invoicePdf";
import { dateTime, prettyPhone, rupees } from "@/lib/format";
import { useDb, useMounted } from "@/lib/hooks";

export default function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const db = useDb();
  const mounted = useMounted();
  const router = useRouter();
  const search = useSearchParams();
  const printedRef = useRef(false);
  const [pdfBusy, setPdfBusy] = useState<"download" | "share" | null>(null);

  const invoice = db.invoices.find((i) => i.id === id);
  const s = db.settings;

  // Auto-open the print dialog when arriving straight from "Save & Print".
  useEffect(() => {
    if (mounted && invoice && search.get("print") === "1" && !printedRef.current) {
      printedRef.current = true;
      const t = setTimeout(() => window.print(), 350);
      return () => clearTimeout(t);
    }
  }, [mounted, invoice, search]);

  if (!mounted) return <div className="p-6 text-sm text-ink-500">Loading…</div>;

  if (!invoice) {
    return (
      <div className="p-6">
        <p className="text-sm font-semibold text-ink-800">Invoice not found.</p>
        <Link href="/invoices" className="mt-2 inline-block text-sm text-brand-600">
          ← Back to invoices
        </Link>
      </div>
    );
  }

  // Android/iOS can hand the PDF straight to WhatsApp via the share sheet.
  const canShareFiles =
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({
      files: [new File([""], "x.pdf", { type: "application/pdf" })],
    });

  const waText = encodeURIComponent(
    [
      `*${s.shopName}*`,
      `Bill: ${invoice.number}`,
      `Date: ${dateTime(invoice.date)}`,
      "",
      ...invoice.lines.map(
        (l) => `${l.name} × ${l.qty} = ${rupees(l.amount)}`,
      ),
      "",
      `*Total: ${rupees(invoice.total)}*`,
      invoice.due > 0 ? `Due: ${rupees(invoice.due)}` : "Paid in full ✅",
      invoice.pointsEarned
        ? `Loyalty points earned: ${invoice.pointsEarned}`
        : "",
      "",
      s.footerNote,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  return (
    <>
      <div className="no-print flex flex-wrap items-center gap-2 px-4 pt-6 pb-4 sm:px-6">
        <Link
          href="/invoices"
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3 text-sm font-semibold text-ink-600 hover:bg-ink-50"
        >
          <ArrowLeft size={15} /> Back
        </Link>
        <div className="ml-auto flex flex-wrap gap-2">
          {invoice.customerPhone ? (
            <a
              href={`https://wa.me/91${invoice.customerPhone}?text=${waText}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white transition hover:bg-emerald-700"
            >
              <MessageCircle size={16} /> WhatsApp
            </a>
          ) : null}
          {canShareFiles ? (
            <Button
              variant="secondary"
              disabled={pdfBusy !== null}
              onClick={async () => {
                setPdfBusy("share");
                try {
                  const file = await invoicePdfFile(invoice, s);
                  await navigator.share({
                    files: [file],
                    title: invoice.number,
                    text: `${s.shopName} — bill ${invoice.number}`,
                  });
                } catch {
                  // The share sheet was dismissed; nothing to report.
                } finally {
                  setPdfBusy(null);
                }
              }}
            >
              {pdfBusy === "share" ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Share2 size={16} />
              )}{" "}
              Share PDF
            </Button>
          ) : null}
          {invoice.due > 0 ? (
            <Button
              variant="secondary"
              onClick={() => recordPayment(invoice.id, invoice.due)}
            >
              Mark as paid
            </Button>
          ) : null}
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer size={16} /> Print
          </Button>
          <Button
            disabled={pdfBusy !== null}
            onClick={async () => {
              setPdfBusy("download");
              try {
                await downloadInvoicePdf(invoice, s);
              } finally {
                setPdfBusy(null);
              }
            }}
          >
            {pdfBusy === "download" ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Download size={16} />
            )}{" "}
            Download PDF
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              if (
                confirm(
                  `Delete bill ${invoice.number}? Stock and loyalty points will be restored.`,
                )
              ) {
                deleteInvoice(invoice.id);
                router.push("/invoices");
              }
            }}
            aria-label="Delete invoice"
          >
            <Trash2 size={16} />
          </Button>
        </div>
      </div>

      <div className="px-4 pb-10 sm:px-6">
        <div className="print-area mx-auto max-w-3xl rounded-3xl border border-ink-200 bg-white p-6 shadow-card sm:p-10">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-ink-200 pb-6">
            <div>
              <BrandLogo width={168} className="h-auto w-[168px]" />
              <p className="mt-2 text-xs font-semibold tracking-wide text-ink-500">
                {s.tagline}
              </p>
              <div className="mt-3 space-y-0.5 text-xs text-ink-600">
                {s.address ? <p>{s.address}</p> : null}
                {s.phone ? <p className="tnum">Phone: {s.phone}</p> : null}
                {s.gstin ? <p className="tnum">GSTIN: {s.gstin}</p> : null}
              </div>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-bold tracking-widest text-ink-400 uppercase">
                {s.gstEnabled ? "Tax Invoice" : "Invoice"}
              </p>
              <p className="tnum mt-1 text-lg font-extrabold text-brand-700">
                {invoice.number}
              </p>
              <p className="tnum mt-1 text-xs text-ink-500">
                {dateTime(invoice.date)}
              </p>
              <div className="mt-2 flex justify-end">
                <Badge
                  tone={
                    invoice.status === "paid"
                      ? "green"
                      : invoice.status === "partial"
                        ? "amber"
                        : "red"
                  }
                >
                  {invoice.status === "paid"
                    ? "PAID"
                    : invoice.status === "partial"
                      ? "PARTIALLY PAID"
                      : "UNPAID"}
                </Badge>
              </div>
            </div>
          </div>

          {/* Bill to */}
          <div className="flex flex-wrap justify-between gap-4 py-5">
            <div>
              <p className="text-[11px] font-bold tracking-wider text-ink-400 uppercase">
                Billed to
              </p>
              <p className="mt-1 text-sm font-bold text-ink-900">
                {invoice.customerName}
              </p>
              {invoice.customerPhone ? (
                <p className="tnum text-xs text-ink-600">
                  {prettyPhone(invoice.customerPhone)}
                </p>
              ) : null}
            </div>
            <div className="text-right">
              <p className="text-[11px] font-bold tracking-wider text-ink-400 uppercase">
                Payment mode
              </p>
              <p className="mt-1 text-sm font-bold text-ink-900">
                {invoice.paymentMode}
              </p>
            </div>
          </div>

          {/* Lines */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="bg-ink-100 text-[11px] font-bold tracking-wider text-ink-600 uppercase">
                  <th className="rounded-l-lg px-3 py-2.5 text-left">#</th>
                  <th className="px-3 py-2.5 text-left">Item</th>
                  <th className="px-3 py-2.5 text-right">Qty</th>
                  <th className="px-3 py-2.5 text-right">Rate</th>
                  {invoice.lines.some((l) => l.discountPct > 0) ? (
                    <th className="px-3 py-2.5 text-right">Disc</th>
                  ) : null}
                  {s.gstEnabled ? (
                    <th className="px-3 py-2.5 text-right">GST</th>
                  ) : null}
                  <th className="rounded-r-lg px-3 py-2.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {invoice.lines.map((l, i) => (
                  <tr key={l.id}>
                    <td className="tnum px-3 py-3 text-ink-400">{i + 1}</td>
                    <td className="px-3 py-3 font-semibold text-ink-900">{l.name}</td>
                    <td className="tnum px-3 py-3 text-right text-ink-700">
                      {l.qty} {l.unit}
                    </td>
                    <td className="tnum px-3 py-3 text-right text-ink-700">
                      {rupees(l.price, false)}
                    </td>
                    {invoice.lines.some((x) => x.discountPct > 0) ? (
                      <td className="tnum px-3 py-3 text-right text-emerald-600">
                        {l.discountPct ? `${l.discountPct}%` : "—"}
                      </td>
                    ) : null}
                    {s.gstEnabled ? (
                      <td className="tnum px-3 py-3 text-right text-ink-700">
                        {rupees(l.taxAmount, false)}
                      </td>
                    ) : null}
                    <td className="tnum px-3 py-3 text-right font-bold text-ink-900">
                      {rupees(l.amount, false)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="mt-6 flex flex-wrap justify-between gap-6">
            <div className="min-w-[200px] flex-1 space-y-3">
              <div>
                <p className="text-[11px] font-bold tracking-wider text-ink-400 uppercase">
                  Amount in words
                </p>
                <p className="mt-0.5 text-xs font-semibold text-ink-700">
                  {amountInWords(invoice.total)}
                </p>
              </div>
              {invoice.notes ? (
                <div>
                  <p className="text-[11px] font-bold tracking-wider text-ink-400 uppercase">
                    Note
                  </p>
                  <p className="mt-0.5 text-xs text-ink-600">{invoice.notes}</p>
                </div>
              ) : null}
              {s.upiId ? (
                <div>
                  <p className="text-[11px] font-bold tracking-wider text-ink-400 uppercase">
                    Pay via UPI
                  </p>
                  <p className="tnum mt-0.5 text-xs font-semibold text-ink-700">
                    {s.upiId}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="w-full max-w-xs space-y-1.5 text-sm sm:w-64">
              <TotalRow label="Sub total" value={rupees(invoice.subTotal)} />
              {invoice.lineDiscount > 0 ? (
                <TotalRow
                  label="Item discount"
                  value={`− ${rupees(invoice.lineDiscount)}`}
                  green
                />
              ) : null}
              {s.gstEnabled && invoice.taxAmount > 0 ? (
                <TotalRow label="GST" value={rupees(invoice.taxAmount)} />
              ) : null}
              {invoice.billDiscount > 0 ? (
                <TotalRow
                  label="Discount"
                  value={`− ${rupees(invoice.billDiscount)}`}
                  green
                />
              ) : null}
              {invoice.pointsValue > 0 ? (
                <TotalRow
                  label={`Points used (${invoice.pointsRedeemed})`}
                  value={`− ${rupees(invoice.pointsValue)}`}
                  green
                />
              ) : null}
              {invoice.roundOff !== 0 ? (
                <TotalRow label="Round off" value={rupees(invoice.roundOff)} />
              ) : null}

              <div className="mt-2 flex items-center justify-between rounded-xl bg-brand-600 px-3 py-2.5 text-white">
                <span className="text-sm font-bold">Total</span>
                <span className="tnum text-lg font-extrabold">
                  {rupees(invoice.total)}
                </span>
              </div>
              <TotalRow label="Paid" value={rupees(invoice.paid)} />
              {invoice.due > 0 ? (
                <TotalRow label="Balance due" value={rupees(invoice.due)} red />
              ) : null}
            </div>
          </div>

          {/* Loyalty strip */}
          {invoice.pointsEarned > 0 || invoice.pointsRedeemed > 0 ? (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-gold-100/70 px-4 py-3 ring-1 ring-gold-200/70">
              <p className="text-xs font-bold text-gold-600">
                🎁 Loyalty summary for {invoice.customerName}
              </p>
              <p className="tnum text-xs font-semibold text-gold-600">
                {invoice.pointsRedeemed > 0
                  ? `${invoice.pointsRedeemed} used · `
                  : ""}
                {invoice.pointsEarned} points earned
              </p>
            </div>
          ) : null}

          <div className="mt-8 border-t border-ink-200 pt-4 text-center">
            <p className="text-xs font-semibold text-ink-600">{s.footerNote}</p>
            <p className="mt-1 text-[10px] text-ink-400">
              This is a computer-generated invoice.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

function TotalRow({
  label,
  value,
  green,
  red,
}: {
  label: string;
  value: string;
  green?: boolean;
  red?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-600">{label}</span>
      <span
        className={`tnum font-semibold ${
          green ? "text-emerald-600" : red ? "text-rose-600" : "text-ink-900"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
