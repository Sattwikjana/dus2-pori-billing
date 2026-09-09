"use client";

import { useState } from "react";
import { Check, Copy, MessageCircle, Ticket } from "lucide-react";
import type { Customer, Settings } from "@/lib/types";

/** Shows a customer's own code, with one tap to copy or send it on WhatsApp. */
export function ReferralCard({
  customer,
  settings,
  referredCount,
}: {
  customer: Customer;
  settings: Settings;
  referredCount: number;
}) {
  const [copied, setCopied] = useState(false);
  const { referral } = settings;

  const message = [
    `Hi! Use my referral code *${customer.referralCode}* at ${settings.shopName}`,
    referral.friendBonus > 0
      ? ` and get ${referral.friendBonus} bonus points on your first visit.`
      : ".",
    " 💜",
  ].join("");

  async function copy() {
    try {
      await navigator.clipboard.writeText(customer.referralCode);
    } catch {
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 via-brand-700 to-plum-900 p-4 text-white">
      <div className="flex items-center justify-between">
        <p className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-[0.14em] text-white/70 uppercase">
          <Ticket size={12} /> Referral code
        </p>
        <p className="text-[11px] font-semibold text-white/70">
          {referredCount} referred
        </p>
      </div>

      <p className="tnum mt-1.5 text-2xl font-extrabold tracking-[0.16em]">
        {customer.referralCode}
      </p>

      <div className="mt-3 flex gap-2">
        <button
          onClick={copy}
          className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/15 text-xs font-bold text-white transition hover:bg-white/25"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copied" : "Copy code"}
        </button>
        {customer.phone ? (
          <a
            href={`https://wa.me/91${customer.phone}?text=${encodeURIComponent(message)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-white text-xs font-bold text-brand-700 transition hover:bg-brand-50"
          >
            <MessageCircle size={14} /> Send code
          </a>
        ) : null}
      </div>

      {referral.enabled ? (
        <p className="mt-2.5 text-[11px] leading-relaxed text-white/70">
          When a friend joins with this code, {customer.name.split(" ")[0]} gets{" "}
          <strong className="text-white">{referral.referrerBonus} points</strong>
          {referral.firstPurchasePercent > 0
            ? ` plus ${referral.firstPurchasePercent}% of their first bill as points`
            : ""}
          .
        </p>
      ) : (
        <p className="mt-2.5 text-[11px] text-white/70">
          Referral rewards are switched off in Loyalty settings.
        </p>
      )}
    </div>
  );
}
