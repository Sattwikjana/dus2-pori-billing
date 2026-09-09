"use client";

import type {
  Customer,
  Database,
  Expense,
  Invoice,
  Item,
  Settings,
} from "./types";

const KEY = "dus2pori:db:v1";
const VERSION = 1;

export const DEFAULT_SETTINGS: Settings = {
  shopName: "Dus2 PORI",
  tagline: "Cosmetics & Beauty Store",
  phone: "",
  address: "",
  gstin: "",
  upiId: "",
  invoicePrefix: "DP",
  nextInvoiceNo: 1,
  gstEnabled: false,
  defaultTaxRate: 18,
  roundOffEnabled: true,
  loyalty: {
    enabled: true,
    pointsPer100: 5,
    rupeesPerPoint: 1,
    minRedeem: 50,
    birthdayBonus: 100,
  },
  footerNote: "Thank you for shopping with us! Visit again 💜",
};

function emptyDb(): Database {
  return {
    version: VERSION,
    settings: { ...DEFAULT_SETTINGS },
    customers: [],
    items: [],
    invoices: [],
    expenses: [],
  };
}

// ── Store internals ─────────────────────────────────────────────────────

let cache: Database | null = null;
const listeners = new Set<() => void>();

function read(): Database {
  if (cache) return cache;
  if (typeof window === "undefined") return (cache = emptyDb());
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return (cache = emptyDb());
    const parsed = JSON.parse(raw) as Database;
    // Merge defaults so older saves gain any newly added settings.
    cache = {
      ...emptyDb(),
      ...parsed,
      settings: {
        ...DEFAULT_SETTINGS,
        ...parsed.settings,
        loyalty: { ...DEFAULT_SETTINGS.loyalty, ...parsed.settings?.loyalty },
      },
    };
    return cache;
  } catch {
    return (cache = emptyDb());
  }
}

function persist(next: Database) {
  cache = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch (err) {
      console.error("Could not save data — storage may be full.", err);
    }
  }
  listeners.forEach((l) => l());
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  if (typeof window !== "undefined") {
    // Keep multiple tabs of the shop in sync.
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) {
        cache = null;
        listener();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  }
  return () => listeners.delete(listener);
}

export function getSnapshot(): Database {
  return read();
}

const SERVER_SNAPSHOT = emptyDb();
export function getServerSnapshot(): Database {
  return SERVER_SNAPSHOT;
}

export function update(fn: (db: Database) => Database) {
  persist(fn(read()));
}

export function replaceAll(next: Database) {
  persist({
    ...emptyDb(),
    ...next,
    settings: { ...DEFAULT_SETTINGS, ...next.settings },
    version: VERSION,
  });
}

export function uid(prefix = "") {
  return (
    prefix +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8)
  );
}

// ── Mutations ───────────────────────────────────────────────────────────

export function saveCustomer(
  input: Omit<Customer, "id" | "createdAt" | "loyaltyPoints" | "totalSpent" | "visits"> &
    Partial<Pick<Customer, "id" | "loyaltyPoints" | "totalSpent" | "visits" | "lastVisit">>,
): Customer {
  let saved!: Customer;
  update((db) => {
    const existingIdx = input.id
      ? db.customers.findIndex((c) => c.id === input.id)
      : db.customers.findIndex((c) => c.phone === input.phone);

    if (existingIdx >= 0) {
      const prev = db.customers[existingIdx];
      saved = { ...prev, ...input, id: prev.id };
      const customers = [...db.customers];
      customers[existingIdx] = saved;
      return { ...db, customers };
    }

    saved = {
      loyaltyPoints: 0,
      totalSpent: 0,
      visits: 0,
      ...input,
      id: input.id ?? uid("c_"),
      createdAt: new Date().toISOString(),
    } as Customer;
    return { ...db, customers: [saved, ...db.customers] };
  });
  return saved;
}

export function deleteCustomer(id: string) {
  update((db) => ({ ...db, customers: db.customers.filter((c) => c.id !== id) }));
}

export function saveItem(
  input: Omit<Item, "id" | "createdAt"> & Partial<Pick<Item, "id">>,
): Item {
  let saved!: Item;
  update((db) => {
    if (input.id) {
      const items = db.items.map((i) =>
        i.id === input.id ? ((saved = { ...i, ...input } as Item), saved) : i,
      );
      return { ...db, items };
    }
    saved = { ...input, id: uid("i_"), createdAt: new Date().toISOString() } as Item;
    return { ...db, items: [saved, ...db.items] };
  });
  return saved;
}

