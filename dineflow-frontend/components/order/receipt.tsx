import { formatRupiah } from "@/lib/format";
import type { Order } from "@/lib/types";

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Tunai",
  qris: "QRIS",
};

// Renders identically wherever it's used — the admin preview/print modal
// (see receipt-modal.tsx) and the customer's payment-proof view in
// order-tracker.tsx both just hand it an Order. Still has no restaurant
// name/logo, but not for lack of an endpoint anymore — Phase 9 added
// GET /restaurants/me (admin) and GET /public/restaurants/:restaurant_id
// (public), either of which could supply one now. It's just not wired
// through yet: doing so means threading a restaurant name/description
// down as a prop from every caller (Orders page, Dashboard, OrderTracker),
// and OrderTracker specifically would need an extra fetch it doesn't
// currently make. Left as a follow-up (see README's "Selanjutnya") rather
// than half-wiring it under time pressure.
export function Receipt({ order, tableCode }: { order: Order; tableCode?: string }) {
  const paid = order.payment_status === "paid";

  return (
    <div className="receipt-print mx-auto w-full max-w-xs rounded-2xl bg-white p-5 text-ink">
      <div className="text-center">
        <p className="font-display text-base font-semibold tracking-wide">
          STRUK PEMBAYARAN
        </p>
        <p className="font-data mt-1 text-sm font-semibold text-ink">
          {order.order_code}
        </p>
        {tableCode && <p className="text-xs text-ink-muted">Meja {tableCode}</p>}
        <p className="text-xs text-ink-muted">
          {new Date(order.created_at).toLocaleString("id-ID", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
      </div>

      <div className="my-3 border-t border-dashed border-ink/25" />

      <div className="space-y-1.5 text-sm">
        {order.items.map((item) => (
          <div key={item.id} className="flex justify-between gap-3">
            <span className="text-ink">
              {item.quantity}x {item.menu_name}
            </span>
            <span className="font-data shrink-0 text-ink-muted">
              {formatRupiah(item.price * item.quantity)}
            </span>
          </div>
        ))}
      </div>

      <div className="my-3 border-t border-dashed border-ink/25" />

      <div className="space-y-1 text-sm text-ink-muted">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span className="font-data">{formatRupiah(order.subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span>Pajak</span>
          <span className="font-data">{formatRupiah(order.tax)}</span>
        </div>
        <div className="flex justify-between">
          <span>Biaya Layanan</span>
          <span className="font-data">{formatRupiah(order.service_fee)}</span>
        </div>
        <div className="flex justify-between text-base font-semibold text-ink">
          <span>Total</span>
          <span className="font-data">{formatRupiah(order.total)}</span>
        </div>
      </div>

      <div className="my-3 border-t border-dashed border-ink/25" />

      <div className="text-center text-xs">
        <p className="text-ink-muted">
          Metode: {order.payment_method ? (PAYMENT_METHOD_LABELS[order.payment_method] ?? order.payment_method.toUpperCase()) : "-"}
        </p>
        <p className={`mt-0.5 font-semibold ${paid ? "text-success" : "text-danger"}`}>
          {paid ? "LUNAS" : "BELUM LUNAS"}
        </p>
        {order.payment_reference && (
          <p className="font-data mt-0.5 break-all text-ink-muted">
            Ref: {order.payment_reference}
          </p>
        )}
      </div>

      <p className="mt-4 text-center text-xs text-ink-muted">
        Terima kasih sudah memesan!
      </p>
    </div>
  );
}
