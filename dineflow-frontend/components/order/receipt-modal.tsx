"use client";

import { useCallback, useEffect, useState } from "react";
import { Printer, X } from "lucide-react";
import { Receipt } from "./receipt";
import { Button } from "@/components/ui/button";
import type { Order } from "@/lib/types";

interface ReceiptTarget {
  order: Order;
  tableCode?: string;
  autoPrint: boolean;
}

// Mirrors useConfirmDialog's shape: call preview(...) from anywhere, render
// {modal} once near the bottom of the page. "Cetak" just calls
// window.print() — the .receipt-print rule in app/globals.css is what
// makes that print only the receipt itself and not the modal chrome or
// the page behind it, so no print-specific markup is needed here.
export function useReceiptPreview() {
  const [target, setTarget] = useState<ReceiptTarget | null>(null);

  const preview = useCallback((order: Order, tableCode?: string) => {
    setTarget({ order, tableCode, autoPrint: false });
  }, []);

  // A row's own "Cetak" button skips straight to the browser's print
  // dialog instead of making the user open Preview first and click Cetak
  // again — it still opens this same modal underneath so the correct
  // receipt is visibly confirmed behind that dialog, it just doesn't wait
  // for a second click to get there.
  const printDirectly = useCallback((order: Order, tableCode?: string) => {
    setTarget({ order, tableCode, autoPrint: true });
  }, []);

  useEffect(() => {
    if (!target?.autoPrint) return;
    // Wait one frame so the modal has actually painted before the browser
    // print dialog takes over — calling window.print() synchronously here
    // can fire against a not-yet-rendered frame.
    const id = requestAnimationFrame(() => window.print());
    return () => cancelAnimationFrame(id);
  }, [target]);

  const modal = target ? (
    <div
      className="backdrop-fade fixed inset-0 z-[70] flex items-end justify-center bg-ink/45 px-4 pb-4 sm:items-center sm:pb-0"
      onClick={() => setTarget(null)}
      role="presentation"
    >
      <div
        className="modal-pop flex max-h-[85vh] w-full max-w-sm flex-col overflow-hidden rounded-3xl bg-bg"
        role="dialog"
        aria-modal="true"
        aria-label="Preview struk"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <p className="font-display font-semibold text-ink">Preview Struk</p>
          <button
            onClick={() => setTarget(null)}
            aria-label="Tutup"
            className="text-ink-muted hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto p-4">
          <Receipt order={target.order} tableCode={target.tableCode} />
        </div>

        <div className="flex shrink-0 gap-2 border-t border-border p-4">
          <Button variant="ghost" className="flex-1" onClick={() => setTarget(null)}>
            Tutup
          </Button>
          <Button className="flex-1" onClick={() => window.print()}>
            <Printer size={16} />
            Cetak
          </Button>
        </div>
      </div>
    </div>
  ) : null;

  return { preview, printDirectly, modal };
}
