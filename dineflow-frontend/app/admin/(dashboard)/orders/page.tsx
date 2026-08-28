"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  ApiError,
  kitchenSocketUrl,
  listOrders,
  listTables,
  updateOrderPayment,
  updateOrderStatus,
} from "@/lib/api";
import { formatRupiah } from "@/lib/format";
import { useToast } from "@/components/ui/toast";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/ui/status-badge";
import { useReceiptPreview } from "@/components/order/receipt-modal";
import { Banknote, CircleCheckBig, Eye, Loader2, Printer } from "lucide-react";
import type { KitchenEvent, Order } from "@/lib/types";

const PAYMENT_ROLES = ["owner", "manager", "cashier"];
const RECONNECT_MS = 3000;

export default function OrdersPage() {
  const { token, staff } = useAuth();
  const toast = useToast();
  const { preview, printDirectly, modal } = useReceiptPreview();
  const canConfirmPayment = PAYMENT_ROLES.includes(staff.role);

  const [orders, setOrders] = useState<Order[]>([]);
  const [tables, setTables] = useState<Map<string, string>>(new Map());
  const [filter, setFilter] = useState<"unpaid" | "all">("unpaid");
  const [error, setError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [orderList, tableList] = await Promise.all([
          listOrders(token),
          listTables(token),
        ]);
        setOrders(orderList);
        setTables(new Map(tableList.map((t) => [t.id, t.code])));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Gagal memuat pesanan.");
      }
    })();
  }, [token]);

  const upsertOrder = useCallback((incoming: Order) => {
    setOrders((prev) => {
      const rest = prev.filter((o) => o.id !== incoming.id);
      return [incoming, ...rest];
    });
  }, []);

  // Same live-update mechanism as the Kitchen Display — /ws/kitchen
  // broadcasts every order/payment event restaurant-wide, so this page
  // gets the same real-time feed, just rendered for a different job.
  // table_status_updated events also arrive here (same socket, same room)
  // but carry a RestaurantTable, not an Order, so they're ignored here —
  // the Tables page is what reacts to those.
  useEffect(() => {
    let stopped = false;

    function connect() {
      if (stopped) return;
      const ws = new WebSocket(kitchenSocketUrl(token));
      socketRef.current = ws;
      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as KitchenEvent;
          if (parsed.event === "table_status_updated") return;
          upsertOrder(parsed.data);
        } catch {
          // ignore malformed frames
        }
      };
      ws.onclose = () => {
        if (!stopped) reconnectTimer.current = setTimeout(connect, RECONNECT_MS);
      };
      ws.onerror = () => ws.close();
    }

    connect();
    return () => {
      stopped = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      socketRef.current?.close();
    };
  }, [token, upsertOrder]);

  async function confirmCash(order: Order) {
    setConfirmingId(order.id);
    setError(null);
    try {
      const updated = await updateOrderPayment(token, order.id, "paid", "cash");
      upsertOrder(updated);
      toast.success(`Pembayaran cash #${order.order_code} dikonfirmasi.`);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Gagal mengonfirmasi pembayaran.",
      );
    } finally {
      setConfirmingId(null);
    }
  }

  // The button below is what was actually missing: the page could confirm
  // payment, but nothing ever called PATCH /orders/:id/status with
  // "completed" — so even a fully paid, fully served order just sat there,
  // and its table (per the Phase 7 fix) only frees up once an order
  // reaches this terminal state.
  async function completeOrder(order: Order) {
    setCompletingId(order.id);
    setError(null);
    try {
      const updated = await updateOrderStatus(token, order.id, "completed");
      upsertOrder(updated);
      toast.success(`Pesanan #${order.order_code} selesai.`);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Gagal menyelesaikan pesanan.",
      );
    } finally {
      setCompletingId(null);
    }
  }

  const visible = useMemo(() => {
    const list = filter === "unpaid" ? orders.filter((o) => o.payment_status !== "paid") : orders;
    return [...list].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [orders, filter]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="font-display text-xl font-semibold text-ink">Pesanan</p>
        <div className="flex gap-1 rounded-full bg-surface p-1">
          {(["unpaid", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                filter === f ? "bg-primary text-white" : "text-ink-muted"
              }`}
            >
              {f === "unpaid" ? "Belum Lunas" : "Semua"}
            </button>
          ))}
        </div>
      </div>

      {!canConfirmPayment && (
        <p className="mt-4 rounded-xl bg-secondary-tint px-4 py-2 text-sm text-secondary">
          Role kamu ({staff.role}) cuma bisa lihat daftar pesanan — konfirmasi
          pembayaran & selesaikan pesanan khusus owner, manager, atau cashier.
        </p>
      )}

      {error && (
        <p className="mt-4 rounded-xl bg-danger-tint px-4 py-2 text-sm text-danger">{error}</p>
      )}

      {visible.length === 0 ? (
        <p className="mt-8 text-sm text-ink-muted">
          {filter === "unpaid" ? "Semua pesanan sudah lunas." : "Belum ada pesanan."}
        </p>
      ) : (
        <div className="mt-5 divide-y divide-border rounded-2xl border border-border bg-surface">
          {visible.map((order) => {
            const canComplete =
              canConfirmPayment &&
              order.payment_status === "paid" &&
              order.status !== "completed" &&
              order.status !== "cancelled";

            return (
              <div key={order.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
                <div className="min-w-32 flex-1">
                  <p className="font-data text-sm font-semibold text-ink">
                    #{order.order_code}
                  </p>
                  <p className="text-xs text-ink-muted">
                    Meja {tables.get(order.table_id) ?? "?"} ·{" "}
                    {order.items.reduce((n, i) => n + i.quantity, 0)} item
                  </p>
                </div>

                <OrderStatusBadge status={order.status} />
                <PaymentStatusBadge status={order.payment_status} />

                <span className="font-data w-24 text-right text-sm font-medium text-ink">
                  {formatRupiah(order.total)}
                </span>

                {order.payment_status !== "paid" && canConfirmPayment && (
                  <button
                    onClick={() => confirmCash(order)}
                    disabled={confirmingId === order.id}
                    className="flex items-center gap-1.5 rounded-full bg-success px-3.5 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    {confirmingId === order.id ? (
                      <Loader2 size={14} className="spin-slow" />
                    ) : (
                      <Banknote size={14} />
                    )}
                    {confirmingId === order.id ? "Menyimpan…" : "Tandai Lunas (Cash)"}
                  </button>
                )}

                {canComplete && (
                  <button
                    onClick={() => completeOrder(order)}
                    disabled={completingId === order.id}
                    className="flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    {completingId === order.id ? (
                      <Loader2 size={14} className="spin-slow" />
                    ) : (
                      <CircleCheckBig size={14} />
                    )}
                    {completingId === order.id ? "Menyimpan…" : "Selesaikan Pesanan"}
                  </button>
                )}

                <div className="flex gap-1.5">
                  <button
                    onClick={() => preview(order, tables.get(order.table_id))}
                    aria-label="Preview struk"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-tint text-primary"
                  >
                    <Eye size={14} />
                  </button>
                  <button
                    onClick={() => printDirectly(order, tables.get(order.table_id))}
                    aria-label="Cetak struk"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary-tint text-secondary"
                  >
                    <Printer size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {modal}
    </div>
  );
}
