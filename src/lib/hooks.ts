"use client";

import { useMemo, useSyncExternalStore } from "react";
import { getServerSnapshot, getSnapshot, subscribe } from "./db";
import type { Customer, Database } from "./types";

export function useDb(): Database {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

const noopSubscribe = () => () => {};

/** True once the browser has hydrated — gate localStorage-driven UI on this. */
export function useMounted() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

function subscribeToClock(onChange: () => void) {
  const id = setInterval(onChange, 30_000);
  return () => clearInterval(id);
}

// Bucketed to the minute so the snapshot stays stable between renders.
const currentMinute = () => Math.floor(Date.now() / 60_000);

/**
 * Wall-clock time, refreshed every minute. Keeps "today's sales" and other
 * date-bounded figures correct when the shop stays open past midnight.
 */
export function useNow(): number {
  return useSyncExternalStore(subscribeToClock, currentMinute, () => 0) * 60_000;
}

const digits = (s: string) => s.replace(/\D/g, "");

/**
 * Customer lookup that powers the billing screen: typing 4–5 digits of a
 * phone number is enough to surface a returning customer. Matches anywhere in
 * the number, and also matches on name.
 */
export function searchCustomers(customers: Customer[], query: string, limit = 8) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const qDigits = digits(q);

  const scored = customers
    .map((c) => {
      const phone = digits(c.phone);
      const name = c.name.toLowerCase();
      let score = -1;

      if (qDigits.length >= 2 && phone) {
        if (phone === qDigits) score = 100;
        else if (phone.startsWith(qDigits)) score = 90;
        else if (phone.endsWith(qDigits)) score = 80;
        else if (phone.includes(qDigits)) score = 70;
      }
      if (score < 0 && name.startsWith(q)) score = 60;
      if (score < 0 && name.includes(q)) score = 50;
      if (score < 0) return null;

      // Break ties by recency of visit, then lifetime value.
      const recency = c.lastVisit ? new Date(c.lastVisit).getTime() : 0;
      return { customer: c, score, recency, spent: c.totalSpent };
    })
    .filter(Boolean) as {
    customer: Customer;
    score: number;
    recency: number;
    spent: number;
  }[];

  scored.sort(
    (a, b) => b.score - a.score || b.recency - a.recency || b.spent - a.spent,
  );
  return scored.slice(0, limit).map((s) => s.customer);
}

export function useCustomerSearch(query: string) {
  const db = useDb();
  return useMemo(() => searchCustomers(db.customers, query), [db.customers, query]);
}

/** Local YYYY-MM-DD for a timestamp — the day boundary the shop actually uses. */
export function localDayKey(ts: number | string | Date) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}
