"use client";

import { useState } from "react";
import { useCart } from "@/lib/cart-context";
import { formatRupiah } from "@/lib/format";
import { menuImageUrl } from "@/lib/placeholder";
import type { Menu } from "@/lib/types";

export function MenuItemRow({ menu, index = 0 }: { menu: Menu; index?: number }) {
  const { lines, addItem, setQuantity } = useCart();
  const inCart = lines.find((l) => l.menu_id === menu.id);
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div
      className="animate-in flex gap-3 py-4"
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms`, animationFillMode: "backwards" }}
    >
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-primary-tint transition-transform duration-200 hover:scale-105">
        {imgFailed ? (
          <span className="font-display flex h-full w-full items-center justify-center text-2xl font-semibold text-primary/70">
            {menu.name.charAt(0)}
          </span>
        ) : (
          // Menu photos are arbitrary URLs — either restaurant-supplied, or
          // the placehold.co fallback from lib/placeholder.ts when no real
          // photo is set yet — so this intentionally skips next/image's
          // remote-pattern allowlist rather than requiring a config change
          // per restaurant. onError catches the rare case where even the
          // fallback URL fails to load, dropping back to the letter avatar
          // instead of a broken-image icon.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={menuImageUrl(menu)}
            alt={menu.name}
            onError={() => setImgFailed(true)}
            className="h-full w-full object-cover"
          />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <p className="font-display font-semibold text-ink">{menu.name}</p>
        {menu.description && (
          <p className="mt-0.5 line-clamp-2 text-sm text-ink-muted">
            {menu.description}
          </p>
        )}
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="font-data text-sm font-medium text-ink">
            {formatRupiah(menu.price)}
          </span>

          {inCart ? (
            <div className="flex items-center gap-3 rounded-full border border-primary px-1">
              <button
                aria-label={`Kurangi ${menu.name}`}
                onClick={() => setQuantity(menu.id, inCart.quantity - 1)}
                className="flex h-7 w-7 items-center justify-center text-lg text-primary"
              >
                −
              </button>
              <span
                key={inCart.quantity}
                className="qty-pop min-w-4 text-center text-sm font-semibold text-ink"
              >
                {inCart.quantity}
              </span>
              <button
                aria-label={`Tambah ${menu.name}`}
                onClick={() => setQuantity(menu.id, inCart.quantity + 1)}
                className="flex h-7 w-7 items-center justify-center text-lg text-primary"
              >
                +
              </button>
            </div>
          ) : (
            <button
              onClick={() =>
                addItem({ menu_id: menu.id, name: menu.name, price: menu.price })
              }
              className="rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-white active:scale-95 active:bg-primary-dark"
            >
              + Tambah
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
