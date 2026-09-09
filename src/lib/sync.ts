"use client";

import {
  applyRemote,
  clearPending,
  collectPending,
  getSyncState,
  markEverythingPending,
  setCursor,
  subscribeSync,
  type RemoteRecord,
} from "./db";

export type SyncPhase =
  | "idle"
  | "syncing"
  | "offline"
  | "error"
  | "local-only";

export interface SyncStatus {
  phase: SyncPhase;
  pending: number;
  lastSyncedAt: string | null;
  message?: string;
}

let status: SyncStatus = { phase: "idle", pending: 0, lastSyncedAt: null };
const listeners = new Set<() => void>();

function emit(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch, pending: getSyncState().pending.length };
  listeners.forEach((l) => l());
}

export function subscribeStatus(listener: () => void) {
  listeners.add(listener);
  const stopSync = subscribeSync(listener);
  return () => {
    listeners.delete(listener);
    stopSync();
  };
}

export function getStatus(): SyncStatus {
  return status;
}

const IDLE_STATUS: SyncStatus = { phase: "idle", pending: 0, lastSyncedAt: null };
export function getServerStatus(): SyncStatus {
  return IDLE_STATUS;
}

// ── The sync loop ───────────────────────────────────────────────────────

/** Pushes in batches so one huge first upload doesn't hit the request limit. */
const PUSH_BATCH = 400;

let running: Promise<void> | null = null;
let queuedAgain = false;

async function pull() {
  let cursor = getSyncState().cursor;
  for (let page = 0; page < 50; page++) {
    const res = await fetch(`/api/sync?since=${encodeURIComponent(cursor ?? "")}`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Pull failed (${res.status})`);
    const body = (await res.json()) as {
      cloud: boolean;
      rows?: RemoteRecord[];
      cursor?: string;
      hasMore?: boolean;
      error?: string;
    };
    if (!body.cloud) return false;
    if (body.error) throw new Error(body.error);

    applyRemote(body.rows ?? []);
    if (body.cursor) {
      cursor = body.cursor;
      setCursor(body.cursor);
    }
    if (!body.hasMore) break;
  }
  return true;
}

async function push() {
  const outstanding = collectPending();
  for (let i = 0; i < outstanding.length; i += PUSH_BATCH) {
    const batch = outstanding.slice(i, i + PUSH_BATCH);
    const res = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        records: batch.map(({ kind, id, data, deleted }) => ({
          kind,
          id,
          data,
          deleted,
        })),
      }),
    });
    if (!res.ok) throw new Error(`Save failed (${res.status})`);
    const body = (await res.json()) as { cloud: boolean };
    if (!body.cloud) return false;

    // Only forget a record once the server has confirmed it.
    clearPending(batch.map((r) => r.key));
  }
  return true;
}

/**
 * One full exchange: send what we owe, then take what's new. Concurrent calls
 * collapse into a single run followed by at most one repeat.
 */
export function syncNow(): Promise<void> {
  if (running) {
    queuedAgain = true;
    return running;
  }

  running = (async () => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      emit({ phase: "offline", message: "No internet — saved on this device." });
      return;
    }

    emit({ phase: "syncing" });
    try {
      // Push first so local work is never overwritten by an older server copy.
      const cloud = await push();
      if (!cloud) {
        emit({ phase: "local-only", message: "Cloud storage is not set up yet." });
        return;
      }
      await pull();
      emit({
        phase: "idle",
        lastSyncedAt: new Date().toISOString(),
        message: undefined,
      });
    } catch (err) {
      // A rejected fetch means the network dropped, whatever navigator.onLine
      // claims — captive wifi and flaky mobile data both look like this.
      const networkDown =
        (typeof navigator !== "undefined" && !navigator.onLine) ||
        err instanceof TypeError;
      emit({
        phase: networkDown ? "offline" : "error",
        message: networkDown
          ? "No internet — saved on this device."
          : "Couldn't reach the cloud just now. Your work is safe on this device.",
      });
    }
  })().finally(() => {
    running = null;
    if (queuedAgain) {
      queuedAgain = false;
      void syncNow();
    }
  });

  return running;
}

let started = false;

/** Wires sync to the app lifecycle. Safe to call more than once. */
export function startSync() {
  if (started || typeof window === "undefined") return;
  started = true;

  // A shop that has never synced needs its existing records uploading once.
  if (getSyncState().cursor === null) markEverythingPending();

  const kick = () => void syncNow();

  kick();
  // Local edits mark records dirty; a short debounce batches a burst of them.
  let debounce: ReturnType<typeof setTimeout> | undefined;
  subscribeSync(() => {
    if (!getSyncState().pending.length) return;
    clearTimeout(debounce);
    debounce = setTimeout(kick, 1200);
  });

  window.addEventListener("online", kick);
  window.addEventListener("focus", kick);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") kick();
  });
  window.addEventListener("offline", () =>
    emit({ phase: "offline", message: "No internet — saved on this device." }),
  );

  // Catches changes made on another device while this one sits open.
  setInterval(kick, 60_000);
}
