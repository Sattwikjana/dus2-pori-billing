"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Download, Filter, Plus, ReceiptText, Search } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Badge, Button, Card, EmptyState } from "@/components/ui";
import { clsx } from "@/lib/clsx";
import { dateTime, initials, prettyPhone, rupees } from "@/lib/format";
import { localDayKey, useDb, useMounted, useNow } from "@/lib/hooks";

type Range = "all" | "today" | "week" | "month";
type StatusFilter = "all" | "paid" | "unpaid";

export default function InvoicesPage() {
  const db = useDb();
  const mounted = useMounted();
  const now = useNow();
  const [query, setQuery] = useState("");
  const [range, setRange] = useState<Range>("all");
  const [status, setStatus] = useState<StatusFilter>("all");

  const invoices = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, "");
    const windows: Record<Range, number> = {
      all: Infinity,
      today: 0,
      week: 7,
      month: 30,
    };

    return db.invoices.filter((inv) => {
      if (range === "today") {
        if (localDayKey(inv.date) !== localDayKey(now)) return false;
      } else if (range !== "all") {
        const days = (now - new Date(inv.date).getTime()) / 86_400_000;
        if (days > windows[range]) return false;
      }
      if (status === "paid" && inv.due > 0) return false;
      if (status === "unpaid" && inv.due <= 0) return false;
      if (!q) return true;
      return (
        inv.customerName.toLowerCase().includes(q) ||
        inv.number.toLowerCase().includes(q) ||
        (qDigits.length >= 2 && inv.customerPhone.includes(qDigits))
      );
    });
  }, [db.invoices, query, range, status, now]);

  const total = invoices.reduce((s, i) => s + i.total, 0);
  const due = invoices.reduce((s, i) => s + i.due, 0);

  function exportCsv() {
    const rows = [
      ["Invoice", "Date", "Customer", "Phone", "Items", "Total", "Paid", "Due", "Mode"],
      ...invoices.map((i) => [
        i.number,
        new Date(i.date).toLocaleString("en-IN"),
        i.customerName,
        i.customerPhone,
        String(i.lines.length),
        i.total.toFixed(2),
        i.paid.toFixed(2),
        i.due.toFixed(2),
        i.paymentMode,
      ]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `dus2pori-invoices-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!mounted) return <PageHeader title="Invoices" subtitle="Loading…" />;

  return (
    <>
      <PageHeader
        title="Invoices"
        subtitle={`${invoices.length} bill${invoices.length === 1 ? "" : "s"} · ${rupees(total)} total${due > 0 ? ` · ${rupees(due)} pending` : ""}`}
        action={
          <>
            <Button variant="secondary" onClick={exportCsv} disabled={!invoices.length}>
              <Download size={15} /> Export
            </Button>
            <Link href="/billing">
              <Button>
                <Plus size={16} /> New Bill
              </Button>
            </Link>
          </>
        }
      />

      <div className="space-y-4 px-4 pb-10 sm:px-6">
        <Card className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-52 flex-1">
              <Search
                size={16}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-400"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search bill no., customer or phone…"
                className="field h-10 py-0 pl-9"
              />
            </div>
            <FilterGroup
              value={range}
              onChange={setRange}
              options={[
                ["all", "All time"],
                ["today", "Today"],
                ["week", "7 days"],
                ["month", "30 days"],
              ]}
            />
            <FilterGroup
              value={status}
              onChange={setStatus}
              options={[
                ["all", "All"],
                ["paid", "Paid"],
                ["unpaid", "Due"],
              ]}
            />
          </div>
        </Card>

        <Card>
          {invoices.length ? (
            <ul className="divide-y divide-ink-100">
              {invoices.map((inv) => (
                <li key={inv.id}>
                  <Link
                    href={`/invoices/${inv.id}`}
                    className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-ink-50 sm:px-5"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-xs font-bold text-white">
                      {initials(inv.customerName)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-ink-900">
                        {inv.customerName}
                      </p>
                      <p className="tnum truncate text-xs text-ink-500">
                        {inv.number}
                        {inv.customerPhone
                          ? ` · ${prettyPhone(inv.customerPhone)}`
                          : ""}{" "}
                        · {dateTime(inv.date)}
                      </p>
                    </div>
                    <div className="hidden shrink-0 sm:block">
                      <Badge tone="neutral">{inv.paymentMode}</Badge>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="tnum text-sm font-extrabold text-ink-900">
                        {rupees(inv.total)}
                      </p>
                      {inv.due > 0 ? (
                        <p className="tnum text-[11px] font-bold text-rose-600">
                          {rupees(inv.due)} due
                        </p>
                      ) : (
                        <p className="text-[11px] font-semibold text-emerald-600">
                          Paid
                        </p>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<ReceiptText size={20} />}
              title={db.invoices.length ? "No bills match these filters" : "No bills yet"}
              hint={
                db.invoices.length
                  ? "Try clearing the search or the date filter."
                  : "Create your first bill and it will show up here."
              }
              action={
                <Link href="/billing">
                  <Button size="sm">Create a bill</Button>
                </Link>
              }
            />
          )}
        </Card>
      </div>
    </>
  );
}

function FilterGroup<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: [T, string][];
}) {
  return (
    <div className="flex items-center gap-1 rounded-xl bg-ink-100 p-1">
      <Filter size={13} className="ml-1.5 text-ink-400" />
      {options.map(([key, label]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={clsx(
            "rounded-lg px-2.5 py-1.5 text-xs font-bold transition",
            value === key
              ? "bg-white text-brand-700 shadow-sm"
              : "text-ink-500 hover:text-ink-800",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
