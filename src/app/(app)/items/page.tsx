"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Package, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Badge, Button, Card, EmptyState, Modal } from "@/components/ui";
import { clsx } from "@/lib/clsx";
import { deleteItem, saveItem } from "@/lib/db";
import { rupees } from "@/lib/format";
import { useDb, useMounted } from "@/lib/hooks";
import type { Item } from "@/lib/types";

const UNITS = ["pcs", "box", "ml", "gm", "kg", "ltr", "pack", "set"];

export default function ItemsPage() {
  const db = useDb();
  const mounted = useMounted();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [editing, setEditing] = useState<Item | null>(null);
  const [adding, setAdding] = useState(false);

  const categories = useMemo(
    () =>
      Array.from(new Set(db.items.map((i) => i.category).filter(Boolean))) as string[],
    [db.items],
  );

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return db.items.filter((i) => {
      if (category !== "all" && i.category !== category) return false;
      if (!q) return true;
      return [i.name, i.sku ?? "", i.category ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [db.items, query, category]);

  const stockValue = db.items.reduce(
    (s, i) => s + i.stock * (i.costPrice ?? i.sellPrice),
    0,
  );
  const lowCount = db.items.filter((i) => i.stock <= i.lowStockAt).length;

  if (!mounted) return <PageHeader title="Products" subtitle="Loading…" />;

  return (
    <>
      <PageHeader
        title="Products & Stock"
        subtitle={`${db.items.length} products · ${rupees(stockValue)} stock value${lowCount ? ` · ${lowCount} need reorder` : ""}`}
        action={
          <Button onClick={() => setAdding(true)}>
            <Plus size={16} /> Add product
          </Button>
        }
      />

      <div className="space-y-4 px-4 pb-10 sm:px-6">
        <Card className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-52 flex-1">
              <Search
                size={16}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-400"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search product or code…"
                className="field h-10 py-0 pl-9"
              />
            </div>
            {categories.length ? (
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="field h-10 w-auto py-0 text-xs font-bold"
              >
                <option value="all">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        </Card>

        <Card>
          {items.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-ink-200 text-left text-[11px] font-bold tracking-wider text-ink-500 uppercase">
                    <th className="px-5 py-3">Product</th>
                    <th className="px-3 py-3">Category</th>
                    <th className="px-3 py-3 text-right">Price</th>
                    <th className="px-3 py-3 text-right">Stock</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {items.map((it) => {
                    const out = it.stock <= 0;
                    const low = !out && it.stock <= it.lowStockAt;
                    return (
                      <tr key={it.id} className="hover:bg-ink-50">
                        <td className="px-5 py-3">
                          <p className="font-bold text-ink-900">{it.name}</p>
                          {it.sku ? (
                            <p className="tnum text-xs text-ink-400">{it.sku}</p>
                          ) : null}
                        </td>
                        <td className="px-3 py-3">
                          {it.category ? (
                            <Badge tone="brand">{it.category}</Badge>
                          ) : (
                            <span className="text-ink-300">—</span>
                          )}
                        </td>
                        <td className="tnum px-3 py-3 text-right font-bold text-ink-900">
                          {rupees(it.sellPrice)}
                          {it.costPrice ? (
                            <span className="block text-[11px] font-medium text-ink-400">
                              cost {rupees(it.costPrice)}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span
                            className={clsx(
                              "tnum inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold",
                              out
                                ? "bg-rose-50 text-rose-700"
                                : low
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-emerald-50 text-emerald-700",
                            )}
                          >
                            {out || low ? <AlertTriangle size={11} /> : null}
                            {out ? "Out" : `${it.stock} ${it.unit}`}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex justify-end gap-0.5">
                            <button
                              onClick={() => setEditing(it)}
                              className="grid size-8 place-items-center rounded-lg text-ink-400 hover:bg-white hover:text-brand-600"
                              aria-label={`Edit ${it.name}`}
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Delete "${it.name}" from your catalogue?`))
                                  deleteItem(it.id);
                              }}
                              className="grid size-8 place-items-center rounded-lg text-ink-400 hover:bg-white hover:text-rose-600"
                              aria-label={`Delete ${it.name}`}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={<Package size={20} />}
              title={db.items.length ? "No products match" : "No products yet"}
              hint={
                db.items.length
                  ? "Try a different search or category."
                  : "Add the products you sell so billing takes one tap each."
              }
              action={
                <Button size="sm" onClick={() => setAdding(true)}>
                  Add your first product
                </Button>
              }
            />
          )}
        </Card>
      </div>

      {adding || editing ? (
        <ItemModal
          key={editing?.id ?? "new"}
          editing={editing}
          defaultTaxRate={db.settings.defaultTaxRate}
          categories={categories}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
        />
      ) : null}
    </>
  );
}

function ItemModal({
  editing,
  defaultTaxRate,
  categories,
  onClose,
}: {
  editing: Item | null;
  defaultTaxRate: number;
  categories: string[];
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: editing?.name ?? "",
    sku: editing?.sku ?? "",
    category: editing?.category ?? "",
    unit: editing?.unit ?? "pcs",
    sellPrice: editing ? String(editing.sellPrice) : "",
    costPrice: editing?.costPrice ? String(editing.costPrice) : "",
    stock: editing ? String(editing.stock) : "",
    lowStockAt: editing ? String(editing.lowStockAt) : "5",
    taxRate: String(editing?.taxRate ?? defaultTaxRate),
    hsn: editing?.hsn ?? "",
  });
  const [error, setError] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return setError("Product name is required.");
    if (!form.sellPrice || Number(form.sellPrice) <= 0)
      return setError("Enter a selling price.");

    saveItem({
      ...(editing ? { id: editing.id } : {}),
      name: form.name.trim(),
      sku: form.sku.trim() || undefined,
      category: form.category.trim() || undefined,
      unit: form.unit,
      sellPrice: Number(form.sellPrice),
      costPrice: form.costPrice ? Number(form.costPrice) : undefined,
      stock: Number(form.stock) || 0,
      lowStockAt: Number(form.lowStockAt) || 0,
      taxRate: Number(form.taxRate) || 0,
      hsn: form.hsn.trim() || undefined,
    });
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? "Edit product" : "New product"}
      subtitle="Stock reduces automatically with every bill."
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Product name *</label>
          <input
            autoFocus
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="field"
            placeholder="e.g. Lakme Matte Lipstick"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Selling price (₹) *</label>
            <input
              type="number"
              value={form.sellPrice}
              onChange={(e) => setForm({ ...form, sellPrice: e.target.value })}
              className="field tnum"
              placeholder="0"
            />
          </div>
          <div>
            <label className="label">Purchase price (₹)</label>
            <input
              type="number"
              value={form.costPrice}
              onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
              className="field tnum"
              placeholder="for profit reports"
            />
          </div>
          <div>
            <label className="label">Stock quantity</label>
            <input
              type="number"
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: e.target.value })}
              className="field tnum"
              placeholder="0"
            />
          </div>
          <div>
            <label className="label">Unit</label>
            <select
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              className="field"
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Alert me below</label>
            <input
              type="number"
              value={form.lowStockAt}
              onChange={(e) => setForm({ ...form, lowStockAt: e.target.value })}
              className="field tnum"
            />
          </div>
          <div>
            <label className="label">GST %</label>
            <input
              type="number"
              value={form.taxRate}
              onChange={(e) => setForm({ ...form, taxRate: e.target.value })}
              className="field tnum"
            />
          </div>
          <div>
            <label className="label">Category</label>
            <input
              list="cats"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="field"
              placeholder="e.g. Lips, Hair, Skincare"
            />
            <datalist id="cats">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="label">Product code / SKU</label>
            <input
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              className="field"
              placeholder="optional"
            />
          </div>
        </div>

        {error ? (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
            {error}
          </p>
        ) : null}

        <div className="flex gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" className="flex-1">
            {editing ? "Save changes" : "Add product"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
