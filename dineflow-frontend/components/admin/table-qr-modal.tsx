"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { RestaurantTable } from "@/lib/types";

export function TableQrModal({
  table,
  onClose,
}: {
  table: RestaurantTable | null;
  onClose: () => void;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const orderUrl =
    table && typeof window !== "undefined"
      ? `${window.location.origin}/order/${table.qr_token}`
      : "";

  useEffect(() => {
    if (!table) {
      setDataUrl(null);
      return;
    }
    QRCode.toDataURL(orderUrl, { width: 320, margin: 2, color: { dark: "#241C15" } })
      .then(setDataUrl)
      .catch(() => setDataUrl(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table]);

  if (!table) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6"
      onClick={onClose}
    >
      <div
        className="ticket w-full max-w-xs rounded-2xl bg-surface px-5 pt-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-display text-lg font-semibold text-ink">
          Meja {table.code}
        </p>
        <p className="mt-1 text-xs text-ink-muted">Scan untuk mulai pesan</p>

        <div className="mt-4 flex justify-center">
          {dataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={dataUrl} alt={`QR code meja ${table.code}`} className="h-56 w-56" />
          ) : (
            <div className="flex h-56 w-56 items-center justify-center text-sm text-ink-muted">
              Membuat QR…
            </div>
          )}
        </div>

        <p className="font-data mt-3 break-all text-[10px] text-ink-muted">
          {orderUrl}
        </p>

        <div className="ticket-perforation mt-4 flex gap-2 py-4">
          {dataUrl && (
            <a
              href={dataUrl}
              download={`dineflow-meja-${table.code}.png`}
              className="flex-1 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white"
            >
              Download PNG
            </a>
          )}
          <button
            onClick={onClose}
            className="flex-1 rounded-full border border-border px-4 py-2 text-sm font-medium text-ink"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
