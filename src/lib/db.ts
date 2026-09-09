"use client";

import type {
  Customer,
  Database,
  Expense,
  Invoice,
  Item,
  PointsEntry,
  PointsReason,
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
  referral: {
    enabled: true,
    referrerBonus: 50,
    friendBonus: 25,
    firstPurchasePercent: 5,
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
    pointsLog: [],
  };
}

// ── Referral codes ──────────────────────────────────────────────────────

function hash32(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * A short, sayable code like `PRIY482`. Derived from the customer id, so it is
 * stable for a given customer and identical every time it is recomputed — that
 * lets older records without a stored code be backfilled on read without
 * writing to storage.
 */
export function deriveReferralCode(id: string, name: string) {
  const letters = name.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
  return `${(letters || "PORI").padEnd(4, "X")}${String(hash32(id) % 1000).padStart(3, "0")}`;
}

export function findByReferralCode(db: Database, code: string) {
  const wanted = code.trim().toUpperCase().replace(/\s+/g, "");
  if (!wanted) return undefined;
  return db.customers.find((c) => c.referralCode.toUpperCase() === wanted);
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
        referral: { ...DEFAULT_SETTINGS.referral, ...parsed.settings?.referral },
      },
      customers: (parsed.customers ?? []).map((c) =>
        c.referralCode
          ? c
          : { ...c, referralCode: deriveReferralCode(c.id, c.name) },
      ),
    };
    return cache;
  } catch {
    return (cache = emptyDb());
  }
}

function writeLocal(next: Database) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch (err) {
    console.error("Could not save data — storage may be full.", err);
  }
}

function persist(next: Database, markDirty = true) {
  const prev = cache;
  cache = next;
  writeLocal(next);
  // Anything that changed locally is owed to the server.
  if (markDirty && prev) addPending(diffDirty(prev, next));
  listeners.forEach((l) => l());
}

// ── Change tracking for cloud sync ──────────────────────────────────────

const SYNC_KEY = "dus2pori:sync:v1";

/** Record collections, keyed the same way on the client and the server. */
export const SYNC_KINDS = [
  "customers",
  "items",
  "invoices",
  "expenses",
  "pointsLog",
] as const;
export type SyncKind = (typeof SYNC_KINDS)[number];

/** Settings is a single record, so it needs a fixed id. */
export const SETTINGS_ID = "shop";

interface SyncState {
  /** Server timestamp of the last successful pull. */
  cursor: string | null;
  /** `kind:id` of every record not yet accepted by the server. */
  pending: string[];
}

let syncState: SyncState | null = null;
const syncListeners = new Set<() => void>();

function readSync(): SyncState {
  if (syncState) return syncState;
  if (typeof window === "undefined") return (syncState = { cursor: null, pending: [] });
  try {
    const raw = window.localStorage.getItem(SYNC_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<SyncState>) : null;
    syncState = {
      cursor: parsed?.cursor ?? null,
      pending: Array.isArray(parsed?.pending) ? parsed.pending : [],
    };
  } catch {
    syncState = { cursor: null, pending: [] };
  }
  return syncState;
}

function writeSync(next: SyncState) {
  syncState = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(SYNC_KEY, JSON.stringify(next));
    } catch {
      // A full disk shouldn't take the app down; the next write will retry.
    }
  }
  syncListeners.forEach((l) => l());
}

export function subscribeSync(listener: () => void) {
  syncListeners.add(listener);
  return () => syncListeners.delete(listener);
}

export function getSyncState(): SyncState {
  return readSync();
}

function addPending(keys: string[]) {
  if (!keys.length) return;
  const state = readSync();
  const merged = new Set(state.pending);
  for (const k of keys) merged.add(k);
  if (merged.size === state.pending.length) return;
  writeSync({ ...state, pending: [...merged] });
}

export function clearPending(keys: string[]) {
  const state = readSync();
  const done = new Set(keys);
  const left = state.pending.filter((k) => !done.has(k));
  if (left.length !== state.pending.length) writeSync({ ...state, pending: left });
}

export function setCursor(cursor: string) {
  writeSync({ ...readSync(), cursor });
}

/** Queues every local record for upload — used the first time a shop connects. */
export function markEverythingPending() {
  const db = read();
  const keys: string[] = [`settings:${SETTINGS_ID}`];
  for (const kind of SYNC_KINDS) {
    for (const row of db[kind]) keys.push(`${kind}:${row.id}`);
  }
  addPending(keys);
}

/**
 * Mutations rebuild only the objects they touch, so an identity check is
 * enough to spot what changed — and an id present before but absent after is
 * a delete, which the server stores as a tombstone.
 */