export function deleteItem(id: string) {
  update((db) => ({ ...db, items: db.items.filter((i) => i.id !== id) }));
}

export function saveExpense(
  input: Omit<Expense, "id" | "createdAt"> & Partial<Pick<Expense, "id">>,
): Expense {
  let saved!: Expense;
  update((db) => {
    if (input.id) {
      const expenses = db.expenses.map((e) =>
        e.id === input.id ? ((saved = { ...e, ...input } as Expense), saved) : e,
      );
      return { ...db, expenses };
    }
    saved = {
      ...input,
      id: uid("e_"),
      createdAt: new Date().toISOString(),
    } as Expense;
    return { ...db, expenses: [saved, ...db.expenses] };
  });
  return saved;
}

export function deleteExpense(id: string) {
  update((db) => ({ ...db, expenses: db.expenses.filter((e) => e.id !== id) }));
}

export function saveSettings(patch: Partial<Settings>) {
  update((db) => ({ ...db, settings: { ...db.settings, ...patch } }));
}

/**
 * Commits a bill: stores the invoice, decrements stock, and updates the
 * customer's spend / visits / loyalty balance in a single write.
 */
export function commitInvoice(
  invoice: Omit<Invoice, "id" | "number" | "createdAt">,
): Invoice {
  let saved!: Invoice;
  update((db) => {
    const number = `${db.settings.invoicePrefix}-${String(
      db.settings.nextInvoiceNo,
    ).padStart(4, "0")}`;

    saved = {
      ...invoice,
      id: uid("inv_"),
      number,
      createdAt: new Date().toISOString(),
    };

    // Reduce stock for every line linked to a catalogue item.
    const items = db.items.map((it) => {
      const sold = saved.lines
        .filter((l) => l.itemId === it.id)
        .reduce((s, l) => s + l.qty, 0);
      return sold ? { ...it, stock: it.stock - sold } : it;
    });

    const customers = db.customers.map((c) => {
      if (c.id !== saved.customerId) return c;
      return {
        ...c,
        visits: c.visits + 1,
        totalSpent: c.totalSpent + saved.total,
        lastVisit: saved.date,
        loyaltyPoints: c.loyaltyPoints - saved.pointsRedeemed + saved.pointsEarned,
      };
    });

    return {
      ...db,
      items,
      customers,
      invoices: [saved, ...db.invoices],
      settings: { ...db.settings, nextInvoiceNo: db.settings.nextInvoiceNo + 1 },
    };
  });
  return saved;
}

/** Reverses an invoice's effect on stock, spend and points, then removes it. */
export function deleteInvoice(id: string) {
  update((db) => {
    const inv = db.invoices.find((i) => i.id === id);
    if (!inv) return db;

    const items = db.items.map((it) => {
      const sold = inv.lines
        .filter((l) => l.itemId === it.id)
        .reduce((s, l) => s + l.qty, 0);
      return sold ? { ...it, stock: it.stock + sold } : it;
    });

    const customers = db.customers.map((c) => {
      if (c.id !== inv.customerId) return c;
      return {
        ...c,
        visits: Math.max(0, c.visits - 1),
        totalSpent: Math.max(0, c.totalSpent - inv.total),
        loyaltyPoints: Math.max(
          0,
          c.loyaltyPoints - inv.pointsEarned + inv.pointsRedeemed,
        ),
      };
    });

    return { ...db, items, customers, invoices: db.invoices.filter((i) => i.id !== id) };
  });
}

export function recordPayment(id: string, amount: number) {
  update((db) => ({
    ...db,
    invoices: db.invoices.map((inv) => {
      if (inv.id !== id) return inv;
      const paid = Math.min(inv.total, inv.paid + amount);
      const due = Math.max(0, inv.total - paid);
      return {
        ...inv,
        paid,
        due,
        status: due <= 0 ? "paid" : paid > 0 ? "partial" : "unpaid",
      };
    }),
  }));
}

export function exportJson(): string {
  return JSON.stringify(read(), null, 2);
}

export function clearAll() {
  persist(emptyDb());
}
