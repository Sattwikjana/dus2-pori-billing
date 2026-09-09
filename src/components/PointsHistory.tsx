"use client";

import {
  Gift,
  Minus,
  PenLine,
  Plus,
  ShoppingBag,
  Ticket,
  Users,
} from "lucide-react";
import { clsx } from "@/lib/clsx";
import { shortDate } from "@/lib/format";
import type { PointsEntry, PointsReason } from "@/lib/types";

const LOOK: Record<
  PointsReason,
  { icon: typeof Gift; label: string; tone: string }
> = {
  purchase: { icon: ShoppingBag, label: "Purchase", tone: "bg-brand-50 text-brand-600" },
  redeem: { icon: Minus, label: "Redeemed", tone: "bg-ink-100 text-ink-600" },
  "referral-reward": {
    icon: Users,
    label: "Referral bonus",
    tone: "bg-gold-100 text-gold-600",
  },
  "referral-welcome": {
    icon: Ticket,
    label: "Welcome bonus",
    tone: "bg-gold-100 text-gold-600",
  },
  "referral-purchase": {
    icon: Users,
    label: "Friend's purchase",
    tone: "bg-gold-100 text-gold-600",
  },
  birthday: { icon: Gift, label: "Birthday gift", tone: "bg-brand-50 text-brand-600" },
  manual: { icon: PenLine, label: "Manual adjustment", tone: "bg-ink-100 text-ink-600" },
};

export function PointsHistory({ entries }: { entries: PointsEntry[] }) {
  if (!entries.length) {
    return (
      <p className="rounded-2xl border border-dashed border-ink-300 px-4 py-6 text-center text-xs text-ink-500">
        No points activity yet.
      </p>
    );
  }

  return (
    <ul className="thin-scroll max-h-64 divide-y divide-ink-100 overflow-y-auto rounded-2xl border border-ink-200">
      {entries.map((e) => {
        const look = LOOK[e.reason] ?? LOOK.manual;
        const Icon = look.icon;
        const positive = e.points >= 0;
        return (
          <li key={e.id} className="flex items-center gap-3 px-3 py-2.5">
            <span
              className={clsx(
                "grid size-8 shrink-0 place-items-center rounded-xl",
                look.tone,
              )}
            >
              <Icon size={14} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-bold text-ink-800">
                {look.label}
              </span>
              <span className="block truncate text-[11px] text-ink-500">
                {shortDate(e.date)}
                {e.note ? ` · ${e.note}` : ""}
              </span>
            </span>
            <span
              className={clsx(
                "tnum inline-flex shrink-0 items-center gap-0.5 text-sm font-extrabold",
                positive ? "text-emerald-600" : "text-ink-500",
              )}
            >
              {positive ? <Plus size={12} /> : <Minus size={12} />}
              {Math.abs(e.points)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
