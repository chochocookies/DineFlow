"use client";

import { useEffect, useRef, useState } from "react";
import {
  ApiError,
  chargeOrder,
  getOrderByCode,
  simulateOrderPayment,
} from "@/lib/api";
import { formatRupiah, statusLabel } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Receipt } from "@/components/order/receipt";
import { CookingCountdown } from "@/components/order/cooking-countdown";
import { CircleCheckBig, FlaskConical, Loader2, Printer, QrCode } from "lucide-react";
import type { Order, OrderStatus, QRISCharge } from "@/lib/types";

const STEPS: { key: OrderStatus; label: string }[] = [
  { key: "pending", label: "Diterima" },
  { key: "confirmed", label: "Dikonfirmasi" },
  { key: "preparing", label: "Sedang Dimasak" },
  { key: "ready", label: "Siap Diambil" },
  { key: "served", label: "Sudah Diantar" },
];

const POLL_MS = 4000;
const TERMINAL: OrderStatus[] = ["completed", "cancelled"];

// The "Simulasikan Pembayaran" button below only ever renders outside a
// production build (see its guard further down) — it's local-dev tooling
// for testing the QRIS flow without a real gateway or phone, not something
// a real customer should ever see. The backend enforces the same boundary
// independently (see internal/payment.Handler.SimulatePayment): the route
// it calls 404s the moment PAYMENT_GATEWAY=midtrans is configured, so this
// button being visible is never itself a way to fake a real payment.
const SHOW_PAYMENT_SIMULATOR = process.env.NODE_ENV !== "production";

