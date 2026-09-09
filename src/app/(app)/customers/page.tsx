"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Gift,
  MessageCircle,
  Pencil,
  Phone,
  Search,
  Ticket,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { NewCustomerModal } from "@/components/CustomerPicker";
import { PageHeader } from "@/components/PageHeader";
import { Badge, Button, Card, EmptyState, Modal } from "@/components/ui";
import { adjustPoints, deleteCustomer } from "@/lib/db";
import { PointsHistory } from "@/components/PointsHistory";
import { ReferralCard } from "@/components/ReferralCard";
import {
  initials,
  prettyPhone,
  relativeDays,
  rupees,
  shortDate,
} from "@/lib/format";
import { searchCustomers, useDb, useMounted } from "@/lib/hooks";
import type { Customer } from "@/lib/types";

type SortKey = "recent" | "spend" | "points" | "name";

export default function CustomersPage() {
  const db = useDb();
  const mounted = useMounted();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [viewing, setViewing] = useState<Customer | null>(null);

  const customers = useMemo(() => {
    const base = query.trim()
      ? searchCustomers(db.customers, query, 200)
      : [...db.customers];
    if (query.trim()) return base;
    return base.sort((a, b) => {
      if (sort === "spend") return b.totalSpent - a.totalSpent;
      if (sort === "points") return b.loyaltyPoints - a.loyaltyPoints;
      if (sort === "name") return a.name.localeCompare(b.name);
      return (
        new Date(b.lastVisit ?? b.createdAt).getTime() -
        new Date(a.lastVisit ?? a.createdAt).getTime()
      );
    });
  }, [db.customers, query, sort]);

  const history = viewing
    ? db.invoices.filter((i) => i.customerId === viewing.id)
    : [];
  const pointsLog = viewing
    ? db.pointsLog.filter((p) => p.customerId === viewing.id)
    : [];
  const referredFriends = viewing
    ? db.customers.filter((c) => c.referredBy === viewing.id)
    : [];
  const referrer = viewing?.referredBy
    ? db.customers.find((c) => c.id === viewing.referredBy)
    : undefined;

  if (!mounted) return <PageHeader title="Customers" subtitle="Loading…" />;

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle={`${db.customers.length} saved · ${db.customers.reduce((s, c) => s + c.loyaltyPoints, 0)} loyalty points outstanding`}
        action={
          <Button onClick={() => setAdding(true)}>
            <UserPlus size={16} /> Add customer
          </Button>
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
                placeholder="Search by name or last 4–5 digits of mobile…"
                className="field h-10 py-0 pl-9"
              />
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="field h-10 w-auto py-0 text-xs font-bold"
            >
              <option value="recent">Recent visit</option>
              <option value="spend">Highest spend</option>
              <option value="points">Most points</option>
              <option value="name">Name A–Z</option>
            </select>
          </div>
        </Card>

        <Card>
          {customers.length ? (
            <ul className="divide-y divide-ink-100">
              {customers.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center gap-3 px-4 py-3.5 hover:bg-ink-50 sm:px-5"
                >
                  <button
                    onClick={() => setViewing(c)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-xs font-bold text-white">
                      {initials(c.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-ink-900">
                        {c.name}
                      </span>
                      <span className="tnum block truncate text-xs text-ink-500">
                        {prettyPhone(c.phone)} · {c.visits} visit
                        {c.visits === 1 ? "" : "s"} · {relativeDays(c.lastVisit)}
                      </span>
                      <span className="tnum mt-1 inline-flex items-center gap-1 rounded-md bg-ink-100 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-ink-600">
                        <Ticket size={9} /> {c.referralCode}
                      </span>
                    </span>
                  </button>

                  <div className="hidden shrink-0 text-right sm:block">
                    <p className="tnum text-sm font-bold text-ink-900">
                      {rupees(c.totalSpent)}
                    </p>
                    <p className="text-[11px] text-ink-400">lifetime</p>
                  </div>
                  {c.loyaltyPoints > 0 ? (
                    <Badge tone="amber" className="shrink-0">
                      <Gift size={11} /> {c.loyaltyPoints}
                    </Badge>
                  ) : null}
                  <div className="flex shrink-0 items-center gap-0.5">
                    <a
                      href={`tel:${c.phone}`}
                      className="grid size-8 place-items-center rounded-lg text-ink-400 hover:bg-white hover:text-brand-600"
                      aria-label={`Call ${c.name}`}
                    >
                      <Phone size={15} />
                    </a>
                    <button
                      onClick={() => setEditing(c)}
                      className="grid size-8 place-items-center rounded-lg text-ink-400 hover:bg-white hover:text-brand-600"
                      aria-label={`Edit ${c.name}`}
                    >
                      <Pencil size={15} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<Users size={20} />}
              title={db.customers.length ? "No matching customer" : "No customers yet"}
              hint={
                db.customers.length
                  ? "Try a different name or number."
                  : "Customers get saved automatically while billing, or add them here."
              }
              action={
                <Button size="sm" onClick={() => setAdding(true)}>
                  Add customer
                </Button>
              }
            />
          )}
        </Card>
      </div>

      <NewCustomerModal open={adding} onClose={() => setAdding(false)} />
      <NewCustomerModal
        open={!!editing}
        editing={editing}
        onClose={() => setEditing(null)}
      />

      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing?.name ?? ""}
        subtitle={viewing ? prettyPhone(viewing.phone) : ""}
        wide
      >
        {viewing ? (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-3">
              <MiniStat label="Lifetime spend" value={rupees(viewing.totalSpent)} />
              <MiniStat label="Visits" value={String(viewing.visits)} />
              <MiniStat
                label="Loyalty points"
                value={String(viewing.loyaltyPoints)}
                accent
              />
            </div>

            <ReferralCard
              customer={viewing}
              settings={db.settings}
              referredCount={referredFriends.length}
            />

            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <Detail label="Customer since" value={shortDate(viewing.createdAt)} />
              <Detail label="Last visit" value={relativeDays(viewing.lastVisit)} />
              {referrer ? (
                <Detail label="Referred by" value={referrer.name} />
              ) : null}
              {referredFriends.length ? (
                <Detail
                  label="Friends referred"
                  value={referredFriends.map((f) => f.name).join(", ")}
                />
              ) : null}
              {viewing.birthday ? (
                <Detail label="Birthday" value={shortDate(viewing.birthday)} />
              ) : null}
              {viewing.email ? <Detail label="Email" value={viewing.email} /> : null}
              {viewing.address ? (
                <Detail label="Address" value={viewing.address} />
              ) : null}
              {viewing.notes ? <Detail label="Notes" value={viewing.notes} /> : null}
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-bold tracking-wider text-ink-500 uppercase">
                  Points history ({pointsLog.length})
                </p>
                <button
                  onClick={() => {
                    const raw = prompt(
                      `Adjust points for ${viewing.name}. Use a minus sign to deduct, e.g. -20`,
                      "",
                    );
                    if (raw === null) return;
                    const points = Number(raw);
                    if (!points || Number.isNaN(points)) return;
                    const note = prompt("Reason for this adjustment?", "Goodwill") ?? "";
                    adjustPoints(viewing.id, points, note || "Manual adjustment");
                  }}
                  className="text-xs font-bold text-brand-600 hover:underline"
                >
                  Adjust points
                </button>
              </div>
              <PointsHistory entries={pointsLog} />
            </div>

            <div>
              <p className="mb-2 text-xs font-bold tracking-wider text-ink-500 uppercase">
                Purchase history ({history.length})
              </p>
              {history.length ? (
                <ul className="thin-scroll max-h-64 divide-y divide-ink-100 overflow-y-auto rounded-2xl border border-ink-200">
                  {history.map((inv) => (
                    <li key={inv.id}>
                      <Link
                        href={`/invoices/${inv.id}`}
                        className="flex items-center gap-3 px-3 py-2.5 hover:bg-ink-50"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="tnum block text-xs font-bold text-ink-800">
                            {inv.number}
                          </span>
                          <span className="block truncate text-[11px] text-ink-500">
                            {shortDate(inv.date)} ·{" "}
                            {inv.lines.map((l) => l.name).join(", ")}
                          </span>
                        </span>
                        <span className="tnum shrink-0 text-sm font-bold text-ink-900">
                          {rupees(inv.total)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-2xl border border-dashed border-ink-300 px-4 py-6 text-center text-xs text-ink-500">
                  No purchases recorded yet.
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2 border-t border-ink-100 pt-4">
              <Link href="/billing" className="flex-1">
                <Button className="w-full">New bill</Button>
              </Link>
              <a
                href={`https://wa.me/91${viewing.phone}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                <MessageCircle size={16} /> WhatsApp
              </a>
              <Button
                variant="ghost"
                onClick={() => {
                  if (
                    confirm(
                      `Delete ${viewing.name}? Their past bills stay, but the profile and points are removed.`,
                    )
                  ) {
                    deleteCustomer(viewing.id);
                    setViewing(null);
                  }
                }}
                aria-label="Delete customer"
              >
                <Trash2 size={16} />
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}

function MiniStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-3 text-center ${accent ? "bg-gold-100/70" : "bg-ink-100"}`}
    >
      <p
        className={`tnum display text-xl ${accent ? "text-gold-600" : "text-ink-900"}`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[11px] font-semibold text-ink-500">{label}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-ink-50 px-3 py-2">
      <p className="text-[11px] font-semibold text-ink-500">{label}</p>
      <p className="text-sm font-semibold text-ink-800">{value}</p>
    </div>
  );
}