function diffDirty(prev: Database, next: Database): string[] {
  const keys: string[] = [];
  for (const kind of SYNC_KINDS) {
    const before = new Map(prev[kind].map((r) => [r.id, r] as const));
    for (const row of next[kind]) {
      if (before.get(row.id) !== row) keys.push(`${kind}:${row.id}`);
      before.delete(row.id);
    }
    for (const id of before.keys()) keys.push(`${kind}:${id}`);
  }
  if (prev.settings !== next.settings) keys.push(`settings:${SETTINGS_ID}`);
  return keys;
}

export interface RemoteRecord {
  kind: string;
  id: string;
  data: unknown;
  updatedAt: string;
  deleted: boolean;
}

/** Every list is shown newest-first, but they don't all date the same field. */
const SORT_KEY: { [K in SyncKind]: (row: Database[K][number]) => string } = {
  customers: (c) => c.createdAt,
  items: (i) => i.createdAt,
  invoices: (i) => i.date,
  expenses: (e) => e.date,
  pointsLog: (p) => p.date,
};

function mergeKind<K extends SyncKind>(
  target: Database,
  kind: K,
  rows: RemoteRecord[],
): boolean {
  const incoming = rows.filter((r) => r.kind === kind);
  if (!incoming.length) return false;

  type Row = Database[K][number];
  const byId = new Map<string, Row>(
    (target[kind] as Row[]).map((r) => [r.id, r] as const),
  );
  for (const row of incoming) {
    if (row.deleted) byId.delete(row.id);
    else byId.set(row.id, row.data as Row);
  }

  const key = SORT_KEY[kind] as (row: Row) => string;
  target[kind] = [...byId.values()].sort((a, b) =>
    key(b).localeCompare(key(a)),
  ) as Database[K];
  return true;
}

/**
 * Folds server records into the local copy. Applied changes are not marked
 * dirty — they already live on the server.
 */
export function applyRemote(rows: RemoteRecord[]) {
  if (!rows.length) return;
  const next: Database = { ...read() };
  let changed = false;

  for (const kind of SYNC_KINDS) {
    if (mergeKind(next, kind, rows)) changed = true;
  }

  const remoteSettings = rows.find(
    (r) => r.kind === "settings" && r.id === SETTINGS_ID && !r.deleted,
  );
  if (remoteSettings) {
    const incoming = remoteSettings.data as Settings;
    next.settings = {
      ...DEFAULT_SETTINGS,
      ...incoming,
      loyalty: { ...DEFAULT_SETTINGS.loyalty, ...incoming.loyalty },
      referral: { ...DEFAULT_SETTINGS.referral, ...incoming.referral },
      // Never hand back a bill number this device has already used.
      nextInvoiceNo: Math.max(
        incoming.nextInvoiceNo ?? 1,
        next.settings.nextInvoiceNo ?? 1,
      ),
    };
    changed = true;
  }

  if (changed) persist(next, false);
}

/** The records the server is still owed, resolved against current state. */
export function collectPending() {
  const db = read();
  const state = readSync();
  return state.pending.map((key) => {
    const sep = key.indexOf(":");
    const kind = key.slice(0, sep);
    const id = key.slice(sep + 1);

    if (kind === "settings") {
      return { key, kind, id, data: db.settings, deleted: false };
    }
    const row = (db[kind as SyncKind] ?? []).find((r) => r.id === id);
    return row
      ? { key, kind, id, data: row, deleted: false }
      : { key, kind, id, data: null, deleted: true };
  });
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
  // A restore or demo load rewrites everything, so queue the lot.
  markEverythingPending();
}

export function uid(prefix = "") {
  return (
    prefix +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8)
  );
}

// ── Mutations ───────────────────────────────────────────────────────────

function entry(
  customerId: string,
  points: number,
  reason: PointsReason,
  note?: string,
  invoiceId?: string,
): PointsEntry {
  return {
    id: uid("p_"),
    customerId,
    date: new Date().toISOString(),
    points,
    reason,
    note,
    invoiceId,
  };
}

export type CustomerInput = Omit<
  Customer,
  "id" | "createdAt" | "loyaltyPoints" | "totalSpent" | "visits" | "referralCode"
> &
  Partial<
    Pick<
      Customer,
      "id" | "loyaltyPoints" | "totalSpent" | "visits" | "lastVisit" | "referralCode"
    >
  > & {
    /** Code the new customer was referred with, entered at signup. */
    referralCodeUsed?: string;
  };

