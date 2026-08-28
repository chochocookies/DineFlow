"use client";

import { useEffect, useState } from "react";
import {
  ApiError,
  getMenuRecipe,
  listIngredients,
  setMenuRecipe,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import type { Ingredient, Menu } from "@/lib/types";

export function RecipeFormSheet({
  menu,
  onClose,
}: {
  menu: Menu | null;
  onClose: () => void;
}) {
  const { token } = useAuth();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!menu) return;
    setLoading(true);
    setError(null);
    Promise.all([listIngredients(token), getMenuRecipe(token, menu.id)])
      .then(([allIngredients, recipe]) => {
        setIngredients(allIngredients);
        const map: Record<string, string> = {};
        for (const line of recipe) map[line.ingredient_id] = String(line.quantity_per_unit);
        setQuantities(map);
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Gagal memuat resep."),
      )
      .finally(() => setLoading(false));
  }, [menu, token]);

  if (!menu) return null;

  async function handleSave() {
    setSubmitting(true);
    setError(null);
    try {
      const items = Object.entries(quantities)
        .map(([ingredient_id, qty]) => ({
          ingredient_id,
          quantity_per_unit: Number(qty),
        }))
        .filter((item) => item.quantity_per_unit > 0);
      await setMenuRecipe(token, menu!.id, items);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menyimpan resep.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40"
      onClick={onClose}
    >
      <div
        className="fixed inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-3xl bg-surface p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="font-display text-xl font-semibold text-ink">Resep</p>
            <p className="text-sm text-ink-muted">{menu.name}</p>
          </div>
          <button onClick={onClose} aria-label="Tutup" className="flex h-8 w-8 items-center justify-center rounded-full bg-bg text-ink-muted">
            ✕
          </button>
        </div>

        {loading ? (
          <p className="mt-6 text-sm text-ink-muted">Memuat…</p>
        ) : ingredients.length === 0 ? (
          <p className="mt-6 text-sm text-ink-muted">
            Belum ada ingredient. Tambahkan dulu di halaman Inventory sebelum
            bisa pasang resep.
          </p>
        ) : (
          <>
            <p className="mt-4 text-xs text-ink-muted">
              Isi berapa banyak dipakai per 1 porsi menu ini. Kosongkan atau isi 0
              buat ingredient yang nggak dipakai.
            </p>
            <div className="mt-3 space-y-3">
              {ingredients.map((ing) => (
                <div key={ing.id} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-ink">{ing.name}</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={quantities[ing.id] ?? ""}
                      onChange={(e) =>
                        setQuantities({ ...quantities, [ing.id]: e.target.value })
                      }
                      placeholder="0"
                      className="font-data w-24 rounded-lg border border-border bg-bg px-2.5 py-1.5 text-right text-sm text-ink placeholder:text-ink-muted focus:border-primary"
                    />
                    <span className="w-8 text-xs text-ink-muted">{ing.unit}</span>
                  </div>
                </div>
              ))}
            </div>

            {error && (
              <p className="mt-4 rounded-xl bg-danger-tint px-3 py-2 text-sm text-danger">{error}</p>
            )}

            <Button onClick={handleSave} disabled={submitting} size="lg" className="mt-5 w-full">
              {submitting ? "Menyimpan…" : "Simpan Resep"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
