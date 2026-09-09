"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Cake,
  IndianRupee,
  Package,
  Plus,
  ReceiptText,
  TrendingUp,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Badge, Button, Card, CardHeader, EmptyState, Stat } from "@/components/ui";
import { installDemoData } from "@/lib/seed";
import { initials, prettyPhone, relativeDays, rupees, rupeesShort } from "@/lib/format";
import { localDayKey, useDb, useMounted, useNow } from "@/lib/hooks";

export default function DashboardPage() {
  const db = useDb();
  const mounted = useMounted();
  const nowTs = useNow();

  const stats = useMemo(() => {
    const now = new Date(nowTs);
    const todayKey = localDayKey(now);
    const monthKey = todayKey.slice(0, 7);

    const today = db.invoices.filter((i) => localDayKey(i.date) === todayKey);
    const month = db.invoices.filter((i) => localDayKey(i.date).slice(0, 7) === monthKey);
    const lowStock = db.items.filter((i) => i.stock <= i.lowStockAt);
    const dues = db.invoices.filter((i) => i.due > 0);

    // Last 7 days, oldest first, for the trend bars.
    const trend = Array.from({ length: 7 }, (_, idx) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (6 - idx));
      const key = localDayKey(d);
      return {
        key,
        label: d.toLocaleDateString("en-IN", { weekday: "short" }),
        total: db.invoices
          .filter((i) => localDayKey(i.date) === key)
          .reduce((s, i) => s + i.total, 0),
      };
    });

    const thisMonth = String(now.getMonth() + 1).padStart(2, "0");
    const birthdays = db.customers.filter(
      (c) => c.birthday?.slice(5, 7) === thisMonth,
    );

    return {
      todayTotal: today.reduce((s, i) => s + i.total, 0),
      todayCount: today.length,
      monthTotal: month.reduce((s, i) => s + i.total, 0),
      monthCount: month.length,
      lowStock,
      dueTotal: dues.reduce((s, i) => s + i.due, 0),
      dueCount: dues.length,
      trend,
      birthdays,
    };
  }, [db, nowTs]);

  if (!mounted) {
    return <PageHeader title="Dashboard" subtitle="Loading your shop…" />;
  }

  const isEmpty = db.invoices.length === 0 && db.items.length === 0;
  const peak = Math.max(...stats.trend.map((t) => t.total), 1);

  return (
    <>
      <PageHeader
        title={`Welcome back 👋`}
        subtitle={`Here's how ${db.settings.shopName} is doing today.`}
        action={
          <Link href="/billing">
            <Button size="lg">
              <Plus size={16} /> New Bill
            </Button>
          </Link>
        }
      />

      <div className="space-y-5 px-4 pb-10 sm:px-6">
        {isEmpty ? (
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-br from-brand-600 via-brand-700 to-plum-900 px-6 py-8 text-white">
              <h2 className="text-xl font-extrabold">Let&apos;s set up your shop</h2>
              <p className="mt-1 max-w-lg text-sm text-white/80">
                Add your products, then start billing. Everything is stored right on
                this device — no account, no monthly fee.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link href="/items">
                  <Button variant="secondary">
                    <Package size={16} /> Add products
                  </Button>
                </Link>
                <Link href="/settings">
                  <Button variant="secondary">Shop details</Button>
                </Link>
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (confirm("Load sample products, customers and bills to explore the app?"))
                      installDemoData();
                  }}
                >
                  Load demo data
                </Button>
              </div>
            </div>
          </Card>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            label="Today's sale"
            value={rupeesShort(stats.todayTotal)}
            sub={`${stats.todayCount} bill${stats.todayCount === 1 ? "" : "s"}`}
            icon={<IndianRupee size={15} />}
          />
          <Stat
            label="This month"
            value={rupeesShort(stats.monthTotal)}
            sub={`${stats.monthCount} bills`}
            icon={<TrendingUp size={15} />}
            tone="green"
          />
          <Stat
            label="Customers"
            value={db.customers.length}
            sub={`${db.customers.reduce((s, c) => s + c.loyaltyPoints, 0)} points issued`}
            icon={<Users size={15} />}
            tone="pink"
          />
          <Stat
            label="Pending dues"
            value={rupeesShort(stats.dueTotal)}
            sub={`from ${stats.dueCount} bill${stats.dueCount === 1 ? "" : "s"}`}
            icon={<ReceiptText size={15} />}
            tone="amber"
          />
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <Card>
            <CardHeader
              title="Last 7 days"
              subtitle="Daily sales trend"
              action={
                <Link
                  href="/reports"
                  className="inline-flex items-center gap-1 text-xs font-bold text-brand-600 hover:underline"
                >
                  Reports <ArrowUpRight size={13} />
                </Link>
              }
            />
            <div className="flex h-52 items-stretch gap-2 px-5 py-5 sm:gap-4">
              {stats.trend.map((d) => (
                <div
                  key={d.key}
                  className="flex h-full flex-1 flex-col items-center gap-2"
                >
                  <span className="tnum text-[10px] font-bold text-ink-500">
                    {d.total > 0 ? rupeesShort(d.total) : ""}
                  </span>
                  <div className="flex w-full flex-1 items-end">
                    <div
                      className="w-full rounded-t-lg bg-gradient-to-t from-brand-600 to-brand-400 transition-all"
                      style={{
                        height: `${Math.max((d.total / peak) * 100, d.total > 0 ? 6 : 2)}%`,
                        opacity: d.total > 0 ? 1 : 0.25,
                      }}
                    />
                  </div>
                  <span className="text-[11px] font-semibold text-ink-500">
                    {d.label}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Recent bills"
              action={
                <Link
                  href="/invoices"
                  className="text-xs font-bold text-brand-600 hover:underline"
                >
                  View all
                </Link>
              }
            />
            {db.invoices.length ? (
              <ul className="divide-y divide-ink-100">
                {db.invoices.slice(0, 6).map((inv) => (
                  <li key={inv.id}>
                    <Link
                      href={`/invoices/${inv.id}`}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-ink-50"
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-50 text-[11px] font-bold text-brand-600">
                        {initials(inv.customerName)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-ink-900">
                          {inv.customerName}
                        </span>
                        <span className="tnum block text-xs text-ink-500">
                          {inv.number} · {relativeDays(inv.date)}
                        </span>
                      </span>
                      <span className="tnum shrink-0 text-sm font-extrabold text-ink-900">
                        {rupees(inv.total)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<ReceiptText size={20} />}
                title="No bills yet"
                hint="Your sales will appear here as soon as you create the first bill."
                action={
                  <Link href="/billing">
                    <Button size="sm">Create first bill</Button>
                  </Link>
                }
              />
            )}
          </Card>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader
              title="Low stock alert"
              subtitle="Reorder these before they run out"
              action={
                <Link
                  href="/items"
                  className="text-xs font-bold text-brand-600 hover:underline"
                >
                  Manage
                </Link>
              }
            />
            {stats.lowStock.length ? (
              <ul className="divide-y divide-ink-100">
                {stats.lowStock.slice(0, 5).map((it) => (
                  <li
                    key={it.id}
                    className="flex items-center gap-3 px-5 py-3"
                  >
                    <AlertTriangle
                      size={16}
                      className={it.stock <= 0 ? "text-rose-500" : "text-amber-500"}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink-800">
                      {it.name}
                    </span>
                    <Badge tone={it.stock <= 0 ? "red" : "amber"}>
                      {it.stock <= 0 ? "Out of stock" : `${it.stock} ${it.unit} left`}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<Package size={20} />}
                title="Stock looks healthy"
                hint="Nothing has dropped to its reorder level."
              />
            )}
          </Card>

          <Card>
            <CardHeader
              title="Birthdays this month"
              subtitle="A good reason to send an offer"
            />
            {stats.birthdays.length ? (
              <ul className="divide-y divide-ink-100">
                {stats.birthdays.slice(0, 5).map((c) => (
                  <li key={c.id} className="flex items-center gap-3 px-5 py-3">
                    <Cake size={16} className="text-brand-500" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink-800">
                        {c.name}
                      </span>
                      <span className="tnum block text-xs text-ink-500">
                        {prettyPhone(c.phone)}
                      </span>
                    </span>
                    <a
                      href={`https://wa.me/91${c.phone}?text=${encodeURIComponent(
                        `Happy Birthday ${c.name}! 🎉 From all of us at ${db.settings.shopName} — enjoy a special birthday discount on your next visit. 💜`,
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100"
                    >
                      Wish
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<Cake size={20} />}
                title="No birthdays this month"
                hint="Save birthdays while adding customers to unlock this."
              />
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
