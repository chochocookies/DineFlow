"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart-context";
import { ApiError, createOrder } from "@/lib/api";
import { formatRupiah } from "@/lib/format";
import { Button } from "@/components/ui/button";

// Estimate only, using the same rates as internal/order/service.go
// (taxRate, serviceRate) — the order response after checkout carries the
// real, server-computed figures, which is what actually gets charged.
const TAX_RATE = 0.1;
const SERVICE_RATE = 0.05;

export function CartSheet({
  qrToken,
  open,
  onClose,
}: {
  qrToken: string;
  open: boolean;
  onClose: () => void;
}) {
  const { lines, subtotal, setQuantity, removeItem, clear } = useCart();
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tax = Math.round(subtotal * TAX_RATE);
  const service = Math.round(subtotal * SERVICE_RATE);
  const total = subtotal + tax + service;

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const order = await createOrder({
        qr_token: qrToken,
        items: lines.map((l) => ({
          menu_id: l.menu_id,
          quantity: l.quantity,
          notes: l.notes,
        })),
        notes: notes || undefined,
      });
      clear();
      router.push(`/o/${order.order_code}`);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Gagal membuat pesanan. Coba lagi.",
      );
      setSubmitting(false);
    }
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden
      />
      <div
        className={`fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-3xl bg-surface transition-transform duration-300 ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
        role="dialog"
        aria-label="Keranjang pesanan"
      >
        <div className="sticky top-0 flex items-center justify-between bg-surface px-5 pt-5 pb-3">
          <p className="font-display text-xl font-semibold text-ink">
            Pesanan Saya
          </p>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-bg text-ink-muted"
          >
            ✕
          </button>
        </div>

        {lines.length === 0 ? (
          <p className="px-5 pb-10 pt-4 text-ink-muted">
            Keranjang masih kosong. Yuk pilih menu dulu.
          </p>
        ) : (
          <div className="px-5 pb-6">
            <div className="ticket bg-secondary-tint/40 rounded-2xl px-4 pt-4">
              {lines.map((line) => (
                <div
                  key={line.menu_id}
                  className="flex items-center justify-between gap-2 border-b border-border/70 py-3 last:border-none"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">
                      {line.name}
                    </p>
                    <p className="font-data text-xs text-ink-muted">
                      {formatRupiah(line.price)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <div className="flex items-center gap-2 rounded-full border border-primary px-1">
                      <button
                        aria-label={`Kurangi ${line.name}`}
                        onClick={() =>
                          setQuantity(line.menu_id, line.quantity - 1)
                        }
                        className="flex h-6 w-6 items-center justify-center text-primary"
                      >
                        −
                      </button>
                      <span className="min-w-4 text-center text-sm font-semibold">
                        {line.quantity}
                      </span>
                      <button
                        aria-label={`Tambah ${line.name}`}
                        onClick={() =>
                          setQuantity(line.menu_id, line.quantity + 1)
                        }
                        className="flex h-6 w-6 items-center justify-center text-primary"
                      >
                        +
                      </button>
                    </div>
                    <button
                      aria-label={`Hapus ${line.name}`}
                      onClick={() => removeItem(line.menu_id)}
                      className="text-ink-muted"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              ))}

              <div className="ticket-perforation mt-1 space-y-1.5 py-4 text-sm">
                <Row label="Subtotal" value={subtotal} />
                <Row label="Pajak (10%)" value={tax} />
                <Row label="Biaya Layanan (5%)" value={service} />
                <Row label="Total" value={total} strong />
              </div>
            </div>

            <label className="mt-5 block text-sm font-medium text-ink">
              Catatan buat dapur (opsional)
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contoh: nggak pakai pedas, sambal terpisah…"
                rows={2}
                className="mt-1.5 w-full resize-none rounded-xl border border-border bg-bg px-3 py-2 text-sm placeholder:text-ink-muted focus:border-primary"
              />
            </label>

            {error && (
              <p className="mt-3 rounded-xl bg-danger-tint px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}

            <Button
              onClick={handleSubmit}
              disabled={submitting}
              size="lg"
              className="mt-5 w-full"
            >
              {submitting ? "Mengirim Pesanan…" : `Pesan Sekarang · ${formatRupiah(total)}`}
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between ${strong ? "font-display text-base font-semibold text-ink" : "text-ink-muted"}`}
    >
      <span>{label}</span>
      <span className="font-data">{formatRupiah(value)}</span>
    </div>
  );
}
