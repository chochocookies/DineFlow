"use client";

import { FormEvent, useEffect, useState } from "react";
import { ApiError, createIngredient, updateIngredient, type IngredientInput } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import type { Ingredient } from "@/lib/types";

const COMMON_UNITS = ["kg", "g", "l", "ml", "pcs"];

export function IngredientFormSheet({
  open,
  onClose,
  onSaved,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (ingredient: Ingredient) => void;
  editing: Ingredient | null;
}) {
  const { token } = useAuth();
  const [form, setForm] = useState<IngredientInput>({ name: "", unit: "kg", stock_quantity: 0 });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editing) {
      setForm({ name: editing.name, unit: editing.unit, stock_quantity: editing.stock_quantity });
    } else {
      setForm({ name: "", unit: "kg", stock_quantity: 0 });
    }
    setError(null);
  }, [editing, open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const saved = editing
        ? await updateIngredient(token, editing.id, { name: form.name, unit: form.unit })
        : await createIngredient(token, form);
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menyimpan ingredient.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={onClose}
        aria-hidden
      />
      <div
        className={`fixed inset-x-0 bottom-0 z-50 max-h-[90dvh] overflow-y-auto rounded-t-3xl bg-surface p-5 transition-transform duration-300 ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
        role="dialog"
        aria-label={editing ? "Edit ingredient" : "Tambah ingredient"}
      >
        <div className="flex items-center justify-between">
          <p className="font-display text-xl font-semibold text-ink">
            {editing ? "Edit Ingredient" : "Tambah Ingredient"}
          </p>
          <button onClick={onClose} aria-label="Tutup" className="flex h-8 w-8 items-center justify-center rounded-full bg-bg text-ink-muted">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <label className="block text-sm font-medium text-ink">
            Nama
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Beras, Ayam, Minyak Goreng…"
              className="mt-1.5 w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:border-primary"
            />
          </label>

          <label className="block text-sm font-medium text-ink">
            Satuan
            <select
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              className="mt-1.5 w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm text-ink focus:border-primary"
            >
              {COMMON_UNITS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </label>

          {!editing && (
            <label className="block text-sm font-medium text-ink">
              Stok Awal
              <input
                type="number"
                min={0}
                step={0.1}
                value={form.stock_quantity}
                onChange={(e) => setForm({ ...form, stock_quantity: Number(e.target.value) })}
                className="font-data mt-1.5 w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm text-ink focus:border-primary"
              />
            </label>
          )}

          {error && (
            <p className="rounded-xl bg-danger-tint px-3 py-2 text-sm text-danger">{error}</p>
          )}

          <Button type="submit" disabled={submitting} size="lg" className="w-full">
            {submitting ? "Menyimpan…" : "Simpan"}
          </Button>
        </form>
      </div>
    </>
  );
}
