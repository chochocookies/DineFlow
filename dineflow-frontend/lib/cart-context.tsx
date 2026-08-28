"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { CartLine } from "./types";

interface CartContextValue {
  lines: CartLine[];
  itemCount: number;
  subtotal: number;
  addItem: (line: Omit<CartLine, "quantity">, quantity?: number) => void;
  setQuantity: (menuId: string, quantity: number) => void;
  removeItem: (menuId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function storageKey(qrToken: string) {
  return `dineflow:cart:${qrToken}`;
}

export function CartProvider({
  qrToken,
  children,
}: {
  qrToken: string;
  children: React.ReactNode;
}) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Runs once on mount, after the DOM exists — reading localStorage during
  // render would desync server/client output on the very first paint.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey(qrToken));
      if (raw) setLines(JSON.parse(raw));
    } catch {
      // Corrupt or inaccessible storage — start with an empty cart rather
      // than block the page.
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrToken]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(storageKey(qrToken), JSON.stringify(lines));
  }, [lines, qrToken, hydrated]);

  const addItem = useCallback(
    (line: Omit<CartLine, "quantity">, quantity = 1) => {
      setLines((prev) => {
        const existing = prev.find((l) => l.menu_id === line.menu_id);
        if (existing) {
          return prev.map((l) =>
            l.menu_id === line.menu_id
              ? { ...l, quantity: l.quantity + quantity }
              : l,
          );
        }
        return [...prev, { ...line, quantity }];
      });
    },
    [],
  );

  const setQuantity = useCallback((menuId: string, quantity: number) => {
    setLines((prev) => {
      if (quantity <= 0) return prev.filter((l) => l.menu_id !== menuId);
      return prev.map((l) =>
        l.menu_id === menuId ? { ...l, quantity } : l,
      );
    });
  }, []);

  const removeItem = useCallback((menuId: string) => {
    setLines((prev) => prev.filter((l) => l.menu_id !== menuId));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const itemCount = useMemo(
    () => lines.reduce((sum, l) => sum + l.quantity, 0),
    [lines],
  );
  const subtotal = useMemo(
    () => lines.reduce((sum, l) => sum + l.quantity * l.price, 0),
    [lines],
  );

  const value = useMemo(
    () => ({ lines, itemCount, subtotal, addItem, setQuantity, removeItem, clear }),
    [lines, itemCount, subtotal, addItem, setQuantity, removeItem, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
