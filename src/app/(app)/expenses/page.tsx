"use client";

import { useMemo, useState } from "react";
import { Plus, Receipt, Trash2, TrendingDown, Wallet } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Badge, Button, Card, CardHeader, EmptyState, Modal, Stat } from "@/components/ui";
import { clsx } from "@/lib/clsx";
import { deleteExpense, saveExpense } from "@/lib/db";
import { rupees, rupeesShort, shortDate } from "@/lib/format";
import { localDayKey, useDb, useMounted, useNow } from "@/lib/hooks";
import type { PaymentMode } from "@/lib/types";

const CATEGORIES = [
  "Stock purchase",
  "Rent",
  "Electricity",
  "Salary",
  "Transport",
  "Packaging",
  "Marketing",
  "Repairs",
  "Other",
];

const RANGES = [
  ["30", "This month"],
  ["90", "3 months"],
  ["365", "1 year"],
  ["3650", "All time"],
] as const;

export default function ExpensesPage() {
  const db = useDb();
  const mounted = useMounted();
  const now = useNow();
  const [days, setDays] = useState<string>("30");
  const [adding, setAdding] = useState(false);

  const data = useMemo(() => {
    const since = now - Number(days) * 86_400_000;
    const expenses = db.expenses
      .filter((e) => new Date(e.date).getTime() >= since)
      .sort((a, b) => b.date.localeCompare(a.date));

    const revenue = db.invoices
      .filter((i) => new Date(i.date).getTime() >= since)
      .reduce((s, i) => s + i.total, 0);

    const byCategory = new Map<string, number>();
    for (const e of expenses) {
      byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount);
    }

    const total = expenses.reduce((s, e) => s + e.amount, 0);
    return {
      expenses,
      total,
      revenue,
      net: revenue - total,
      byCategory: [...byCategory.entries()].sort((a, b) => b[1] - a[1]),
      todayTotal: db.expenses
        .filter((e) => localDayKey(e.date) === localDayKey(now))
        .reduce((s, e) => s + e.amount, 0),
    };
  }, [db, days, now]);

  if (!mounted) return <PageHeader title="Expenses" subtitle="Loading…" />;

  const catPeak = data.byCategory[0]?.[1] ?? 1;

  return (
    <>
      <PageHeader
        title="Expenses"
        subtitle="Track what goes out, so you know what you actually earned."
        action={
          <>
            <div className="hidden items-center gap-1 rounded-xl bg-ink-100 p-1 sm:flex">
              {RANGES.map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setDays(key)}
                  className={clsx(
                    "rounded-lg px-2.5 py-1.5 text-xs font-bold transition",
                    days === key
                      ? "bg-white text-brand-700 shadow-sm"
                      : "text-ink-500 hover:text-ink-800",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <Button onClick={() => setAdding(true)}>
              <Plus size={16} /> Add expense
            </Button>
          </>
        }
      />

      <div className="space-y-5 px-4 pb-10 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            label="Total spent"
            value={rupeesShort(data.total)}
            sub={`${data.expenses.length} entries`}
            icon={<TrendingDown size={15} />}
            tone="pink"
          />
          <Stat
            label="Sales"
            value={rupeesShort(data.revenue)}
            sub="same period"
            icon={<Receipt size={15} />}
          />
          <Stat
            label="Net in hand"
            value={rupeesShort(data.net)}
            sub={data.net >= 0 ? "sales minus expenses" : "spending more than earning"}
            icon={<Wallet size={15} />}
            tone={data.net >= 0 ? "green" : "amber"}
          />
          <Stat
            label="Spent today"
            value={rupeesShort(data.todayTotal)}
            sub="all categories"
            icon={<Wallet size={15} />}
            tone="amber"
          />
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_320px] lg:items-start">
          <Card>
            <CardHeader
              title="All expenses"
              subtitle={`${data.expenses.length} entries in this period`}
            />
            {data.expenses.length ? (
              <ul className="divide-y divide-ink-100">
                {data.expenses.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-ink-900">
                        {e.category}
                        <Badge tone="neutral">{e.paymentMode}</Badge>
                      </p>
                      <p className="truncate text-xs text-ink-500">
                        {shortDate(e.date)}
                        {e.note ? ` · ${e.note}` : ""}
                      </p>
                    </div>
                    <p className="tnum shrink-0 text-sm font-extrabold text-rose-600">
                      − {rupees(e.amount)}
                    </p>
                    <button
                      onClick={() => {
                        if (confirm(`Delete this ${rupees(e.amount)} expense?`))
                          deleteExpense(e.id);
                      }}
                      className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-400 hover:bg-rose-50 hover:text-rose-600"
                      aria-label="Delete expense"
                    >
                      <Trash2 size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<Wallet size={20} />}
                title="No expenses recorded"
                hint="Add rent, stock purchases, salary and electricity to see your real profit."
                action={
                  <Button size="sm" onClick={() => setAdding(true)}>
                    Add first expense
                  </Button>
                }
              />
            )}
          </Card>

          <Card>
            <CardHeader title="Where money went" />
            {data.byCategory.length ? (
              <div className="space-y-3 p-5">
                {data.byCategory.map(([cat, amount]) => (
                  <div key={cat}>
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="font-bold text-ink-700">{cat}</span>
                      <span className="tnum font-semibold text-ink-600">
                        {rupees(amount)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-ink-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600"
                        style={{ width: `${(amount / catPeak) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={<Wallet size={20} />} title="Nothing to show yet" />
            )}
          </Card>
        </div>
      </div>

      {adding ? <ExpenseModal onClose={() => setAdding(false)} /> : null}
    </>
  );
}

function ExpenseModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({
    category: CATEGORIES[0],
    amount: "",
    note: "",
    paymentMode: "Cash" as PaymentMode,
    date: new Date().toISOString().slice(0, 10),
  });
  const [error, setError] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0)
      return setError("Enter an amount greater than zero.");

    saveExpense({
      // Keep the time of day so same-day entries stay in order.
      date: new Date(`${form.date}T${new Date().toTimeString().slice(0, 8)}`).toISOString(),
      category: form.category,
      note: form.note.trim() || undefined,
      amount: Number(form.amount),
      paymentMode: form.paymentMode,
    });
    onClose();
  }

  return (
    <Modal open onClose={onClose} title="Add expense" subtitle="Money going out of the shop.">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Amount (₹) *</label>
          <input
            autoFocus
            type="number"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            className="field tnum text-lg font-bold"
            placeholder="0"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="field"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Paid by</label>
            <select
              value={form.paymentMode}
              onChange={(e) =>
                setForm({ ...form, paymentMode: e.target.value as PaymentMode })
              }
              className="field"
            >
              {(["Cash", "UPI", "Card", "Credit"] as PaymentMode[]).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Date</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="field"
            />
          </div>
          <div>
            <label className="label">Note</label>
            <input
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              className="field"
              placeholder="optional"
            />
          </div>
        </div>

        {error ? (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
            {error}
          </p>
        ) : null}

        <div className="flex gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" className="flex-1">
            Save expense
          </Button>
        </div>
      </form>
    </Modal>
  );
}
