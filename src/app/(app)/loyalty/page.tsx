"use client";

import { useMemo } from "react";
import { Cake, Crown, Gift, MessageCircle, Sparkles, TrendingDown } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Badge, Card, CardHeader, EmptyState, Stat, Toggle } from "@/components/ui";
import { saveSettings } from "@/lib/db";
import { initials, prettyPhone, relativeDays, rupees } from "@/lib/format";
import { useDb, useMounted, useNow } from "@/lib/hooks";

export default function LoyaltyPage() {
  const db = useDb();
  const mounted = useMounted();
  const now = useNow();
  const l = db.settings.loyalty;

  const data = useMemo(() => {
    const thisMonth = String(new Date(now).getMonth() + 1).padStart(2, "0");
    const sixtyDaysAgo = now - 60 * 86_400_000;

    return {
      top: [...db.customers].sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 8),
      birthdays: db.customers.filter((c) => c.birthday?.slice(5, 7) === thisMonth),
      lapsed: db.customers
        .filter(
          (c) =>
            c.visits > 0 &&
            c.lastVisit &&
            new Date(c.lastVisit).getTime() < sixtyDaysAgo,
        )
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, 8),
      outstanding: db.customers.reduce((s, c) => s + c.loyaltyPoints, 0),
      redeemed: db.invoices.reduce((s, i) => s + i.pointsRedeemed, 0),
      issued: db.invoices.reduce((s, i) => s + i.pointsEarned, 0),
    };
  }, [db, now]);

  if (!mounted) return <PageHeader title="Loyalty" subtitle="Loading…" />;

  return (
    <>
      <PageHeader
        title="Loyalty & Offers"
        subtitle="Reward regulars, bring back the ones who stopped coming."
      />

      <div className="space-y-5 px-4 pb-10 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat
            label="Points outstanding"
            value={data.outstanding}
            sub={`worth ${rupees(data.outstanding * l.rupeesPerPoint)}`}
            icon={<Gift size={15} />}
            tone="amber"
          />
          <Stat
            label="Points issued"
            value={data.issued}
            sub="all time"
            icon={<Sparkles size={15} />}
          />
          <Stat
            label="Points redeemed"
            value={data.redeemed}
            sub={`${data.issued ? Math.round((data.redeemed / data.issued) * 100) : 0}% redemption rate`}
            icon={<TrendingDown size={15} />}
            tone="green"
          />
        </div>

        <Card>
          <CardHeader
            title="Your reward rules"
            subtitle="Change these any time — they apply to new bills."
          />
          <div className="grid gap-5 p-5 lg:grid-cols-2">
            <div className="space-y-1">
              <Toggle
                checked={l.enabled}
                onChange={(v) => saveSettings({ loyalty: { ...l, enabled: v } })}
                label="Loyalty programme"
                hint="Give points on every bill and let customers spend them."
              />

              <div className="space-y-3 pt-3">
                <Rule
                  label="Points for every ₹100 spent"
                  value={l.pointsPer100}
                  onChange={(v) => saveSettings({ loyalty: { ...l, pointsPer100: v } })}
                  suffix="points"
                />
                <Rule
                  label="1 point is worth"
                  value={l.rupeesPerPoint}
                  onChange={(v) =>
                    saveSettings({ loyalty: { ...l, rupeesPerPoint: v } })
                  }
                  prefix="₹"
                  step={0.5}
                />
                <Rule
                  label="Minimum points before redeeming"
                  value={l.minRedeem}
                  onChange={(v) => saveSettings({ loyalty: { ...l, minRedeem: v } })}
                  suffix="points"
                />
              </div>
            </div>

            <div className="rounded-2xl bg-gradient-to-br from-brand-600 via-brand-700 to-plum-900 p-5 text-white">
              <p className="text-xs font-bold tracking-wider text-white/70 uppercase">
                How it works for your customer
              </p>
              <ul className="mt-3 space-y-2.5 text-sm">
                <li className="flex gap-2">
                  <span className="text-white/60">1.</span>
                  <span>
                    Buys for <strong>₹1,000</strong> → earns{" "}
                    <strong>{Math.floor(10 * l.pointsPer100)} points</strong>
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-white/60">2.</span>
                  <span>
                    Once they cross <strong>{l.minRedeem} points</strong>, they can
                    spend them
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-white/60">3.</span>
                  <span>
                    {l.minRedeem} points ={" "}
                    <strong>{rupees(l.minRedeem * l.rupeesPerPoint)} off</strong> their
                    bill
                  </span>
                </li>
              </ul>
              <p className="mt-4 rounded-xl bg-white/15 px-3 py-2 text-xs font-semibold">
                That&apos;s {(l.pointsPer100 * l.rupeesPerPoint).toFixed(1)}% back
                on every bill — cosmetics shops usually run 2–5%.
              </p>
            </div>
          </div>
        </Card>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader title="Top customers" subtitle="Your most valuable regulars" />
            {data.top.length ? (
              <ul className="divide-y divide-ink-100">
                {data.top.map((c, i) => (
                  <li key={c.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-[11px] font-bold text-white">
                      {initials(c.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-bold text-ink-900">
                          {c.name}
                        </span>
                        {i === 0 ? (
                          <Crown size={13} className="shrink-0 text-amber-500" />
                        ) : null}
                      </span>
                      <span className="tnum block text-xs text-ink-500">
                        {c.visits} visits · {relativeDays(c.lastVisit)}
                      </span>
                    </span>
                    <span className="tnum shrink-0 text-right text-sm font-extrabold text-ink-900">
                      {rupees(c.totalSpent)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<Crown size={20} />}
                title="No customer data yet"
                hint="Start billing with saved customers to see your regulars here."
              />
            )}
          </Card>

          <div className="space-y-5">
            <Card>
              <CardHeader
                title="Win them back"
                subtitle="Haven't visited in 60+ days"
              />
              {data.lapsed.length ? (
                <ul className="divide-y divide-ink-100">
                  {data.lapsed.map((c) => (
                    <li key={c.id} className="flex items-center gap-3 px-5 py-3">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-ink-900">
                          {c.name}
                        </span>
                        <span className="tnum block text-xs text-ink-500">
                          {prettyPhone(c.phone)} · {relativeDays(c.lastVisit)}
                        </span>
                      </span>
                      {c.loyaltyPoints > 0 ? (
                        <Badge tone="amber">
                          <Gift size={11} /> {c.loyaltyPoints}
                        </Badge>
                      ) : null}
                      <a
                        href={`https://wa.me/91${c.phone}?text=${encodeURIComponent(
                          `Hi ${c.name.split(" ")[0]}! We miss you at ${db.settings.shopName} 💜${
                            c.loyaltyPoints > 0
                              ? ` You still have ${c.loyaltyPoints} loyalty points (worth ${rupees(c.loyaltyPoints * l.rupeesPerPoint)}) waiting for you.`
                              : ""
                          } Come visit us soon for new arrivals!`,
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="grid size-8 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                        aria-label={`WhatsApp ${c.name}`}
                      >
                        <MessageCircle size={15} />
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  icon={<Sparkles size={20} />}
                  title="Everyone's visiting"
                  hint="No customer has gone quiet for more than 60 days."
                />
              )}
            </Card>

            <Card>
              <CardHeader
                title="Birthdays this month"
                subtitle={`Gift ${l.birthdayBonus} bonus points to make their day`}
              />
              {data.birthdays.length ? (
                <ul className="divide-y divide-ink-100">
                  {data.birthdays.map((c) => (
                    <li key={c.id} className="flex items-center gap-3 px-5 py-3">
                      <Cake size={16} className="shrink-0 text-brand-500" />
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink-800">
                        {c.name}
                      </span>
                      <span className="tnum shrink-0 text-xs text-ink-500">
                        {c.birthday?.slice(8, 10)}/{c.birthday?.slice(5, 7)}
                      </span>
                      <a
                        href={`https://wa.me/91${c.phone}?text=${encodeURIComponent(
                          `Happy Birthday ${c.name.split(" ")[0]}! 🎉🎂 From all of us at ${db.settings.shopName} — visit us this month for a special birthday treat. 💜`,
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="grid size-8 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                        aria-label={`Wish ${c.name}`}
                      >
                        <MessageCircle size={15} />
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  icon={<Cake size={20} />}
                  title="No birthdays this month"
                  hint="Save birthdays when adding a customer."
                />
              )}
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}

function Rule({
  label,
  value,
  onChange,
  prefix,
  suffix,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
  step?: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label className="text-sm font-medium text-ink-700">{label}</label>
      <div className="flex shrink-0 items-center gap-1.5">
        {prefix ? (
          <span className="text-sm font-bold text-ink-500">{prefix}</span>
        ) : null}
        <input
          type="number"
          step={step}
          min={0}
          value={value}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value)))}
          className="field tnum h-9 w-20 py-0 text-center font-bold"
        />
        {suffix ? (
          <span className="text-xs font-semibold text-ink-500">{suffix}</span>
        ) : null}
      </div>
    </div>
  );
}
