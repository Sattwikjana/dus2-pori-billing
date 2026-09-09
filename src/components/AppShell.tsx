"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  Gift,
  LayoutDashboard,
  LogOut,
  Menu,
  NotebookPen,
  Package,
  Plus,
  ReceiptText,
  Settings as SettingsIcon,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { BrandLogo } from "./Brand";
import { clsx } from "@/lib/clsx";
import { localDayKey, useDb, useMounted, useNow } from "@/lib/hooks";
import { rupeesShort } from "@/lib/format";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/billing", label: "New Bill", icon: Plus },
  { href: "/invoices", label: "Invoices", icon: ReceiptText },
  { href: "/items", label: "Products", icon: Package },
  { href: "/khata", label: "Khata / Dues", icon: NotebookPen },
  { href: "/expenses", label: "Expenses", icon: Wallet },
  { href: "/loyalty", label: "Loyalty", icon: Gift },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const db = useDb();
  const mounted = useMounted();
  const now = useNow();

  const todayKey = localDayKey(now);
  const todaySales = db.invoices
    .filter((i) => localDayKey(i.date) === todayKey)
    .reduce((s, i) => s + i.total, 0);

  return (
    <div className="min-h-dvh lg:flex">
      {/* Mobile top bar */}
      <header className="no-print sticky top-0 z-30 flex items-center gap-3 border-b border-ink-200 bg-white/90 px-4 py-3 backdrop-blur-xl lg:hidden">
        <button
          onClick={() => setOpen(true)}
          className="grid size-9 place-items-center rounded-xl border border-ink-200 text-ink-600 transition hover:bg-ink-50"
          aria-label="Open menu"
        >
          <Menu size={18} />
        </button>
        <BrandLogo width={104} priority />
        <Link
          href="/billing"
          className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 text-xs font-bold text-white shadow-sm shadow-brand-600/30"
        >
          <Plus size={15} /> Bill
        </Link>
      </header>

      {open ? (
        <div className="no-print fixed inset-0 z-40 lg:hidden">
          <button
            className="absolute inset-0 bg-plum-950/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          />
          <div className="animate-slide-up relative h-full w-72 max-w-[82%]">
            <SidebarInner
              pathname={pathname}
              todaySales={mounted ? todaySales : 0}
              shopName={db.settings.shopName}
              onClose={() => setOpen(false)}
            />
          </div>
        </div>
      ) : null}

      {/* Desktop sidebar */}
      <aside className="no-print sticky top-0 hidden h-dvh w-64 shrink-0 lg:block">
        <SidebarInner
          pathname={pathname}
          todaySales={mounted ? todaySales : 0}
          shopName={db.settings.shopName}
        />
      </aside>

      <main className="min-w-0 flex-1 pb-20 lg:pb-0">{children}</main>
    </div>
  );
}

function SidebarInner({
  pathname,
  todaySales,
  shopName,
  onClose,
}: {
  pathname: string;
  todaySales: number;
  shopName: string;
  onClose?: () => void;
}) {
  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-plum-950 text-brand-100">
      {/* Soft brand glow so the dark panel doesn't read flat. */}
      <div className="pointer-events-none absolute -top-28 -left-20 size-72 rounded-full bg-brand-600/25 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-10 size-64 rounded-full bg-brand-500/10 blur-3xl" />

      <div className="relative flex items-start gap-2 px-5 pt-6 pb-5">
        <BrandLogo width={150} priority />
        {onClose ? (
          <button
            onClick={onClose}
            className="ml-auto grid size-8 place-items-center rounded-lg text-brand-300 transition hover:bg-white/10"
            aria-label="Close menu"
          >
            <X size={16} />
          </button>
        ) : null}
      </div>

      <div className="relative mx-4 mb-5 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-700 to-plum-800 p-4 ring-1 ring-white/15">
        <div className="pointer-events-none absolute -top-8 -right-8 size-24 rounded-full bg-white/15 blur-2xl" />
        <p className="relative text-[10px] font-bold tracking-[0.14em] text-white/70 uppercase">
          Today&apos;s sale
        </p>
        <p className="tnum display relative mt-1 text-[26px] leading-none text-white">
          {rupeesShort(todaySales)}
        </p>
        <Link
          href="/billing"
          onClick={onClose}
          className="relative mt-3.5 flex h-9 items-center justify-center gap-1.5 rounded-xl bg-white text-xs font-bold text-brand-700 shadow-sm transition hover:bg-brand-50"
        >
          <Plus size={15} /> Create New Bill
        </Link>
      </div>

      <nav
        className="thin-scroll relative flex-1 space-y-0.5 overflow-y-auto px-3 pb-4"
        onClick={onClose}
      >
        {NAV.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all",
                active
                  ? "bg-white/12 text-white shadow-sm"
                  : "text-brand-200/75 hover:bg-white/8 hover:text-white",
              )}
            >
              {active ? (
                <span className="absolute top-1/2 left-0 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-gradient-to-b from-brand-400 to-gold-400" />
              ) : null}
              <Icon
                size={17}
                className={clsx(
                  "transition-colors",
                  active ? "text-brand-300" : "text-brand-300/60 group-hover:text-brand-300",
                )}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="relative border-t border-white/10 px-4 py-3">
        <p className="truncate px-1 text-xs font-bold text-white">{shopName}</p>
        <p className="mt-0.5 px-1 text-[11px] text-brand-300/70">
          Data saved on this device
        </p>
        <form action="/api/auth/logout" method="post" className="mt-2.5">
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-brand-200/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogOut size={15} /> Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
