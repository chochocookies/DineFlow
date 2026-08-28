"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { ApiError, deleteMenu, listAllMenus, updateMenu } from "@/lib/api";
import { formatRupiah } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { MenuFormSheet } from "@/components/admin/menu-form-sheet";
import { RecipeFormSheet } from "@/components/admin/recipe-form-sheet";
import { menuImageUrl } from "@/lib/placeholder";
import { ChefHat, Pencil, Plus, Trash2 } from "lucide-react";
import type { Menu } from "@/lib/types";

export default function MenuManagementPage() {
  const { token } = useAuth();
  const toast = useToast();
  const { confirm, dialog } = useConfirmDialog();
  const [menus, setMenus] = useState<Menu[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Menu | null>(null);
  const [recipeFor, setRecipeFor] = useState<Menu | null>(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    try {
      setMenus(await listAllMenus(token));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal memuat menu.");
    }
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(menu: Menu) {
    setEditing(menu);
    setFormOpen(true);
  }

  function handleSaved(saved: Menu) {
    setMenus((prev) => {
      const exists = prev.some((m) => m.id === saved.id);
      return exists ? prev.map((m) => (m.id === saved.id ? saved : m)) : [...prev, saved];
    });
    toast.success(`Menu "${saved.name}" berhasil disimpan.`);
  }

  async function toggleAvailable(menu: Menu) {
    try {
      const updated = await updateMenu(token, menu.id, {
        is_available: !menu.is_available,
      });
      setMenus((prev) => prev.map((m) => (m.id === menu.id ? updated : m)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal mengubah status menu.");
    }
  }

  async function handleDelete(menu: Menu) {
    const ok = await confirm({
      message: `Hapus "${menu.name}"? Tindakan ini tidak bisa dibatalkan.`,
      confirmLabel: "Hapus",
    });
    if (!ok) return;
    try {
      await deleteMenu(token, menu.id);
      setMenus((prev) => prev.filter((m) => m.id !== menu.id));
      toast.success(`Menu "${menu.name}" berhasil dihapus.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menghapus menu.");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="font-display text-xl font-semibold text-ink">Menu</p>
        <Button onClick={openCreate}>
          <Plus size={16} />
          Tambah Menu
        </Button>
      </div>

      {error && (
        <p className="mt-4 rounded-xl bg-danger-tint px-4 py-2 text-sm text-danger">{error}</p>
      )}

      {menus.length === 0 ? (
        <p className="mt-8 text-sm text-ink-muted">
          Belum ada menu.{" "}
          <code className="font-data rounded bg-border px-1.5 py-0.5 text-xs">make seed</code>{" "}
          di backend bisa ngisiin contoh menu sekaligus, atau tambahkan yang
          pertama secara manual.
        </p>
      ) : (
        <div className="mt-5 divide-y divide-border rounded-2xl border border-border bg-surface">
          {menus.map((menu) => (
            <div key={menu.id} className="flex items-center gap-3 px-4 py-3.5">
              <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-primary-tint">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={menuImageUrl(menu)}
                  alt={menu.name}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">{menu.name}</p>
                <p className="text-xs text-ink-muted">
                  {menu.category} · {formatRupiah(menu.price)}
                </p>
              </div>
              <button
                onClick={() => toggleAvailable(menu)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                  menu.is_available
                    ? "bg-success-tint text-success"
                    : "bg-border text-ink-muted"
                }`}
              >
                {menu.is_available ? "Tersedia" : "Nonaktif"}
              </button>
              <button
                onClick={() => setRecipeFor(menu)}
                className="flex shrink-0 items-center gap-1 text-sm text-ink-muted underline"
              >
                <ChefHat size={13} />
                Resep
              </button>
              <button
                onClick={() => openEdit(menu)}
                className="flex shrink-0 items-center gap-1 text-sm text-ink-muted underline"
              >
                <Pencil size={13} />
                Edit
              </button>
              <button
                onClick={() => handleDelete(menu)}
                className="flex shrink-0 items-center gap-1 text-sm text-danger underline"
              >
                <Trash2 size={13} />
                Hapus
              </button>
            </div>
          ))}
        </div>
      )}

      <MenuFormSheet
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
        editing={editing}
      />
      <RecipeFormSheet menu={recipeFor} onClose={() => setRecipeFor(null)} />
      {dialog}
    </div>
  );
}
