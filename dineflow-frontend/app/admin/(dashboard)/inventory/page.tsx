"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { ApiError, deleteIngredient, listIngredients } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { IngredientFormSheet } from "@/components/admin/ingredient-form-sheet";
import { StockAdjustModal } from "@/components/admin/stock-adjust-modal";
import { Pencil, Plus, Scale, Trash2 } from "lucide-react";
import type { Ingredient } from "@/lib/types";

export default function InventoryPage() {
  const { token } = useAuth();
  const toast = useToast();
  const { confirm, dialog } = useConfirmDialog();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [adjusting, setAdjusting] = useState<Ingredient | null>(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    try {
      setIngredients(await listIngredients(token));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal memuat ingredient.");
    }
  }

  function handleSaved(saved: Ingredient) {
    setIngredients((prev) => {
      const exists = prev.some((i) => i.id === saved.id);
      return exists ? prev.map((i) => (i.id === saved.id ? saved : i)) : [...prev, saved];
    });
    toast.success(`Ingredient "${saved.name}" berhasil disimpan.`);
  }

  async function handleDelete(ingredient: Ingredient) {
    const ok = await confirm({
      message: `Hapus "${ingredient.name}"? Ini juga akan lepasin ingredient ini dari resep menu manapun yang pakai.`,
      confirmLabel: "Hapus",
    });
    if (!ok) return;
    try {
      await deleteIngredient(token, ingredient.id);
      setIngredients((prev) => prev.filter((i) => i.id !== ingredient.id));
      toast.success(`Ingredient "${ingredient.name}" berhasil dihapus.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menghapus ingredient.");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="font-display text-xl font-semibold text-ink">Inventory</p>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus size={16} />
          Tambah Ingredient
        </Button>
      </div>

      {error && (
        <p className="mt-4 rounded-xl bg-danger-tint px-4 py-2 text-sm text-danger">{error}</p>
      )}

      {ingredients.length === 0 ? (
        <p className="mt-8 text-sm text-ink-muted">
          Belum ada ingredient. Nggak wajib diisi — resep per menu itu opsional,
          order tetap jalan normal buat menu yang nggak punya resep.
        </p>
      ) : (
        <div className="mt-5 divide-y divide-border rounded-2xl border border-border bg-surface">
          {ingredients.map((ing) => (
            <div key={ing.id} className="flex items-center gap-3 px-4 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">{ing.name}</p>
                <p className="font-data text-xs text-ink-muted">
                  {ing.stock_quantity} {ing.unit}
                </p>
              </div>
              <button
                onClick={() => setAdjusting(ing)}
                className="flex shrink-0 items-center gap-1.5 rounded-full bg-secondary-tint px-3 py-1.5 text-xs font-semibold text-secondary"
              >
                <Scale size={13} />
                Sesuaikan Stok
              </button>
              <button
                onClick={() => {
                  setEditing(ing);
                  setFormOpen(true);
                }}
                className="flex shrink-0 items-center gap-1 text-sm text-ink-muted underline"
              >
                <Pencil size={13} />
                Edit
              </button>
              <button
                onClick={() => handleDelete(ing)}
                className="flex shrink-0 items-center gap-1 text-sm text-danger underline"
              >
                <Trash2 size={13} />
                Hapus
              </button>
            </div>
          ))}
        </div>
      )}

      <IngredientFormSheet
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
        editing={editing}
      />
      <StockAdjustModal
        ingredient={adjusting}
        onClose={() => setAdjusting(null)}
        onSaved={handleSaved}
      />
      {dialog}
    </div>
  );
}
