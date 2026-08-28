"use client";

import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  ApiError,
  createTable,
  deleteTable,
  kitchenSocketUrl,
  listTables,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { TableQrModal } from "@/components/admin/table-qr-modal";
import { Plus, QrCode, Trash2 } from "lucide-react";
import type { KitchenEvent, RestaurantTable, TableStatus } from "@/lib/types";

const statusClasses: Record<TableStatus, string> = {
  available: "bg-success-tint text-success",
  occupied: "bg-secondary-tint text-secondary",
  waiting_payment: "bg-danger-tint text-danger",
};

const statusLabels: Record<TableStatus, string> = {
  available: "Tersedia",
  occupied: "Terisi",
  waiting_payment: "Menunggu Bayar",
};

export default function TableManagementPage() {
  const { token } = useAuth();
  const toast = useToast();
  const { confirm, dialog } = useConfirmDialog();
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newCode, setNewCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [qrTable, setQrTable] = useState<RestaurantTable | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live-updates a table's badge the moment its last open order is
  // completed — the visible side of the Phase 7 backend fix: a table now
  // actually flips back to "Tersedia" instead of staying "Terisi" forever.
  useEffect(() => {
    const socket = new WebSocket(kitchenSocketUrl(token));
    socket.onmessage = (msg) => {
      let evt: KitchenEvent;
      try {
        evt = JSON.parse(msg.data);
      } catch {
        return;
      }
      if (evt.event !== "table_status_updated") return;
      setTables((prev) => prev.map((t) => (t.id === evt.data.id ? evt.data : t)));
      setFlashId(evt.data.id);
      setTimeout(() => setFlashId(null), 1200);
    };
    return () => socket.close();
  }, [token]);

  async function load() {
    try {
      setTables(await listTables(token));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal memuat meja.");
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!newCode.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const table = await createTable(token, newCode.trim());
      setTables((prev) => [...prev, table]);
      setNewCode("");
      toast.success(`Meja ${table.code} berhasil ditambahkan.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menambah meja.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(table: RestaurantTable) {
    const ok = await confirm({
      message: `Hapus Meja ${table.code}? Tindakan ini tidak bisa dibatalkan.`,
      confirmLabel: "Hapus",
    });
    if (!ok) return;
    try {
      await deleteTable(token, table.id);
      setTables((prev) => prev.filter((t) => t.id !== table.id));
      toast.success(`Meja ${table.code} berhasil dihapus.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menghapus meja.");
    }
  }

  return (
    <div>
      <p className="font-display text-xl font-semibold text-ink">Meja</p>

      <form onSubmit={handleCreate} className="mt-4 flex gap-2">
        <input
          value={newCode}
          onChange={(e) => setNewCode(e.target.value)}
          placeholder="Kode meja, contoh: 05"
          className="flex-1 rounded-full border border-border bg-surface px-4 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-primary"
        />
        <Button type="submit" disabled={submitting}>
          <Plus size={16} />
          Tambah
        </Button>
      </form>

      {error && (
        <p className="mt-4 rounded-xl bg-danger-tint px-4 py-2 text-sm text-danger">{error}</p>
      )}

      {tables.length === 0 ? (
        <p className="mt-8 text-sm text-ink-muted">Belum ada meja. Tambahkan yang pertama.</p>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {tables.map((table) => (
            <div
              key={table.id}
              className={`rounded-2xl border border-border bg-surface p-4 text-center ${
                flashId === table.id ? "status-flash" : ""
              }`}
            >
              <p className="font-display text-lg font-semibold text-ink">
                {table.code}
              </p>
              <span
                className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ${statusClasses[table.status]}`}
              >
                {statusLabels[table.status]}
              </span>
              <div className="mt-3 flex flex-col gap-1.5">
                <button
                  onClick={() => setQrTable(table)}
                  className="flex items-center justify-center gap-1.5 rounded-full bg-primary-tint px-3 py-1.5 text-xs font-semibold text-primary"
                >
                  <QrCode size={13} />
                  Lihat QR
                </button>
                <button
                  onClick={() => handleDelete(table)}
                  className="flex items-center justify-center gap-1 text-xs text-danger underline"
                >
                  <Trash2 size={12} />
                  Hapus
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <TableQrModal table={qrTable} onClose={() => setQrTable(null)} />
      {dialog}
    </div>
  );
}
