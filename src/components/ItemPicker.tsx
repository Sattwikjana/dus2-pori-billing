"use client";

import { useEffect, useRef, useState } from "react";
import { Package, PackageX, Plus, Search } from "lucide-react";
import { clsx } from "@/lib/clsx";
import { useDb } from "@/lib/hooks";
import { rupees } from "@/lib/format";
import type { Item } from "@/lib/types";

/** Search the catalogue by name, SKU or category; falls back to a free-text line. */
export function ItemPicker({
  onPick,
  onFreeText,
}: {
  onPick: (item: Item) => void;
  onFreeText: (name: string) => void;
}) {
  const db = useDb();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  const q = query.trim().toLowerCase();
  const results = q
    ? db.items
        .filter((i) =>
          [i.name, i.sku ?? "", i.category ?? ""]
            .join(" ")
            .toLowerCase()
            .includes(q),
        )
        .slice(0, 8)
    : db.items.slice(0, 6);

  useEffect(() => {
    const away = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, []);

  function choose(item: Item) {
    onPick(item);
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Search
          size={17}
          className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-400"
        />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setCursor(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (!open) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setCursor((c) => Math.min(c + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setCursor((c) => Math.max(c - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (results[cursor]) choose(results[cursor]);
              else if (query.trim()) {
                onFreeText(query.trim());
                setQuery("");
              }
            } else if (e.key === "Escape") setOpen(false);
          }}
          placeholder="Search product by name or code…"
          className="field h-12 pl-10 text-base"
          autoComplete="off"
        />
      </div>

      {open ? (
        <div className="animate-pop absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-pop">
          {results.length ? (
            <ul className="thin-scroll max-h-72 overflow-y-auto py-1">
              {results.map((it, i) => {
                const out = it.stock <= 0;
                return (
                  <li key={it.id}>
                    <button
                      onMouseEnter={() => setCursor(i)}
                      onClick={() => choose(it)}
                      className={clsx(
                        "flex w-full items-center gap-3 px-3 py-2.5 text-left",
                        i === cursor ? "bg-brand-50" : "hover:bg-ink-50",
                      )}
                    >
                      <span
                        className={clsx(
                          "grid size-9 shrink-0 place-items-center rounded-xl",
                          out
                            ? "bg-rose-50 text-rose-500"
                            : "bg-brand-50 text-brand-500",
                        )}
                      >
                        {out ? <PackageX size={16} /> : <Package size={16} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-ink-900">
                          {it.name}
                        </span>
                        <span className="tnum block text-xs text-ink-500">
                          {it.sku ? `${it.sku} · ` : ""}
                          <span
                            className={clsx(
                              out
                                ? "font-bold text-rose-600"
                                : it.stock <= it.lowStockAt
                                  ? "font-bold text-amber-600"
                                  : "",
                            )}
                          >
                            {out ? "Out of stock" : `${it.stock} ${it.unit} left`}
                          </span>
                        </span>
                      </span>
                      <span className="tnum shrink-0 text-sm font-bold text-ink-800">
                        {rupees(it.sellPrice)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {query.trim() ? (
            <button
              onClick={() => {
                onFreeText(query.trim());
                setQuery("");
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 border-t border-ink-100 bg-ink-50 px-4 py-3 text-left text-sm font-bold text-brand-700 hover:bg-brand-50"
            >
              <Plus size={16} />
              Add &ldquo;{query.trim()}&rdquo; as a custom line
            </button>
          ) : !results.length ? (
            <p className="px-4 py-6 text-center text-xs text-ink-500">
              No products yet — add them under Products, or just type a name here.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
