"use client";

import { useMemo, useState } from "react";
import { BarChart3, Download, IndianRupee, Package, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button, Card, CardHeader, EmptyState, Stat } from "@/components/ui";
import { clsx } from "@/lib/clsx";
import { rupees, rupeesShort } from "@/lib/format";
import { localDayKey, useDb, useMounted, useNow } from "@/lib/hooks";

const RANGES = [
  ["7", "7 days"],
  ["30", "30 days"],
  ["90", "3 months"],
  ["365", "1 year"],
] as const;

export default function ReportsPage() {
  const db = useDb();
  const mounted = useMounted();
  const now = useNow();
  const [days, setDays] = useState<string>("30");

  const report = useMemo(() => {
    const since = now - Number(days) * 86_400_000;
    const invoices = db.invoices.filter(
      (i) => new Date(i.date).getTime() >= since,
    );

    const revenue = invoices.reduce((s, i) => s + i.total, 0);
    const collected = invoices.reduce((s, i) => s + i.paid, 0);
    const expenses = db.expenses
      .filter((e) => new Date(e.date).getTime() >= since)
      .reduce((s, e) => s + e.amount, 0);

    // Cost of goods sold, for a rough profit figure.
    let cogs = 0;
    for (const inv of invoices) {
      for (const line of inv.lines) {
        const item = db.items.find((i) => i.id === line.itemId);
        if (item?.costPrice) cogs += item.costPrice * line.qty;
      }
    }

    const byDay = new Map<string, number>();
    for (const inv of invoices) {
      const key = localDayKey(inv.date);
      byDay.set(key, (byDay.get(key) ?? 0) + inv.total);
    }
    const series = Array.from({ length: Math.min(Number(days), 30) }, (_, idx) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (Math.min(Number(days), 30) - 1 - idx));
      const key = localDayKey(d);
      return { key, label: d.getDate().toString(), total: byDay.get(key) ?? 0 };
    });

    const productSales = new Map<string, { name: string; qty: number; value: number }>();
    for (const inv of invoices) {
      for (const line of inv.lines) {
        const key = line.itemId ?? line.name;
        const prev = productSales.get(key) ?? { name: line.name, qty: 0, value: 0 };
        productSales.set(key, {
          name: line.name,
          qty: prev.qty + line.qty,
          value: prev.value + line.amount,
        });
      }
    }

    const byMode = new Map<string, number>();
    for (const inv of invoices) {
      byMode.set(inv.paymentMode, (byMode.get(inv.paymentMode) ?? 0) + inv.total);
    }

    const customerSales = new Map<string, { name: string; value: number; bills: number }>();
    for (const inv of invoices) {
      if (!inv.customerId) continue;
      const prev = customerSales.get(inv.customerId) ?? {
        name: inv.customerName,
        value: 0,
        bills: 0,
      };
      customerSales.set(inv.customerId, {
        name: inv.customerName,
        value: prev.value + inv.total,
        bills: prev.bills + 1,
      });
    }

    return {
      invoices,
      revenue,
      collected,
      pending: revenue - collected,
      profit: cogs > 0 ? revenue - cogs : null,
      expenses,
      net: revenue - expenses,
      series,
      topProducts: [...productSales.values()]
        .sort((a, b) => b.value - a.value)
        .slice(0, 8),
      topCustomers: [...customerSales.values()]
        .sort((a, b) => b.value - a.value)
        .slice(0, 8),
      byMode: [...byMode.entries()].sort((a, b) => b[1] - a[1]),
      avgBill: invoices.length ? revenue / invoices.length : 0,
    };
  }, [db, days, now]);

  function exportCsv() {
    const rows = [
      ["Report", `Last ${days} days`],
      ["Generated", new Date().toLocaleString("en-IN")],
      [],
      ["Total revenue", report.revenue.toFixed(2)],
      ["Collected", report.collected.toFixed(2)],
      ["Pending", report.pending.toFixed(2)],
      ["Bills", String(report.invoices.length)],
      ["Average bill", report.avgBill.toFixed(2)],
      [],
      ["Top products", "Qty sold", "Value"],
      ...report.topProducts.map((p) => [p.name, String(p.qty), p.value.toFixed(2)]),
      [],
      ["Top customers", "Bills", "Value"],
      ...report.topCustomers.map((c) => [c.name, String(c.bills), c.value.toFixed(2)]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `dus2pori-report-${days}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!mounted) return <PageHeader title="Reports" subtitle="Loading…" />;

  const peak = Math.max(...report.series.map((s) => s.total), 1);
  const modeTotal = report.byMode.reduce((s, [, v]) => s + v, 0) || 1;
  const MODE_COLORS: Record<string, string> = {
    Cash: "bg-emerald-500",
    UPI: "bg-brand-500",
    Card: "bg-gold-500",
    Credit: "bg-amber-500",
  };

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Know what's selling and who's buying."
        action={
          <>
            <div className="flex items-center gap-1 rounded-xl bg-ink-100 p-1">
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
            <Button variant="secondary" onClick={exportCsv}>
              <Download size={15} /> Export
            </Button>
          </>
        }
      />

      <div className="space-y-5 px-4 pb-10 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            label="Revenue"
            value={rupeesShort(report.revenue)}
            sub={`${report.invoices.length} bills`}
            icon={<IndianRupee size={15} />}
          />
          <Stat
            label="Average bill"
            value={rupeesShort(report.avgBill)}
            sub="per customer"
            icon={<BarChart3 size={15} />}
            tone="pink"
          />
          <Stat
            label="Collected"
            value={rupeesShort(report.collected)}
            sub={report.pending > 0 ? `${rupees(report.pending)} pending` : "all cleared"}
            icon={<TrendingUp size={15} />}
            tone="green"
          />
          <Stat
            label="Net after expenses"
            value={rupeesShort(report.net)}
            sub={
              report.expenses > 0
                ? `${rupees(report.expenses)} spent`
                : "no expenses recorded"
            }
            icon={<Package size={15} />}
            tone={report.net >= 0 ? "amber" : "pink"}
          />
        </div>

        <Card>
          <CardHeader
            title="Daily sales"
            subtitle={`Last ${Math.min(Number(days), 30)} days`}
          />
          {report.revenue > 0 ? (
            <div className="thin-scroll overflow-x-auto px-5 py-5">
              <div className="flex h-56 min-w-[520px] items-stretch gap-1.5">
                {report.series.map((d) => (
                  <div
                    key={d.key}
                    className="group flex h-full flex-1 flex-col items-center gap-1.5"
                    title={`${d.key}: ${rupees(d.total)}`}
                  >
                    <div className="flex w-full flex-1 items-end">
                      <div
                        className="w-full rounded-t bg-gradient-to-t from-brand-600 to-brand-400 transition-all group-hover:opacity-80"
                        style={{
                          height: `${Math.max((d.total / peak) * 100, d.total > 0 ? 4 : 1.5)}%`,
                          opacity: d.total > 0 ? 1 : 0.2,
                        }}
                      />
                    </div>
                    <span className="text-[10px] font-semibold text-ink-400">
                      {d.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<BarChart3 size={20} />}
              title="No sales in this period"
              hint="Pick a longer range, or create your first bill."
            />
          )}
        </Card>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader title="Best selling products" />
            {report.topProducts.length ? (
              <ul className="divide-y divide-ink-100">
                {report.topProducts.map((p, i) => (
                  <li key={p.name + i} className="flex items-center gap-3 px-5 py-3">
                    <span className="tnum grid size-7 shrink-0 place-items-center rounded-lg bg-brand-50 text-xs font-bold text-brand-600">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink-900">
                        {p.name}
                      </span>
                      <span className="tnum block text-xs text-ink-500">
                        {p.qty} sold
                      </span>
                    </span>
                    <span className="tnum shrink-0 text-sm font-bold text-ink-900">
                      {rupees(p.value)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={<Package size={20} />} title="No product sales yet" />
            )}
          </Card>

          <div className="space-y-5">
            <Card>
              <CardHeader title="Payment modes" />
              {report.byMode.length ? (
                <div className="space-y-3 p-5">
                  {report.byMode.map(([mode, value]) => (
                    <div key={mode}>
                      <div className="mb-1.5 flex items-center justify-between text-xs">
                        <span className="font-bold text-ink-700">{mode}</span>
                        <span className="tnum font-semibold text-ink-600">
                          {rupees(value)} ·{" "}
                          {Math.round((value / modeTotal) * 100)}%
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-ink-100">
                        <div
                          className={clsx(
                            "h-full rounded-full",
                            MODE_COLORS[mode] ?? "bg-ink-400",
                          )}
                          style={{ width: `${(value / modeTotal) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={<IndianRupee size={20} />} title="No payments yet" />
              )}
            </Card>

            <Card>
              <CardHeader title="Top customers" />
              {report.topCustomers.length ? (
                <ul className="divide-y divide-ink-100">
                  {report.topCustomers.map((c, i) => (
                    <li key={c.name + i} className="flex items-center gap-3 px-5 py-3">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink-900">
                          {c.name}
                        </span>
                        <span className="tnum block text-xs text-ink-500">
                          {c.bills} bill{c.bills === 1 ? "" : "s"}
                        </span>
                      </span>
                      <span className="tnum shrink-0 text-sm font-bold text-ink-900">
                        {rupees(c.value)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  icon={<TrendingUp size={20} />}
                  title="No named customers yet"
                  hint="Save customers while billing to track their spend."
                />
              )}
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
