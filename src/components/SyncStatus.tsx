"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  Check,
  CloudOff,
  Loader2,
  RefreshCw,
  TriangleAlert,
  Wifi,
} from "lucide-react";
import { clsx } from "@/lib/clsx";
import {
  getServerStatus,
  getStatus,
  startSync,
  subscribeStatus,
  syncNow,
} from "@/lib/sync";

export function useSyncStatus() {
  const status = useSyncExternalStore(subscribeStatus, getStatus, getServerStatus);
  useEffect(() => startSync(), []);
  return status;
}

const LOOK = {
  idle: { icon: Check, tone: "text-emerald-300", label: "Saved to cloud" },
  syncing: { icon: Loader2, tone: "text-brand-200", label: "Saving…" },
  offline: { icon: CloudOff, tone: "text-gold-400", label: "Offline" },
  error: { icon: TriangleAlert, tone: "text-gold-400", label: "Not saved yet" },
  "local-only": { icon: Wifi, tone: "text-brand-300/70", label: "This device only" },
} as const;

/** Compact indicator for the sidebar. */
export function SyncBadge() {
  const status = useSyncStatus();
  const look = LOOK[status.phase];
  const Icon = look.icon;

  return (
    <button
      onClick={() => void syncNow()}
      title={
        status.message ??
        (status.pending
          ? `${status.pending} change${status.pending === 1 ? "" : "s"} waiting to upload`
          : "Everything is saved. Tap to check again.")
      }
      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[11px] font-semibold text-brand-200/70 transition-colors hover:bg-white/10 hover:text-white"
    >
      <Icon
        size={13}
        className={clsx(look.tone, status.phase === "syncing" && "animate-spin")}
      />
      <span className="truncate">{look.label}</span>
      {status.pending > 0 ? (
        <span className="tnum ml-auto rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] text-white">
          {status.pending}
        </span>
      ) : null}
    </button>
  );
}

/** Full panel for the Settings screen. */
export function SyncPanel() {
  const status = useSyncStatus();

  const headline = {
    idle: "Your data is saved in the cloud",
    syncing: "Saving to the cloud…",
    offline: "You're offline right now",
    error: "Couldn't reach the cloud",
    "local-only": "Cloud storage isn't set up yet",
  }[status.phase];

  const body = {
    idle: "Every bill, customer and point is stored on the server. Open this site on any phone or computer and it will all be there.",
    syncing: "Uploading your latest changes.",
    offline:
      "Keep billing as normal — everything is saved on this device and will upload the moment internet comes back.",
    error:
      status.message ??
      "Your work is safe on this device. It will upload automatically once the connection recovers.",
    "local-only":
      "Add a Neon database from your Vercel dashboard (Storage tab) and redeploy. Until then everything stays on this device only.",
  }[status.phase];

  const tone =
    status.phase === "idle"
      ? "bg-emerald-50 text-emerald-900"
      : status.phase === "syncing"
        ? "bg-brand-50 text-brand-900"
        : "bg-gold-100/70 text-gold-600";

  return (
    <div className={clsx("rounded-2xl p-4", tone)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold">{headline}</p>
          <p className="mt-1 text-xs opacity-80">{body}</p>
          {status.pending > 0 ? (
            <p className="tnum mt-1.5 text-xs font-bold">
              {status.pending} change{status.pending === 1 ? "" : "s"} waiting to
              upload.
            </p>
          ) : null}
          {status.lastSyncedAt ? (
            <p className="mt-1.5 text-[11px] opacity-70">
              Last checked{" "}
              {new Date(status.lastSyncedAt).toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          ) : null}
        </div>
        <button
          onClick={() => void syncNow()}
          disabled={status.phase === "syncing"}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-white/70 px-3 text-xs font-bold transition hover:bg-white disabled:opacity-50"
        >
          <RefreshCw
            size={13}
            className={status.phase === "syncing" ? "animate-spin" : ""}
          />
          Sync now
        </button>
      </div>
    </div>
  );
}
