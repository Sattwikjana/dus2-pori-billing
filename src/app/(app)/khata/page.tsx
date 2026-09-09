"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CheckCircle2, MessageCircle, NotebookPen, Phone, Search } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Badge, Button, Card, CardHeader, EmptyState, Stat } from "@/components/ui";
import { recordPayment } from "@/lib/db";
import { prettyPhone, relativeDays, rupees, rupeesShort, shortDate } from "@/lib/format";
import { useDb, useMounted, useNow } from "@/lib/hooks";
import type { Invoice } from "@/lib/types";

interface Ledger {
  key: string;
  name: string;
  phone: string;
  due: number;
  bills: Invoice[];
  oldest: string;
}

export default function KhataPage() {
  const db = useDb();
  const mounted = useMounted();
  const now = useNow();
  const [query, setQuery] = useState("");

  const ledgers = useMemo(() => {
    const map = new Map<string, Ledger>();
    for (const inv of db.invoices) {
      if (inv.due <= 0) continue;
      const key = inv.customerId ?? inv.customerPhone ?? inv.id;
      const prev = map.get(key);
      if (prev) {
        prev.due += inv.due;
        prev.bills.push(inv);
        if (inv.date < prev.oldest) prev.oldest = inv.date;
      } else {
        map.set(key, {
          key,
          name: inv.customerName,
          phone: inv.customerPhone,
          due: inv.due,
          bills: [inv],
          oldest: inv.date,
        });
      }
    }

    const q = query.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, "");
    return [...map.values()]
      .filter(
        (l) =>
          !q ||
          l.name.toLowerCase().includes(q) ||
          (qDigits.length >= 2 && l.phone.includes(qDigits)),
      )
      .sort((a, b) => b.due - a.due);
  }, [db.invoices, query]);

  const totalDue = ledgers.reduce((s, l) => s + l.due, 0);
  const overdue = ledgers.filter(
    (l) => now - new Date(l.oldest).getTime() > 30 * 86_400_000,
  );

  if (!mounted) return <PageHeader title="Khata" subtitle="Loading…" />;

  return (
    <>
      <PageHeader
        title="Khata / Udhaar"
        subtitle="Every rupee customers still owe you, in one place."
      />

      <div className="space-y-5 px-4 pb-10 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat
            label="Total pending"
            value={rupeesShort(totalDue)}
            sub={`from ${ledgers.length} customer${ledgers.length === 1 ? "" : "s"}`}
            icon={<NotebookPen size={15} />}
            tone="amber"
          />
          <Stat
            label="Overdue 30+ days"
            value={rupeesShort(overdue.reduce((s, l) => s + l.due, 0))}
            sub={`${overdue.length} customer${overdue.length === 1 ? "" : "s"}`}
            icon={<MessageCircle size={15} />}
            tone="pink"
          />
          <Stat
            label="Collected this month"
            value={rupeesShort(
              db.invoices
                .filter(
                  (i) =>
                    new Date(i.date).getMonth() === new Date(now).getMonth() &&
                    new Date(i.date).getFullYear() === new Date(now).getFullYear(),
                )
                .reduce((s, i) => s + i.paid, 0),
            )}
            sub="payments received"
            icon={<CheckCircle2 size={15} />}
            tone="green"
          />
        </div>

        <Card className="p-3">
          <div className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-400"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search customer name or mobile…"
              className="field h-10 py-0 pl-9"
            />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Pending dues"
            subtitle="Tap a bill to open it, or send a polite WhatsApp reminder."
          />
          {ledgers.length ? (
            <ul className="divide-y divide-ink-100">
              {ledgers.map((l) => {
                const days = Math.floor(
                  (now - new Date(l.oldest).getTime()) / 86_400_000,
                );
                return (
                  <li key={l.key} className="px-4 py-4 sm:px-5">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 text-sm font-bold text-ink-900">
                          {l.name}
                          {days > 30 ? (
                            <Badge tone="red">{days} days old</Badge>
                          ) : null}
                        </p>
                        <p className="tnum text-xs text-ink-500">
                          {l.phone ? `${prettyPhone(l.phone)} · ` : ""}
                          {l.bills.length} unpaid bill
                          {l.bills.length === 1 ? "" : "s"} · since{" "}
                          {relativeDays(l.oldest)}
                        </p>
                      </div>
                      <p className="tnum shrink-0 text-lg font-extrabold text-rose-600">
                        {rupees(l.due)}
                      </p>
                      {l.phone ? (
                        <div className="flex shrink-0 gap-1.5">
                          <a
                            href={`tel:${l.phone}`}
                            className="grid size-9 place-items-center rounded-xl border border-ink-200 text-ink-500 hover:bg-ink-50"
                            aria-label={`Call ${l.name}`}
                          >
                            <Phone size={15} />
                          </a>
                          <a
                            href={`https://wa.me/91${l.phone}?text=${encodeURIComponent(
                              `Hello ${l.name.split(" ")[0]}, this is a gentle reminder from ${db.settings.shopName}. Your pending balance is ${rupees(l.due)}${db.settings.upiId ? `. You can pay on UPI: ${db.settings.upiId}` : ""}. Thank you! 💜`,
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-700"
                          >
                            <MessageCircle size={14} /> Remind
                          </a>
                        </div>
                      ) : null}
                    </div>

                    <ul className="mt-3 space-y-1.5">
                      {l.bills.map((inv) => (
                        <li
                          key={inv.id}
                          className="flex items-center gap-3 rounded-xl bg-ink-50 px-3 py-2"
                        >
                          <Link
                            href={`/invoices/${inv.id}`}
                            className="tnum min-w-0 flex-1 truncate text-xs font-semibold text-brand-700 hover:underline"
                          >
                            {inv.number} · {shortDate(inv.date)}
                          </Link>
                          <span className="tnum shrink-0 text-xs font-bold text-ink-700">
                            {rupees(inv.due)} due
                          </span>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              if (confirm(`Mark ${rupees(inv.due)} as received for ${inv.number}?`))
                                recordPayment(inv.id, inv.due);
                            }}
                          >
                            Received
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              icon={<CheckCircle2 size={20} />}
              title={query ? "No matching customer" : "No pending dues 🎉"}
              hint={
                query
                  ? "Try a different name or number."
                  : "Every bill is fully paid. Bills marked Credit will appear here."
              }
            />
          )}
        </Card>
      </div>
    </>
  );
}
