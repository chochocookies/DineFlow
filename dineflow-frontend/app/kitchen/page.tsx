"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  kitchenSocketUrl,
  listOrders,
  listTables,
  updateOrderStatus,
} from "@/lib/api";
import { clearStoredAuth, getStoredAuth, type StoredAuth } from "@/lib/auth";
import type { KitchenEvent, Order, OrderStatus, RestaurantTable } from "@/lib/types";
import { OrderTicket } from "@/components/kitchen/order-ticket";

const ACTIVE_STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
];

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: "preparing",
  confirmed: "preparing",
  preparing: "ready",
  ready: "served",
};

const ACTION_LABEL: Partial<Record<OrderStatus, string>> = {
  pending: "Terima & Masak",
  confirmed: "Terima & Masak",
  preparing: "Siap Diantar",
  ready: "Sudah Diantar",
};

const RECONNECT_MS = 3000;
const URGENT_AFTER_MIN = 15;

export default function KitchenDisplayPage() {
  const router = useRouter();
  const [auth, setAuth] = useState<StoredAuth | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tables, setTables] = useState<Map<string, string>>(new Map());
  const [connected, setConnected] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1) Load whoever's stored from the login page; bounce to /kitchen/login
  //    if nobody's signed in.
  useEffect(() => {
    const stored = getStoredAuth();
    if (!stored) {
      router.replace("/kitchen/login");
      return;
    }
    setAuth(stored);
  }, [router]);

  // 2) Once authenticated, load the current order list + table codes, then
  //    open the live WebSocket connection.
  useEffect(() => {
    if (!auth) return;

    let cancelled = false;

    (async () => {
      try {
        const [orderList, tableList] = await Promise.all([
          listOrders(auth.token),
          listTables(auth.token),
        ]);
        if (cancelled) return;
        setOrders(orderList.filter((o) => ACTIVE_STATUSES.includes(o.status)));
        setTables(new Map(tableList.map((t: RestaurantTable) => [t.id, t.code])));
      } catch {
        if (!cancelled) setLoadError("Gagal memuat data awal dari server.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [auth]);

  const upsertOrder = useCallback((incoming: Order) => {
    setOrders((prev) => {
      const withoutIncoming = prev.filter((o) => o.id !== incoming.id);
      if (!ACTIVE_STATUSES.includes(incoming.status)) {
        // Moved to served/completed/cancelled — drop off the active board.
        return withoutIncoming;
      }
      return [...withoutIncoming, incoming];
    });
  }, []);

  // 3) WebSocket connection with a basic reconnect loop — a Kitchen Display
  //    left running all shift needs to survive the backend restarting or a
  //    flaky network without someone having to reload the tab.
  useEffect(() => {
    if (!auth) return;

    let stopped = false;

    function connect() {
      if (stopped || !auth) return;
      const ws = new WebSocket(kitchenSocketUrl(auth.token));
      socketRef.current = ws;

      ws.onopen = () => setConnected(true);
      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as KitchenEvent;
          // table_status_updated carries a RestaurantTable, not an Order —
          // it's meant for the Tables admin page, not the Kitchen Display,
          // so it's ignored here rather than passed to upsertOrder.
          if (parsed.event === "table_status_updated") return;
          upsertOrder(parsed.data);
        } catch {
          // Ignore malformed frames rather than crash the display.
        }
      };
      ws.onclose = () => {
        setConnected(false);
        if (!stopped) {
          reconnectTimer.current = setTimeout(connect, RECONNECT_MS);
        }
      };
      ws.onerror = () => ws.close();
    }

    connect();

    return () => {
      stopped = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      socketRef.current?.close();
    };
  }, [auth, upsertOrder]);

  async function advance(order: Order) {
    if (!auth) return;
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    try {
      const updated = await updateOrderStatus(auth.token, order.id, next);
      upsertOrder(updated);
    } catch {
      // The next WS broadcast (from this action or any other screen) will
      // reconcile state even if this particular request failed silently.
    }
  }

  function logout() {
    clearStoredAuth();
    router.replace("/kitchen/login");
  }

  const columns = useMemo(() => {
    const baru = orders
      .filter((o) => o.status === "pending" || o.status === "confirmed")
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    const dimasak = orders
      .filter((o) => o.status === "preparing")
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    const siap = orders
      .filter((o) => o.status === "ready")
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    return [
      { title: "Baru", items: baru },
      { title: "Dimasak", items: dimasak },
      { title: "Siap", items: siap },
    ];
  }, [orders]);

  if (!auth) return null;

  return (
    <main className="min-h-dvh bg-kds-bg pb-10">
      <header className="flex items-center justify-between border-b border-white/5 px-6 py-4">
        <div>
          <p className="font-display text-lg font-semibold text-kds-text">
            DineFlow Kitchen
          </p>
          <p className="text-xs text-kds-muted">{auth.staff.name}</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-2 text-xs text-kds-muted">
            <span
              className={`h-2 w-2 rounded-full ${connected ? "bg-kds-ready" : "bg-kds-urgent"}`}
            />
            {connected ? "LIVE" : "Menyambung ulang…"}
          </span>
          <button onClick={logout} className="text-xs text-kds-muted underline">
            Keluar
          </button>
        </div>
      </header>

      {loadError && (
        <p className="mx-6 mt-4 rounded-xl bg-kds-urgent/15 px-4 py-2 text-sm text-kds-urgent">
          {loadError}
        </p>
      )}

      <div className="grid grid-cols-1 gap-5 px-5 pt-5 md:grid-cols-3">
        {columns.map((col) => (
          <section key={col.title}>
            <p className="mb-3 px-1 text-xs font-semibold uppercase tracking-wider text-kds-muted">
              {col.title} ({col.items.length})
            </p>
            <div className="space-y-4">
              {col.items.length === 0 && (
                <p className="px-1 text-sm text-kds-muted/60">Kosong</p>
              )}
              {col.items.map((order) => (
                <OrderTicket
                  key={order.id}
                  order={order}
                  tableCode={tables.get(order.table_id) ?? "?"}
                  actionLabel={ACTION_LABEL[order.status] ?? ""}
                  onAction={() => advance(order)}
                  urgent={
                    Math.floor(
                      (Date.now() - new Date(order.created_at).getTime()) /
                        60000,
                    ) >= URGENT_AFTER_MIN
                  }
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
