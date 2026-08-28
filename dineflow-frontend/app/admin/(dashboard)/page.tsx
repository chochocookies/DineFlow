"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  ApiError,
  getBestSellers,
  getDashboardSummary,
  kitchenSocketUrl,
  listIngredients,
  listOrders,
  listTables,
  type BestSeller,
  type DashboardSummary,
} from "@/lib/api";
import { formatRupiah } from "@/lib/format";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/ui/status-badge";
import { useReceiptPreview } from "@/components/order/receipt-modal";
import { AlertTriangle, Eye, PackageSearch, Printer, Table2 } from "lucide-react";
import type { Ingredient, Order, RestaurantTable } from "@/lib/types";

export default function DashboardHomePage() {
  const { token } = useAuth();
  const { preview, printDirectly, modal } = useReceiptPreview();

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [bestSellers, setBestSellers] = useState<BestSeller[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    try {
      const [s, b, o, t, i] = await Promise.all([
        getDashboardSummary(token),
        getBestSellers(token, 5),
        listOrders(token),
        listTables(token),
        listIngredients(token),
      ]);
      setSummary(s);
      setBestSellers(b);
      setOrders(o);
      setTables(t);
      setIngredients(i);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal memuat dashboard.");
    }
  }, [token]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Live update: a new order, a status/payment change, or a table freeing
  // up can all move these numbers, so any message on the restaurant's
  // socket just triggers a full (debounced) refetch rather than trying to
  // hand-patch six different aggregates depending on which event arrived.
  useEffect(() => {
    const ws = new WebSocket(kitchenSocketUrl(token));
    let timer: ReturnType<typeof setTimeout> | null = null;
    ws.onmessage = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(loadAll, 600);
    };
    return () => {
      if (timer) clearTimeout(timer);
      ws.close();
    };
  }, [token, loadAll]);

  const tableCodeById = useMemo(
    () => new Map(tables.map((t) => [t.id, t.code])),
    [tables],
  );

  const recentOrders = useMemo(
    () => [...orders].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 8),
    [orders],
  );

  const statusCounts = useMemo(() => {
    const counts = { pending: 0, processing: 0, ready: 0, served: 0 };
    for (const o of orders) {
      if (o.status === "pending") counts.pending++;
      else if (o.status === "confirmed" || o.status === "preparing") counts.processing++;
      else if (o.status === "ready") counts.ready++;
      else if (o.status === "served") counts.served++;
    }
    return counts;
  }, [orders]);

  const tableStats = useMemo(
    () => ({ total: tables.length, available: tables.filter((t) => t.status === "available").length }),
    [tables],
  );

  const lowStock = useMemo(
    () => [...ingredients].sort((a, b) => a.stock_quantity - b.stock_quantity).slice(0, 5),
    [ingredients],
  );

  if (error) {
    return <p className="rounded-xl bg-danger-tint px-4 py-3 text-danger">{error}</p>;
  }
  if (!summary) {
    return <p className="text-ink-muted">Memuat…</p>;
  }

  const maxTrend = Math.max(1, ...summary.daily_trend.map((d) => d.total));

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Hari Ini" value={formatRupiah(summary.today.total_sales)} sub={`${summary.today.order_count} order`} />
        <StatCard label="Minggu Ini" value={formatRupiah(summary.this_week.total_sales)} sub={`${summary.this_week.order_count} order`} />
        <StatCard label="Bulan Ini" value={formatRupiah(summary.this_month.total_sales)} sub={`${summary.this_month.order_count} order`} />
        <StatCard label="Rata-rata/Order" value={formatRupiah(summary.today.average_order)} sub="hari ini" />
      </div>

      {/* Operational at-a-glance row: what's happening right now, not just
          historical totals — this is the part a live dashboard earns its
          keep on, since these three numbers are exactly the ones that go
          stale the moment you stop refreshing manually. */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs text-ink-muted">Status Pesanan Aktif</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <StatusChip label="Menunggu" count={statusCounts.pending} tone="secondary" />
            <StatusChip label="Diproses" count={statusCounts.processing} tone="primary" />
            <StatusChip label="Siap" count={statusCounts.ready} tone="success" />
            <StatusChip label="Diantar" count={statusCounts.served} tone="muted" />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="flex items-center gap-1.5 text-xs text-ink-muted">
            <Table2 size={13} />
            Ketersediaan Meja
          </div>
          <p className="font-data mt-1.5 text-lg font-semibold text-ink">
            {tableStats.available}/{tableStats.total}
          </p>
          <p className="text-xs text-ink-muted">meja tersedia</p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="flex items-center gap-1.5 text-xs text-ink-muted">
            <PackageSearch size={13} />
            Stok Menipis
          </div>
          {lowStock.length === 0 ? (
            <p className="mt-1.5 text-sm text-ink-muted">Belum ada data ingredient.</p>
          ) : (
            <ul className="mt-1.5 space-y-0.5">
              {lowStock.slice(0, 3).map((ing) => (
                <li key={ing.id} className="flex items-center justify-between text-xs">
                  <span className="truncate text-ink">{ing.name}</span>
                  <span className="font-data shrink-0 text-ink-muted">
                    {ing.stock_quantity} {ing.unit}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section>
        <p className="font-display mb-3 font-semibold text-ink">7 Hari Terakhir</p>
        <div className="flex h-32 items-end gap-2 rounded-2xl border border-border bg-surface p-4">
          {summary.daily_trend.map((d) => (
            <div key={d.date} className="flex flex-1 flex-col items-center gap-1.5">
              <div
                className="w-full rounded-t-md bg-primary"
                style={{
                  height: `${Math.max(4, (d.total / maxTrend) * 88)}px`,
                }}
                title={formatRupiah(d.total)}
              />
              <span className="text-[10px] text-ink-muted">
                {new Date(d.date).toLocaleDateString("id-ID", { weekday: "short" })}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <p className="font-display mb-3 font-semibold text-ink">Menu Terlaris</p>
        {bestSellers.length === 0 ? (
          <p className="text-sm text-ink-muted">Belum ada data penjualan.</p>
        ) : (
          <div className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {bestSellers.map((item, i) => (
              <div key={item.menu_id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="font-data text-sm text-ink-muted">{i + 1}</span>
                  <span className="text-sm text-ink">{item.menu_name}</span>
                </div>
                <span className="text-sm text-ink-muted">{item.total_quantity} terjual</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <p className="font-display mb-3 font-semibold text-ink">Transaksi Terbaru</p>
        {recentOrders.length === 0 ? (
          <p className="text-sm text-ink-muted">Belum ada transaksi.</p>
        ) : (
          <div className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {recentOrders.map((order) => (
              <div key={order.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
                <div className="min-w-32 flex-1">
                  <p className="font-data text-sm font-semibold text-ink">
                    #{order.order_code}
                  </p>
                  <p className="text-xs text-ink-muted">
                    Meja {tableCodeById.get(order.table_id) ?? "?"}
                  </p>
                </div>
                <OrderStatusBadge status={order.status} />
                <PaymentStatusBadge status={order.payment_status} />
                <span className="font-data w-24 text-right text-sm font-medium text-ink">
                  {formatRupiah(order.total)}
                </span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => preview(order, tableCodeById.get(order.table_id))}
                    aria-label="Preview struk"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-tint text-primary"
                  >
                    <Eye size={14} />
                  </button>
                  <button
                    onClick={() => printDirectly(order, tableCodeById.get(order.table_id))}
                    aria-label="Cetak struk"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary-tint text-secondary"
                  >
                    <Printer size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {modal}
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="font-data mt-1 text-lg font-semibold text-ink">{value}</p>
      <p className="text-xs text-ink-muted">{sub}</p>
    </div>
  );
}

const CHIP_TONES: Record<string, string> = {
  primary: "bg-primary-tint text-primary",
  secondary: "bg-secondary-tint text-secondary",
  success: "bg-success-tint text-success",
  muted: "bg-border text-ink-muted",
};

function StatusChip({ label, count, tone }: { label: string; count: number; tone: keyof typeof CHIP_TONES }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${CHIP_TONES[tone]}`}>
      {count} {label}
    </span>
  );
}
