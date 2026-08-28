"use client";

import { FormEvent, useState } from "react";
import { ApiError, adjustIngredientStock } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import type { Ingredient } from "@/lib/types";

export function StockAdjustModal({
  ingredient,
  onClose,
  onSaved,
}: {
  ingredient: Ingredient | null;
  onClose: () => void;
  onSaved: (ingredient: Ingredient) => void;
}) {
  const { token } = useAuth();
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!ingredient) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const value = Number(delta);
    if (!value) return;
    setSubmitting(true);
    setError(null);
    try {
      const updated = await adjustIngredientStock(token, ingredient!.id, value, reason || undefined);
      onSaved(updated);
      setDelta("");
      setReason("");
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Gagal menyesuaikan stok.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl bg-surface p-5"
      >
        <p className="font-display text-lg font-semibold text-ink">
          Sesuaikan Stok: {ingredient.name}
        </p>
        <p className="mt-1 text-sm text-ink-muted">
          Stok sekarang: {ingredient.stock_quantity} {ingredient.unit}
        </p>

        <label className="mt-4 block text-sm font-medium text-ink">
          Jumlah (positif = restock, negatif = koreksi/waste)
          <input
            required
            type="number"
            step={0.1}
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            placeholder="cth: 5 atau -2"
            className="font-data mt-1.5 w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:border-primary"
          />
        </label>

        <label className="mt-3 block text-sm font-medium text-ink">
          Alasan (opsional)
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Restock mingguan, rusak, dll."
            className="mt-1.5 w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:border-primary"
          />
        </label>

        {error && (
          <p className="mt-3 rounded-xl bg-danger-tint px-3 py-2 text-sm text-danger">{error}</p>
        )}

        <div className="mt-4 flex gap-2">
          <Button type="submit" disabled={submitting} className="flex-1">
            {submitting ? "Menyimpan…" : "Simpan"}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
            Batal
          </Button>
        </div>
      </form>
    </div>
  );
}
