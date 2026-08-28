"use client";

import { useCallback, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "./button";

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Defaults to true — the destructive (red) styling fits most confirms
   *  here (delete this, remove that). Pass false for a neutral action. */
  danger?: boolean;
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (result: boolean) => void;
}

// Replaces window.confirm(...) with something that actually matches the
// rest of the UI (icon, rounded surface, themed buttons) instead of the
// browser's own unstyled dialog. Usage mirrors window.confirm's ergonomics
// on purpose so swapping it in at each call site is a one-line change:
//
//   const { confirm, dialog } = useConfirmDialog();
//   if (!(await confirm("Hapus meja ini?"))) return;
//   ...
//   return <>{dialog}{/* rest of page */}</>;
export function useConfirmDialog() {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback((options: ConfirmOptions | string) => {
    const opts = typeof options === "string" ? { message: options } : options;
    return new Promise<boolean>((resolve) => {
      setPending({ ...opts, resolve });
    });
  }, []);

  function settle(result: boolean) {
    pending?.resolve(result);
    setPending(null);
  }

  const dialog = pending ? (
    <div
      className="backdrop-fade fixed inset-0 z-[70] flex items-end justify-center bg-ink/45 px-4 pb-4 sm:items-center sm:pb-0"
      onClick={() => settle(false)}
      role="presentation"
    >
      <div
        className="modal-pop w-full max-w-sm rounded-3xl bg-surface p-6 text-center shadow-xl"
        role="alertdialog"
        aria-modal="true"
        aria-label={pending.title ?? "Konfirmasi"}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${
            pending.danger === false
              ? "bg-secondary-tint text-secondary"
              : "bg-danger-tint text-danger"
          }`}
        >
          <TriangleAlert size={22} />
        </div>

        {pending.title && (
          <p className="font-display mt-3 text-lg font-semibold text-ink">
            {pending.title}
          </p>
        )}
        <p className="mt-2 text-sm text-ink-muted">{pending.message}</p>

        <div className="mt-5 flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={() => settle(false)}>
            {pending.cancelLabel ?? "Batal"}
          </Button>
          <Button
            variant={pending.danger === false ? "primary" : "danger"}
            className="flex-1"
            onClick={() => settle(true)}
          >
            {pending.confirmLabel ?? "Ya, Hapus"}
          </Button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, dialog };
}