export function saveCustomer(input: CustomerInput): Customer {
  let saved!: Customer;
  update((db) => {
    const { referralCodeUsed, ...fields } = input;

    const existingIdx = fields.id
      ? db.customers.findIndex((c) => c.id === fields.id)
      : db.customers.findIndex((c) => c.phone === fields.phone);

    // Editing an existing customer never re-runs referral rewards.
    if (existingIdx >= 0) {
      const prev = db.customers[existingIdx];
      saved = { ...prev, ...fields, id: prev.id, referralCode: prev.referralCode };
      const customers = [...db.customers];
      customers[existingIdx] = saved;
      return { ...db, customers };
    }

    const id = fields.id ?? uid("c_");
    const referrer = db.settings.referral.enabled
      ? referralCodeUsed
        ? findByReferralCode(db, referralCodeUsed)
        : undefined
      : undefined;

    const { referrerBonus, friendBonus } = db.settings.referral;
    const welcome = referrer ? friendBonus : 0;

    saved = {
      loyaltyPoints: 0,
      totalSpent: 0,
      visits: 0,
      ...fields,
      id,
      referralCode: fields.referralCode ?? deriveReferralCode(id, fields.name),
      referredBy: referrer?.id,
      createdAt: new Date().toISOString(),
    } as Customer;
    saved.loyaltyPoints += welcome;

    const log: PointsEntry[] = [];
    if (referrer) {
      if (welcome > 0) {
        log.push(
          entry(saved.id, welcome, "referral-welcome", `Joined using ${referrer.name}'s code`),
        );
      }
      if (referrerBonus > 0) {
        log.push(
          entry(referrer.id, referrerBonus, "referral-reward", `Referred ${saved.name}`),
        );
      }
    }

    const customers = [saved, ...db.customers].map((c) =>
      referrer && c.id === referrer.id
        ? { ...c, loyaltyPoints: c.loyaltyPoints + referrerBonus }
        : c,
    );

    return { ...db, customers, pointsLog: [...log, ...db.pointsLog] };
  });
  return saved;
}

/** Hand-adjust a balance (a goodwill gift, or fixing a mistake). */
export function adjustPoints(customerId: string, points: number, note: string) {
  update((db) => ({
    ...db,
    customers: db.customers.map((c) =>
      c.id === customerId
        ? { ...c, loyaltyPoints: Math.max(0, c.loyaltyPoints + points) }
        : c,
    ),
    pointsLog: [entry(customerId, points, "manual", note), ...db.pointsLog],
  }));
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

    const buyer = db.customers.find((c) => c.id === saved.customerId);
    const log: PointsEntry[] = [];

    if (buyer) {
      if (saved.pointsRedeemed > 0) {
        log.push(
          entry(buyer.id, -saved.pointsRedeemed, "redeem", `Used on ${number}`, saved.id),
        );
      }
      if (saved.pointsEarned > 0) {
        log.push(
          entry(buyer.id, saved.pointsEarned, "purchase", `Bill ${number}`, saved.id),
        );
      }
    }

    // The referrer's cut of their friend's first purchase, paid once.
    const { enabled: referralOn, firstPurchasePercent } = db.settings.referral;
    const referrerId =
      referralOn &&
      firstPurchasePercent > 0 &&
      buyer?.referredBy &&
      !buyer.referralRewarded
        ? buyer.referredBy
        : undefined;
    const referrerPoints = referrerId
      ? Math.floor((saved.total * firstPurchasePercent) / 100)
      : 0;

    if (referrerId && referrerPoints > 0) {
      log.push(
        entry(
          referrerId,
          referrerPoints,
          "referral-purchase",
          `${firstPurchasePercent}% of ${buyer!.name}'s first purchase`,
          saved.id,
        ),
      );
    }

    const customers = db.customers.map((c) => {
      if (c.id === saved.customerId) {
        return {
          ...c,
          visits: c.visits + 1,
          totalSpent: c.totalSpent + saved.total,
          lastVisit: saved.date,
          loyaltyPoints:
            c.loyaltyPoints - saved.pointsRedeemed + saved.pointsEarned,
          referralRewarded: referrerId ? true : c.referralRewarded,
        };
      }
      if (c.id === referrerId) {
        return { ...c, loyaltyPoints: c.loyaltyPoints + referrerPoints };
      }
      return c;
    });

    return {
      ...db,
      items,
      customers,
      invoices: [saved, ...db.invoices],
      pointsLog: [...log, ...db.pointsLog],
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

    return {
      ...db,
      items,
      customers,
      invoices: db.invoices.filter((i) => i.id !== id),
      pointsLog: db.pointsLog.filter((p) => p.invoiceId !== id),
    };
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
  const before = read();
  persist(emptyDb());
  // Tombstone every record that existed, so other devices drop them too.
  const keys: string[] = [`settings:${SETTINGS_ID}`];
  for (const kind of SYNC_KINDS) {
    for (const row of before[kind]) keys.push(`${kind}:${row.id}`);
  }
  addPending(keys);
}
