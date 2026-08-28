"use client";

import { useMemo, useState } from "react";
import type { Menu, TableWithRestaurant } from "@/lib/types";
import { useCart } from "@/lib/cart-context";
import { formatRupiah } from "@/lib/format";
import { MenuItemRow } from "./menu-item-row";
import { CartSheet } from "./cart-sheet";

export function MenuBrowser({
  qrToken,
  tableInfo,
  menus,
}: {
  qrToken: string;
  tableInfo: TableWithRestaurant;
  menus: Menu[];
}) {
  const { itemCount, subtotal } = useCart();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("Semua");
  const [cartOpen, setCartOpen] = useState(false);

  const categories = useMemo(() => {
    const set = new Set(menus.map((m) => m.category));
    return ["Semua", ...Array.from(set)];
  }, [menus]);

  const visible = useMemo(() => {
    return menus.filter((m) => {
      if (!m.is_available) return false;
      if (category !== "Semua" && m.category !== category) return false;
      if (query && !m.name.toLowerCase().includes(query.toLowerCase()))
        return false;
      return true;
    });
  }, [menus, category, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, Menu[]>();
    for (const item of visible) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return Array.from(map.entries());
  }, [visible]);

  return (
    <main className="min-h-dvh bg-bg pb-28">
      <header className="sticky top-0 z-20 bg-bg/95 backdrop-blur px-5 pt-6 pb-3 shadow-[0_1px_0_var(--border)]">
        <p className="font-display text-2xl font-semibold text-ink">
          {tableInfo.restaurant_name}
        </p>
        <p className="mt-0.5 text-sm text-ink-muted">
          Meja {tableInfo.table.code}
        </p>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari menu…"
          className="mt-4 w-full rounded-full border border-border bg-surface px-4 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:border-primary"
        />
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                category === c
                  ? "bg-primary text-white"
                  : "bg-surface text-ink-muted border border-border"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </header>

      <div className="px-5">
        {grouped.length === 0 ? (
          <p className="py-16 text-center text-ink-muted">
            Nggak ada menu yang cocok. Coba kata kunci lain.
          </p>
        ) : (
          grouped.map(([cat, items]) => (
            <section key={cat} className="mt-6">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                {cat}
              </p>
              <div className="divide-y divide-border">
                {items.map((item, i) => (
                  <MenuItemRow key={item.id} menu={item} index={i} />
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      {itemCount > 0 && (
        <div className="animate-in fixed inset-x-0 bottom-0 z-30 px-4 pb-4">
          <button
            onClick={() => setCartOpen(true)}
            className="flex w-full items-center justify-between rounded-2xl bg-ink px-5 py-4 text-white shadow-xl"
          >
            <span className="flex items-center gap-2 font-semibold">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs">
                {itemCount}
              </span>
              Lihat Keranjang
            </span>
            <span className="font-data font-medium">
              {formatRupiah(subtotal)}
            </span>
          </button>
        </div>
      )}

      <CartSheet
        qrToken={qrToken}
        open={cartOpen}
        onClose={() => setCartOpen(false)}
      />
    </main>
  );
}
