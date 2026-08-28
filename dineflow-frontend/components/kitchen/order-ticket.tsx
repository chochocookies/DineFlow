"use client";

import { formatRupiah } from "@/lib/format";
import type { Order } from "@/lib/types";

const elapsedMinutes = (createdAt: string) =>
  Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000));

export function OrderTicket({
  order,
  tableCode,
  actionLabel,
  onAction,
  urgent,
}: {
  order: Order;
  tableCode: string;
  actionLabel: string;
  onAction: () => void;
  urgent?: boolean;
}) {
  return (
    <div
      className={`kds-ticket new-order-pulse relative rounded-2xl bg-kds-surface px-4 pt-4 ${
        urgent ? "ring-2 ring-kds-urgent" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-data text-sm font-semibold tracking-wide text-kds-text">
            #{order.order_code}
          </p>
          <p className="text-xs text-kds-muted">Meja {tableCode}</p>
        </div>
        <span className="font-data text-xs text-kds-muted">
          {elapsedMinutes(order.created_at)}m
        </span>
      </div>

      <div className="kds-ticket-perforation mt-3 space-y-1.5 py-3">
        {order.items.map((item) => (
          <div key={item.id} className="flex justify-between gap-2 text-sm">
            <span className="text-kds-text">
              {item.quantity}x {item.menu_name}
            </span>
          </div>
        ))}
        {order.notes && (
          <p className="mt-1 rounded-lg bg-kds-new/10 px-2 py-1 text-xs text-kds-new">
            📝 {order.notes}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between pb-4 pt-1">
        <span className="font-data text-xs text-kds-muted">
          {formatRupiah(order.total)}
        </span>
        <button
          onClick={onAction}
          className="rounded-full bg-kds-preparing px-4 py-2 text-sm font-semibold text-kds-bg active:brightness-90"
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}
