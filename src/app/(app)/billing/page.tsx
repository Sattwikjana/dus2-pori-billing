"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Banknote,
  CreditCard,
  Gift,
  Minus,
  Plus,
  Smartphone,
  Trash2,
  Wallet,
} from "lucide-react";
import { CustomerPicker } from "@/components/CustomerPicker";
import { ItemPicker } from "@/components/ItemPicker";
import { PageHeader } from "@/components/PageHeader";
import { Badge, Button, Card, CardHeader } from "@/components/ui";
import { clsx } from "@/lib/clsx";
import { commitInvoice, uid } from "@/lib/db";
import { computeBill, maxRedeemablePoints, type DraftLine } from "@/lib/billing";
import { rupees } from "@/lib/format";
import { useDb, useMounted } from "@/lib/hooks";
import type { Customer, Item, PaymentMode } from "@/lib/types";

const PAYMENT_MODES: { mode: PaymentMode; icon: typeof Banknote }[] = [
  { mode: "Cash", icon: Banknote },
  { mode: "UPI", icon: Smartphone },
  { mode: "Card", icon: CreditCard },
  { mode: "Credit", icon: Wallet },
];

export default function BillingPage() {
  const db = useDb();
  const mounted = useMounted();
  const router = useRouter();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [billDiscount, setBillDiscount] = useState(0);
  const [pointsRedeemed, setPointsRedeemed] = useState(0);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("Cash");
  const [paidInput, setPaidInput] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const s = db.settings;

  const bill = useMemo(
    () =>
      computeBill({
        lines,
        gstEnabled: s.gstEnabled,
        billDiscount,
        pointsRedeemed,
        loyalty: s.loyalty,
        roundOffEnabled: s.roundOffEnabled,
      }),
    [lines, s.gstEnabled, billDiscount, pointsRedeemed, s.loyalty, s.roundOffEnabled],
  );

  const beforePoints = bill.total + bill.pointsValue;
  const redeemCap = customer
    ? maxRedeemablePoints(customer.loyaltyPoints, beforePoints, s.loyalty)
    : 0;

  function addItem(item: Item) {
    setLines((prev) => {
      const at = prev.findIndex((l) => l.itemId === item.id);
      if (at >= 0) {
        const next = [...prev];
        next[at] = { ...next[at], qty: next[at].qty + 1 };
        return next;
      }
      return [
        ...prev,
        {
          id: uid("l_"),
          itemId: item.id,
          name: item.name,
          unit: item.unit,
          qty: 1,
          price: item.sellPrice,
          discountPct: 0,
          taxRate: item.taxRate,
        },
      ];
    });
  }

  function addCustomLine(name: string) {
    setLines((prev) => [
      ...prev,
      {
        id: uid("l_"),
        name,
        unit: "pcs",
        qty: 1,
        price: 0,
        discountPct: 0,
        taxRate: s.defaultTaxRate,
      },
    ]);
  }

  function patchLine(id: string, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function removeLine(id: string) {
    setLines((prev) => prev.filter((l) => l.id !== id));
  }

  function reset() {
    setCustomer(null);
    setLines([]);
    setBillDiscount(0);
    setPointsRedeemed(0);
    setPaidInput("");
    setNotes("");
    setPaymentMode("Cash");
    setError("");
  }

  function save(andPrint: boolean) {
    if (!lines.length) return setError("Add at least one product to the bill.");
    if (lines.some((l) => l.qty <= 0)) return setError("Quantity must be more than 0.");

    const paid =
      paidInput.trim() === ""
        ? paymentMode === "Credit"
          ? 0
          : bill.total
        : Number(paidInput) || 0;
    const due = Math.max(0, bill.total - paid);

    const invoice = commitInvoice({
      date: new Date().toISOString(),
      customerId: customer?.id,
      customerName: customer?.name ?? "Walk-in Customer",
      customerPhone: customer?.phone ?? "",
      lines: bill.lines,
      subTotal: bill.subTotal,
      lineDiscount: bill.lineDiscount,
      billDiscount: bill.billDiscount,
      taxAmount: bill.taxAmount,
      pointsRedeemed: customer ? pointsRedeemed : 0,
      pointsValue: customer ? bill.pointsValue : 0,
      roundOff: bill.roundOff,
      total: bill.total,
      paid,
      due,
      paymentMode,
      status: due <= 0 ? "paid" : paid > 0 ? "partial" : "unpaid",
      pointsEarned: customer ? bill.pointsEarned : 0,
      notes: notes.trim() || undefined,
    });

    reset();
    router.push(`/invoices/${invoice.id}${andPrint ? "?print=1" : ""}`);
  }

  if (!mounted) return <PageHeader title="New Bill" subtitle="Loading…" />;

  return (
    <>
      <PageHeader
        title="New Bill"
        subtitle="Find the customer, add products, done."
        action={
          lines.length ? (
            <Button variant="ghost" size="sm" onClick={reset}>
              Clear bill
            </Button>
          ) : null
        }
      />

      <div className="grid gap-5 px-4 pb-8 sm:px-6 lg:grid-cols-[1fr_360px] lg:items-start">
        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Customer"
              subtitle="Type 4–5 digits of their mobile — old customers show up instantly."
            />
            <div className="p-4">
              <CustomerPicker selected={customer} onSelect={setCustomer} />
              {!customer ? (
                <p className="mt-2 text-xs text-ink-500">
                  Leave blank to bill a walk-in customer.
                </p>
              ) : null}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Products"
              subtitle={`${lines.length} item${lines.length === 1 ? "" : "s"} in this bill`}
            />
            <div className="p-4">
              <ItemPicker onPick={addItem} onFreeText={addCustomLine} />

              {lines.length ? (
                <ul className="mt-4 space-y-2">
                  {lines.map((line) => {
                    const computed = bill.lines.find((l) => l.id === line.id)!;
                    const stockItem = db.items.find((i) => i.id === line.itemId);
                    const overStock = stockItem && line.qty > stockItem.stock;
                    return (
                      <li
                        key={line.id}
                        className="rounded-2xl border border-ink-200 bg-white p-3"
                      >
                        <div className="flex items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <input
                              value={line.name}
                              onChange={(e) =>
                                patchLine(line.id, { name: e.target.value })
                              }
                              className="w-full truncate border-none bg-transparent p-0 text-sm font-bold text-ink-900 outline-none"
                            />
                            {overStock ? (
                              <Badge tone="amber" className="mt-1">
                                Only {stockItem!.stock} in stock
                              </Badge>
                            ) : null}
                          </div>
                          <div className="tnum shrink-0 text-right">
                            <p className="text-sm font-extrabold text-ink-900">
                              {rupees(computed.amount)}
                            </p>
                          </div>
                          <button
                            onClick={() => removeLine(line.id)}
                            className="grid size-7 shrink-0 place-items-center rounded-lg text-ink-400 hover:bg-rose-50 hover:text-rose-600"
                            aria-label="Remove item"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <div className="col-span-2 sm:col-span-1">
                            <label className="label">Qty</label>
                            <div className="flex h-10 items-center rounded-xl border border-ink-200 bg-white">
                              <button
                                onClick={() =>
                                  patchLine(line.id, {
                                    qty: Math.max(1, line.qty - 1),
                                  })
                                }
                                className="grid h-full w-9 place-items-center text-ink-500 hover:text-brand-600"
                                aria-label="Decrease"
                              >
                                <Minus size={14} />
                              </button>
                              <input
                                type="number"
                                value={line.qty}
                                onChange={(e) =>
                                  patchLine(line.id, {
                                    qty: Math.max(0, Number(e.target.value)),
                                  })
                                }
                                className="tnum h-full w-full min-w-0 border-none bg-transparent text-center text-sm font-bold outline-none"
                              />
                              <button
                                onClick={() => patchLine(line.id, { qty: line.qty + 1 })}
                                className="grid h-full w-9 place-items-center text-ink-500 hover:text-brand-600"
                                aria-label="Increase"
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="label">Rate (₹)</label>
                            <input
                              type="number"
                              value={line.price}
                              onChange={(e) =>
                                patchLine(line.id, { price: Number(e.target.value) })
                              }
                              className="field tnum h-10 py-0"
                            />
                          </div>
                          <div>
                            <label className="label">Disc %</label>
                            <input
                              type="number"
                              value={line.discountPct}
                              onChange={(e) =>
                                patchLine(line.id, {
                                  discountPct: Math.min(
                                    100,
                                    Math.max(0, Number(e.target.value)),
                                  ),
                                })
                              }
                              className="field tnum h-10 py-0"
                            />
                          </div>
                          {s.gstEnabled ? (
                            <div>
                              <label className="label">GST %</label>
                              <input
                                type="number"
                                value={line.taxRate}
                                onChange={(e) =>
                                  patchLine(line.id, { taxRate: Number(e.target.value) })
                                }
                                className="field tnum h-10 py-0"
                              />
                            </div>
                          ) : (
                            <div className="hidden sm:block" />
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-ink-300 px-6 py-10 text-center">
                  <p className="text-sm font-semibold text-ink-700">
                    No products added yet
                  </p>
                  <p className="mt-1 text-xs text-ink-500">
                    Search above to add from your catalogue.
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Summary rail */}
        <Card className="lg:sticky lg:top-6">
          <CardHeader title="Bill summary" />
          <div className="space-y-3 p-4">
            <Row label="Sub total" value={rupees(bill.subTotal)} />
            {bill.lineDiscount > 0 ? (
              <Row
                label="Item discount"
                value={`− ${rupees(bill.lineDiscount)}`}
                tone="green"
              />
            ) : null}
            {s.gstEnabled ? (
              <Row label="GST" value={rupees(bill.taxAmount)} />
            ) : null}

            <div className="flex items-center justify-between gap-3">
              <label className="text-sm text-ink-600">Extra discount</label>
              <div className="relative w-28">
                <span className="absolute top-1/2 left-3 -translate-y-1/2 text-xs text-ink-400">
                  ₹
                </span>
                <input
                  type="number"
                  value={billDiscount || ""}
                  onChange={(e) =>
                    setBillDiscount(Math.max(0, Number(e.target.value)))
                  }
                  placeholder="0"
                  className="field tnum h-9 py-0 pl-6 text-right"
                />
              </div>
            </div>

            {customer && s.loyalty.enabled ? (
              <div className="rounded-2xl bg-gold-100/70 p-3 ring-1 ring-gold-200/70">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-gold-600">
                    <Gift size={14} /> Loyalty points
                  </span>
                  <span className="tnum text-xs font-bold text-gold-600">
                    {customer.loyaltyPoints} available
                  </span>
                </div>
                {redeemCap > 0 ? (
                  <>
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={redeemCap}
                        value={Math.min(pointsRedeemed, redeemCap)}
                        onChange={(e) => setPointsRedeemed(Number(e.target.value))}
                        className="h-1.5 flex-1 accent-brand-600"
                      />
                      <button
                        onClick={() =>
                          setPointsRedeemed(pointsRedeemed === redeemCap ? 0 : redeemCap)
                        }
                        className="rounded-lg bg-gold-500 px-2 py-1 text-[11px] font-bold text-white"
                      >
                        {pointsRedeemed === redeemCap ? "Clear" : "Use max"}
                      </button>
                    </div>
                    <p className="tnum mt-1.5 text-[11px] font-semibold text-gold-600">
                      Using {pointsRedeemed} points = {rupees(bill.pointsValue)} off
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-[11px] text-gold-600">
                    {customer.loyaltyPoints < s.loyalty.minRedeem
                      ? `Needs at least ${s.loyalty.minRedeem} points to redeem — ${
                          s.loyalty.minRedeem - customer.loyaltyPoints
                        } more to go.`
                      : "Add products to the bill to use these points."}
                  </p>
                )}
              </div>
            ) : null}

            {bill.pointsValue > 0 ? (
              <Row
                label="Points redeemed"
                value={`− ${rupees(bill.pointsValue)}`}
                tone="green"
              />
            ) : null}
            {bill.roundOff !== 0 ? (
              <Row label="Round off" value={rupees(bill.roundOff)} />
            ) : null}

            <div className="flex items-end justify-between border-t border-dashed border-ink-200 pt-3">
              <span className="text-sm font-bold text-ink-900">Total payable</span>
              <span className="tnum text-2xl font-extrabold text-brand-700">
                {rupees(bill.total)}
              </span>
            </div>

            {customer && s.loyalty.enabled && bill.pointsEarned > 0 ? (
              <p className="rounded-xl bg-brand-50 px-3 py-2 text-[11px] font-semibold text-brand-700">
                {customer.name.split(" ")[0]} will earn{" "}
                <strong>{bill.pointsEarned} points</strong> on this bill.
              </p>
            ) : null}

            <div>
              <label className="label">Payment mode</label>
              <div className="grid grid-cols-4 gap-1.5">
                {PAYMENT_MODES.map(({ mode, icon: Icon }) => (
                  <button
                    key={mode}
                    onClick={() => {
                      setPaymentMode(mode);
                      setPaidInput(mode === "Credit" ? "0" : "");
                    }}
                    className={clsx(
                      "flex flex-col items-center gap-1 rounded-xl border px-1 py-2 text-[11px] font-bold transition",
                      paymentMode === mode
                        ? "border-brand-500 bg-brand-50 text-brand-700"
                        : "border-ink-200 text-ink-500 hover:border-ink-300",
                    )}
                  >
                    <Icon size={15} />
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Amount received</label>
              <input
                type="number"
                value={paidInput}
                onChange={(e) => setPaidInput(e.target.value)}
                placeholder={rupees(bill.total, false)}
                className="field tnum text-right font-bold"
              />
              {paidInput !== "" && Number(paidInput) > bill.total ? (
                <p className="tnum mt-1.5 text-xs font-bold text-emerald-600">
                  Return change: {rupees(Number(paidInput) - bill.total)}
                </p>
              ) : null}
              {paidInput !== "" && Number(paidInput) < bill.total ? (
                <p className="tnum mt-1.5 text-xs font-bold text-rose-600">
                  Balance due: {rupees(bill.total - Number(paidInput))}
                </p>
              ) : null}
            </div>

            <div>
              <label className="label">Note (optional)</label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="field"
                placeholder="e.g. exchange within 7 days"
              />
            </div>

            {error ? (
              <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                {error}
              </p>
            ) : null}

            <div className="grid gap-2 pt-1">
              <Button size="lg" onClick={() => save(true)} disabled={!lines.length}>
                Save &amp; Print — {rupees(bill.total)}
              </Button>
              <Button
                variant="secondary"
                onClick={() => save(false)}
                disabled={!lines.length}
              >
                Save bill only
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "green";
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-ink-600">{label}</span>
      <span
        className={clsx(
          "tnum font-semibold",
          tone === "green" ? "text-emerald-600" : "text-ink-900",
        )}
      >
        {value}
      </span>
    </div>
  );
}
