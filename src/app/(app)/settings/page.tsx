"use client";

import { useRef, useState } from "react";
import { Database, Download, ShieldCheck, Trash2, Upload } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { BrandLogo } from "@/components/Brand";
import { SyncPanel } from "@/components/SyncStatus";
import { Button, Card, CardHeader, Toggle } from "@/components/ui";
import { clearAll, exportJson, replaceAll, saveSettings } from "@/lib/db";
import { installDemoData } from "@/lib/seed";
import { useDb, useMounted } from "@/lib/hooks";
import type { Database as Db } from "@/lib/types";

export default function SettingsPage() {
  const db = useDb();
  const mounted = useMounted();
  const fileRef = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState("");

  const s = db.settings;

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  function backup() {
    const url = URL.createObjectURL(
      new Blob([exportJson()], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `dus2pori-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    flash("Backup downloaded ✅");
  }

  function restore(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as Db;
        if (!Array.isArray(parsed.invoices) || !Array.isArray(parsed.customers)) {
          throw new Error("shape");
        }
        if (
          confirm(
            `Restore ${parsed.invoices.length} bills and ${parsed.customers.length} customers? This replaces everything currently on this device.`,
          )
        ) {
          replaceAll(parsed);
          flash("Backup restored ✅");
        }
      } catch {
        alert("That file doesn't look like a Dus2 PORI backup.");
      }
    };
    reader.readAsText(file);
  }

  if (!mounted) return <PageHeader title="Settings" subtitle="Loading…" />;

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Shop details, invoice preferences and your data."
      />

      <div className="mx-auto max-w-3xl space-y-5 px-4 pb-10 sm:px-6">
        {toast ? (
          <div className="animate-pop rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            {toast}
          </div>
        ) : null}

        <Card>
          <CardHeader
            title="Shop details"
            subtitle="These appear on every printed bill."
          />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field
              label="Shop name"
              value={s.shopName}
              onChange={(v) => saveSettings({ shopName: v })}
            />
            <Field
              label="Tagline"
              value={s.tagline}
              onChange={(v) => saveSettings({ tagline: v })}
              placeholder="Cosmetics & Beauty Store"
            />
            <Field
              label="Phone number"
              value={s.phone}
              onChange={(v) => saveSettings({ phone: v })}
              placeholder="98765 43210"
            />
            <Field
              label="UPI ID"
              value={s.upiId}
              onChange={(v) => saveSettings({ upiId: v })}
              placeholder="yourshop@upi"
            />
            <div className="sm:col-span-2">
              <Field
                label="Shop address"
                value={s.address}
                onChange={(v) => saveSettings({ address: v })}
                placeholder="Street, area, city, PIN"
              />
            </div>
            <div className="sm:col-span-2">
              <Field
                label="Invoice footer note"
                value={s.footerNote}
                onChange={(v) => saveSettings({ footerNote: v })}
              />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Billing preferences" />
          <div className="space-y-1 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Invoice prefix"
                value={s.invoicePrefix}
                onChange={(v) =>
                  saveSettings({ invoicePrefix: v.toUpperCase().slice(0, 6) })
                }
                hint={`Next bill will be ${s.invoicePrefix}-${String(s.nextInvoiceNo).padStart(4, "0")}`}
              />
              <Field
                label="Next invoice number"
                value={String(s.nextInvoiceNo)}
                onChange={(v) =>
                  saveSettings({ nextInvoiceNo: Math.max(1, Number(v) || 1) })
                }
                numeric
              />
            </div>

            <div className="mt-2 divide-y divide-ink-100">
              <Toggle
                checked={s.roundOffEnabled}
                onChange={(v) => saveSettings({ roundOffEnabled: v })}
                label="Round off bill total"
                hint="₹499.60 becomes ₹500 — easier for cash."
              />
              <Toggle
                checked={s.gstEnabled}
                onChange={(v) => saveSettings({ gstEnabled: v })}
                label="Charge GST on bills"
                hint="Turn on only if you bill with GST. Off by default."
              />
            </div>

            {s.gstEnabled ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field
                  label="GSTIN"
                  value={s.gstin}
                  onChange={(v) => saveSettings({ gstin: v.toUpperCase() })}
                  placeholder="19ABCDE1234F1Z5"
                />
                <Field
                  label="Default GST rate (%)"
                  value={String(s.defaultTaxRate)}
                  onChange={(v) => saveSettings({ defaultTaxRate: Number(v) || 0 })}
                  numeric
                />
              </div>
            ) : null}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Your data"
            subtitle="Stored in the cloud, and kept on this device so billing works offline."
          />
          <div className="space-y-4 p-5">
            <SyncPanel />

            <div className="flex items-start gap-3 rounded-2xl bg-brand-50 p-4">
              <ShieldCheck size={18} className="mt-0.5 shrink-0 text-brand-600" />
              <div className="text-xs text-brand-900">
                <p className="font-bold">A monthly backup is still worth keeping.</p>
                <p className="mt-0.5 text-brand-800/80">
                  The cloud copy is your safety net for a lost or wiped phone. A
                  downloaded backup file protects against the other kind of mistake —
                  data deleted by accident — so save one to Google Drive now and then.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <StatBox label="Bills" value={db.invoices.length} />
              <StatBox label="Customers" value={db.customers.length} />
              <StatBox label="Products" value={db.items.length} />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={backup}>
                <Download size={15} /> Download backup
              </Button>
              <Button variant="secondary" onClick={() => fileRef.current?.click()}>
                <Upload size={15} /> Restore backup
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) restore(f);
                  e.target.value = "";
                }}
              />
              <Button
                variant="secondary"
                onClick={() => {
                  if (
                    confirm(
                      "Load sample products, customers and bills? This replaces your current data.",
                    )
                  ) {
                    installDemoData();
                    flash("Demo data loaded ✅");
                  }
                }}
              >
                <Database size={15} /> Load demo data
              </Button>
            </div>

            <div className="border-t border-ink-100 pt-4">
              <Button
                variant="danger"
                onClick={() => {
                  if (
                    confirm(
                      "Delete ALL bills, customers and products from this device? Download a backup first — this cannot be undone.",
                    ) &&
                    confirm("Are you absolutely sure?")
                  ) {
                    clearAll();
                    flash("All data cleared");
                  }
                }}
              >
                <Trash2 size={15} /> Erase everything
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="About" />
          <div className="flex items-start gap-3 p-5">
            <BrandLogo width={96} />
            <div className="text-xs text-ink-600">
              <p className="text-sm font-bold text-ink-900">
                Dus2 PORI — Billing &amp; Loyalty
              </p>
              <p className="mt-1">
                Free billing software built for this shop. Works offline once loaded, and
                can be installed on an Android phone from the browser menu →{" "}
                <strong>Add to Home screen</strong>.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  hint,
  numeric,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  numeric?: boolean;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={numeric ? "numeric" : undefined}
        className={`field ${numeric ? "tnum" : ""}`}
      />
      {hint ? <p className="mt-1 text-[11px] text-ink-500">{hint}</p> : null}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-ink-100 p-3 text-center">
      <p className="tnum text-xl font-extrabold text-ink-900">{value}</p>
      <p className="text-[11px] font-semibold text-ink-500">{label}</p>
    </div>
  );
}