export function OrderTracker({
  code,
  initialOrder,
}: {
  code: string;
  initialOrder: Order;
}) {
  const [order, setOrder] = useState(initialOrder);
  const [charge, setCharge] = useState<QRISCharge | null>(null);
  const [charging, setCharging] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [chargeError, setChargeError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Order status/payment can change from the kitchen or a webhook at any
  // moment — poll for this customer-facing page rather than opening a
  // second WebSocket connection (that's reserved for the Kitchen Display).
  useEffect(() => {
    if (TERMINAL.includes(order.status)) return;

    pollRef.current = setInterval(async () => {
      try {
        const fresh = await getOrderByCode(code);
        setOrder(fresh);
        if (TERMINAL.includes(fresh.status) && pollRef.current) {
          clearInterval(pollRef.current);
        }
      } catch {
        // Transient network hiccup — next tick tries again.
      }
    }, POLL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, order.status]);

  async function handlePay() {
    setCharging(true);
    setChargeError(null);
    try {
      const result = await chargeOrder(code);
      setCharge(result);
    } catch (err) {
      setChargeError(
        err instanceof ApiError ? err.message : "Gagal membuat kode QRIS.",
      );
    } finally {
      setCharging(false);
    }
  }

  // Dev-only: completes the QRIS charge instantly instead of waiting on a
  // real scan + real gateway webhook — see simulateOrderPayment in lib/api.
  async function handleSimulate() {
    setSimulating(true);
    setChargeError(null);
    try {
      const updated = await simulateOrderPayment(code);
      setOrder(updated);
    } catch (err) {
      setChargeError(
        err instanceof ApiError
          ? err.message
          : "Gagal simulasikan pembayaran.",
      );
    } finally {
      setSimulating(false);
    }
  }

  const cancelled = order.status === "cancelled";
  const currentIndex = STEPS.findIndex((s) => s.key === order.status);

  return (
    <main className="mx-auto min-h-dvh max-w-md bg-bg px-5 pb-16 pt-8">
      <div className="text-center">
        <p className="text-sm text-ink-muted">Kode Pesanan</p>
        <p className="font-data mt-1 text-2xl font-semibold tracking-wide text-ink">
          {order.order_code}
        </p>
      </div>

      {cancelled ? (
        <div className="mt-8 rounded-2xl bg-danger-tint px-5 py-6 text-center">
          <p className="font-display text-lg font-semibold text-danger">
            Pesanan Dibatalkan
          </p>
          <p className="mt-1 text-sm text-danger/80">
            Hubungi staf restoran kalau ini nggak sesuai harapan kamu.
          </p>
        </div>
      ) : (
        <ol className="mt-8 space-y-0">
          {STEPS.map((step, i) => {
            const done = i < currentIndex;
            const active = i === currentIndex;
            return (
              <li key={step.key} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      done
                        ? "bg-success text-white"
                        : active
                          ? "new-order-pulse bg-primary text-white"
                          : "bg-border text-ink-muted"
                    }`}
                  >
                    {done ? "✓" : i + 1}
                  </span>
                  {i < STEPS.length - 1 && (
                    <span
                      className={`w-0.5 flex-1 ${done ? "bg-success" : "bg-border"}`}
                      style={{ minHeight: 28 }}
                    />
                  )}
                </div>
                <p
                  className={`pb-7 pt-0.5 text-sm ${active ? "font-semibold text-ink" : done ? "text-ink" : "text-ink-muted"}`}
                >
                  {step.label}
                </p>
              </li>
            );
          })}
        </ol>
      )}

      {order.status === "preparing" && (
        <div className="mb-5">
          <CookingCountdown order={order} />
        </div>
      )}

      <div className="ticket bg-surface rounded-2xl px-4 pt-4">
        {order.items.map((item) => (
          <div
            key={item.id}
            className="flex justify-between gap-3 border-b border-border/70 py-2.5 text-sm last:border-none"
          >
            <span className="text-ink">
              {item.quantity}x {item.menu_name}
            </span>
            <span className="font-data text-ink-muted">
              {formatRupiah(item.price * item.quantity)}
            </span>
          </div>
        ))}
        <div className="ticket-perforation mt-1 flex items-center justify-between py-4">
          <span className="font-display font-semibold text-ink">Total</span>
          <span className="font-data font-semibold text-ink">
            {formatRupiah(order.total)}
          </span>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between">
          <p className="font-medium text-ink">Pembayaran</p>
          <span className="text-sm text-ink-muted">
            {statusLabel(order.payment_status)}
          </span>
        </div>

        {order.payment_status === "unpaid" && !charge && (
          <Button onClick={handlePay} disabled={charging} className="mt-3 w-full">
            {charging ? (
              <Loader2 size={16} className="spin-slow" />
            ) : (
              <QrCode size={16} />
            )}
            {charging ? "Menyiapkan QRIS…" : "Bayar dengan QRIS"}
          </Button>
        )}

        {chargeError && (
          <p className="mt-3 text-sm text-danger">{chargeError}</p>
        )}

        {charge && order.payment_status !== "paid" && (
          <div className="mt-4 flex flex-col items-center gap-2 rounded-xl bg-bg p-4 text-center">
            {charge.qr_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={charge.qr_image_url}
                alt="Kode QRIS"
                className="h-48 w-48"
              />
            ) : (
              <p className="font-data break-all text-xs text-ink-muted">
                {charge.qr_string}
              </p>
            )}
            <p className="text-sm text-ink-muted">
              Scan pakai aplikasi e-wallet atau m-banking kamu
            </p>

            {SHOW_PAYMENT_SIMULATOR && (
              <Button
                variant="secondary"
                onClick={handleSimulate}
                disabled={simulating}
                className="mt-2 w-full"
              >
                {simulating ? (
                  <Loader2 size={15} className="spin-slow" />
                ) : (
                  <FlaskConical size={15} />
                )}
                {simulating ? "Menyimulasikan…" : "Simulasikan Pembayaran (Dev)"}
              </Button>
            )}
          </div>
        )}

        {order.payment_status === "paid" && (
          <p className="animate-in mt-3 flex items-center gap-1.5 text-sm text-success">
            <CircleCheckBig size={16} />
            Pembayaran diterima, terima kasih!
          </p>
        )}
      </div>

      {/* Proof of payment — only once actually paid, so this never shows a
          receipt for money that hasn't changed hands yet. Same <Receipt>
          component the admin side previews/prints from (see
          components/order/receipt.tsx), just embedded inline here instead
          of behind a modal, since the customer already has this whole page
          to themselves. */}
      {order.payment_status === "paid" && (
        <div className="animate-in mt-5">
          <Receipt order={order} />
          <Button
            variant="secondary"
            onClick={() => window.print()}
            className="mt-3 w-full"
          >
            <Printer size={16} />
            Cetak / Simpan Bukti Pembayaran
          </Button>
        </div>
      )}
    </main>
  );
}
