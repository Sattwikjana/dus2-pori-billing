"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Gift, Phone, Search, Ticket, UserPlus, X } from "lucide-react";
import { clsx } from "@/lib/clsx";
import { useCustomerSearch, useDb } from "@/lib/hooks";
import { initials, prettyPhone, relativeDays, rupees } from "@/lib/format";
import { findByReferralCode, saveCustomer } from "@/lib/db";
import type { Customer } from "@/lib/types";
import { Button } from "./ui";

/**
 * Type 4–5 digits of a phone number (or a name) and returning customers
 * surface instantly with their history, so a repeat bill needs no retyping.
 */
export function CustomerPicker({
  selected,
  onSelect,
}: {
  selected: Customer | null;
  onSelect: (c: Customer | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [creating, setCreating] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useCustomerSearch(query);
  const digitsOnly = query.replace(/\D/g, "");
  const canCreate = digitsOnly.length >= 10 && results.length === 0;

  useEffect(() => {
    const onClickAway = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, []);

  function pick(c: Customer) {
    onSelect(c);
    setQuery("");
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[cursor]) pick(results[cursor]);
      else if (canCreate) setCreating(true);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  if (selected) {
    return (
      <SelectedCustomerCard customer={selected} onClear={() => onSelect(null)} />
    );
  }

  return (
    <>
      <div ref={boxRef} className="relative">
        <div className="relative">
          <Search
            size={17}
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-400"
          />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            inputMode="tel"
            autoComplete="off"
            placeholder="Type last 4–5 digits of mobile, or name…"
            className="field h-12 pl-10 text-base font-medium"
          />
          {query ? (
            <button
              onClick={() => setQuery("")}
              className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md p-1 text-ink-400 hover:bg-ink-100"
              aria-label="Clear"
            >
              <X size={15} />
            </button>
          ) : null}
        </div>

        {open && query.trim() ? (
          <div className="animate-pop absolute z-30 mt-2 w-full overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-pop">
            {results.length > 0 ? (
              <ul className="thin-scroll max-h-80 overflow-y-auto py-1">
                {results.map((c, i) => (
                  <li key={c.id}>
                    <button
                      onMouseEnter={() => setCursor(i)}
                      onClick={() => pick(c)}
                      className={clsx(
                        "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
                        i === cursor ? "bg-brand-50" : "hover:bg-ink-50",
                      )}
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-xs font-bold text-white">
                        {initials(c.name)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-bold text-ink-900">
                            {c.name}
                          </span>
                          {c.loyaltyPoints > 0 ? (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-gold-100 px-1.5 py-0.5 text-[10px] font-bold text-gold-600">
                              <Gift size={10} /> {c.loyaltyPoints}
                            </span>
                          ) : null}
                        </span>
                        <span className="tnum mt-0.5 block truncate text-xs text-ink-500">
                          <Highlight text={prettyPhone(c.phone)} match={digitsOnly} />
                          {" · "}
                          {c.visits} visit{c.visits === 1 ? "" : "s"} ·{" "}
                          {relativeDays(c.lastVisit)}
                        </span>
                      </span>
                      <span className="tnum shrink-0 text-right text-xs font-bold text-ink-700">
                        {rupees(c.totalSpent)}
                        <span className="block text-[10px] font-medium text-ink-400">
                          lifetime
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-4 py-6 text-center">
                <p className="text-sm font-semibold text-ink-700">
                  No customer found
                </p>
                <p className="mt-1 text-xs text-ink-500">
                  {digitsOnly.length >= 10
                    ? "Add them as a new customer."
                    : "Keep typing, or enter the full 10-digit number to add a new customer."}
                </p>
              </div>
            )}

            <button
              onClick={() => setCreating(true)}
              className="flex w-full items-center gap-2 border-t border-ink-100 bg-ink-50 px-4 py-3 text-left text-sm font-bold text-brand-700 hover:bg-brand-50"
            >
              <UserPlus size={16} />
              Add new customer
              {digitsOnly.length >= 10 ? (
                <span className="tnum ml-auto text-xs font-semibold text-ink-500">
                  {prettyPhone(digitsOnly)}
                </span>
              ) : null}
            </button>
          </div>
        ) : null}
      </div>

      <NewCustomerModal
        open={creating}
        prefillPhone={digitsOnly.length >= 6 ? digitsOnly.slice(-10) : ""}
        prefillName={/[a-z]/i.test(query) ? query : ""}
        onClose={() => setCreating(false)}
        onCreated={(c) => {
          setCreating(false);
          pick(c);
        }}
      />
    </>
  );
}

function Highlight({ text, match }: { text: string; match: string }) {
  if (!match) return <>{text}</>;
  const stripped = text.replace(/\D/g, "");
  const at = stripped.indexOf(match);
  if (at < 0) return <>{text}</>;

  // Map the digit-index back onto the spaced display string.
  let seen = 0;
  let start = -1;
  let end = -1;
  for (let i = 0; i < text.length; i++) {
    if (/\d/.test(text[i])) {
      if (seen === at) start = i;
      if (seen === at + match.length - 1) {
        end = i + 1;
        break;
      }
      seen++;
    }
  }
  if (start < 0 || end < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, start)}
      <mark className="rounded bg-brand-100 px-0.5 font-bold text-brand-800">
        {text.slice(start, end)}
      </mark>
      {text.slice(end)}
    </>
  );
}

function SelectedCustomerCard({
  customer,
  onClear,
}: {
  customer: Customer;
  onClear: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-brand-200 bg-gradient-to-r from-brand-50 to-white p-3">
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-sm font-bold text-white">
        {initials(customer.name)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-ink-900">{customer.name}</p>
        <p className="tnum flex flex-wrap items-center gap-x-2 text-xs text-ink-600">
          <span className="inline-flex items-center gap-1">
            <Phone size={11} /> {prettyPhone(customer.phone)}
          </span>
          <span className="text-ink-300">|</span>
          <span>{customer.visits} visits</span>
          <span className="text-ink-300">|</span>
          <span>{rupees(customer.totalSpent)} lifetime</span>
        </p>
      </div>
      <div className="hidden shrink-0 text-right sm:block">
        <p className="tnum display text-xl leading-none text-gold-600">
          {customer.loyaltyPoints}
        </p>
        <p className="text-[10px] font-semibold text-ink-500">points</p>
      </div>
      <button
        onClick={onClear}
        className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-400 hover:bg-white hover:text-ink-700"
        aria-label="Change customer"
      >
        <X size={16} />
      </button>
    </div>
  );
}

export function NewCustomerModal(props: {
  open: boolean;
  onClose: () => void;
  onCreated?: (c: Customer) => void;
  prefillPhone?: string;
  prefillName?: string;
  editing?: Customer | null;
}) {
  if (!props.open) return null;
  // Remounting per target gives the form fresh initial values without an
  // effect that syncs props into state.
  return <CustomerForm key={props.editing?.id ?? "new"} {...props} />;
}

function CustomerForm({
  onClose,
  onCreated,
  prefillPhone = "",
  prefillName = "",
  editing,
}: {
  onClose: () => void;
  onCreated?: (c: Customer) => void;
  prefillPhone?: string;
  prefillName?: string;
  editing?: Customer | null;
}) {
  const db = useDb();
  const [form, setForm] = useState({
    name: editing?.name ?? prefillName,
    phone: editing?.phone ?? prefillPhone,
    email: editing?.email ?? "",
    address: editing?.address ?? "",
    birthday: editing?.birthday ?? "",
    notes: editing?.notes ?? "",
    referralCodeUsed: "",
  });
  const [error, setError] = useState("");

  const referral = db.settings.referral;
  // Referral rewards are only paid when the customer is first created.
  const showReferral = !editing && referral.enabled;
  const referrer = showReferral
    ? findByReferralCode(db, form.referralCodeUsed)
    : undefined;
  const badCode =
    showReferral && form.referralCodeUsed.trim().length >= 4 && !referrer;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const phone = form.phone.replace(/\D/g, "");
    if (!form.name.trim()) return setError("Please enter the customer's name.");
    if (phone.length !== 10) return setError("Enter a valid 10-digit mobile number.");

    const clash = db.customers.find(
      (c) => c.phone === phone && c.id !== editing?.id,
    );
    if (clash) return setError(`This number already belongs to ${clash.name}.`);
    if (badCode)
      return setError("That referral code doesn't match any customer.");

    const saved = saveCustomer({
      ...(editing ? { id: editing.id } : {}),
      name: form.name.trim(),
      phone,
      email: form.email.trim() || undefined,
      address: form.address.trim() || undefined,
      birthday: form.birthday || undefined,
      notes: form.notes.trim() || undefined,
      ...(referrer ? { referralCodeUsed: form.referralCodeUsed } : {}),
      ...(editing
        ? {
            loyaltyPoints: editing.loyaltyPoints,
            totalSpent: editing.totalSpent,
            visits: editing.visits,
            lastVisit: editing.lastVisit,
          }
        : {}),
    });
    onCreated?.(saved);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink-900/40 backdrop-blur-[2px]"
      />
      <form
        onSubmit={submit}
        className="animate-slide-up relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-pop sm:max-w-lg sm:rounded-3xl thin-scroll"
      >
        <div className="border-b border-ink-100 px-5 py-4">
          <h3 className="text-base font-bold text-ink-900">
            {editing ? "Edit customer" : "New customer"}
          </h3>
          <p className="mt-0.5 text-xs text-ink-500">
            Mobile number is how you&apos;ll find them next time.
          </p>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div>
            <label className="label">Customer name *</label>
            <input
              autoFocus
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="field"
              placeholder="e.g. Priya Das"
            />
          </div>
          <div>
            <label className="label">Mobile number *</label>
            <input
              value={form.phone}
              onChange={(e) =>
                setForm({ ...form, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })
              }
              inputMode="numeric"
              className="field tnum"
              placeholder="10-digit number"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Birthday (for offers)</label>
              <input
                type="date"
                value={form.birthday}
                onChange={(e) => setForm({ ...form, birthday: e.target.value })}
                className="field"
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="field"
                placeholder="optional"
              />
            </div>
          </div>
          <div>
            <label className="label">Address</label>
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="field"
              placeholder="optional"
            />
          </div>
          <div>
            <label className="label">Notes</label>
            <input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="field"
              placeholder="e.g. prefers matte lipstick, dry skin"
            />
          </div>

          {showReferral ? (
            <div className="rounded-2xl border border-dashed border-brand-200 bg-brand-50/40 p-3.5">
              <label className="label flex items-center gap-1.5">
                <Ticket size={13} /> Referred by a friend?
              </label>
              <input
                value={form.referralCodeUsed}
                onChange={(e) =>
                  setForm({
                    ...form,
                    referralCodeUsed: e.target.value.toUpperCase().slice(0, 12),
                  })
                }
                className="field tnum tracking-widest uppercase"
                placeholder="Enter their referral code"
                autoComplete="off"
              />
              {referrer ? (
                <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                  <Check size={13} /> {referrer.name} gets {referral.referrerBonus}{" "}
                  points
                  {referral.friendBonus > 0
                    ? `, and this customer gets ${referral.friendBonus} welcome points`
                    : ""}
                  .
                </p>
              ) : badCode ? (
                <p className="mt-2 text-xs font-bold text-rose-600">
                  No customer has this code.
                </p>
              ) : (
                <p className="mt-2 text-xs text-ink-500">
                  Optional. Both friends get bonus points.
                </p>
              )}
            </div>
          ) : null}

          {error ? (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex gap-2 border-t border-ink-100 px-5 py-4">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" className="flex-1">
            {editing ? "Save changes" : "Add customer"}
          </Button>
        </div>
      </form>
    </div>
  );
}
