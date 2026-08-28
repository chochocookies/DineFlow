"use client";

import { FormEvent, useEffect, useState } from "react";
import { ApiError, createMenu, updateMenu, type MenuInput } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import type { Menu } from "@/lib/types";

export function MenuFormSheet({
  open,
  onClose,
  onSaved,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (menu: Menu) => void;
  editing: Menu | null;
}) {
  const { token } = useAuth();
  const [form, setForm] = useState<MenuInput>({
    category: "",
    name: "",
    description: "",
    price: 0,
    image_url: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editing) {
      setForm({
        category: editing.category,
        name: editing.name,
        description: editing.description ?? "",
        price: editing.price,
        image_url: editing.image_url ?? "",
      });
    } else {
      setForm({ category: "", name: "", description: "", price: 0, image_url: "" });
    }
    setError(null);
  }, [editing, open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const saved = editing
        ? await updateMenu(token, editing.id, form)
        : await createMenu(token, form);
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menyimpan menu.");
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
        aria-label={editing ? "Edit menu" : "Tambah menu"}
      >
        <div className="flex items-center justify-between">
          <p className="font-display text-xl font-semibold text-ink">
            {editing ? "Edit Menu" : "Tambah Menu"}
          </p>
          <button onClick={onClose} aria-label="Tutup" className="flex h-8 w-8 items-center justify-center rounded-full bg-bg text-ink-muted">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <Field label="Kategori">
            <input
              required
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="Main Course, Drink, Dessert…"
              className="w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:border-primary"
            />
          </Field>

          <Field label="Nama Menu">
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm text-ink focus:border-primary"
            />
          </Field>

          <Field label="Deskripsi (opsional)">
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full resize-none rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm text-ink focus:border-primary"
            />
          </Field>

          <Field label="Harga (Rp)">
            <input
              required
              type="number"
              min={0}
              step={500}
              value={form.price || ""}
              onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
              className="font-data w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm text-ink focus:border-primary"
            />
          </Field>

          <Field label="URL Foto (opsional)">
            <input
              type="url"
              value={form.image_url}
              onChange={(e) => setForm({ ...form, image_url: e.target.value })}
              placeholder="https://…"
              className="w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:border-primary"
            />
          </Field>

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium text-ink">
      {label}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
