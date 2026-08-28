"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { ApiError, deleteStaff, listStaff } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { StaffFormSheet } from "@/components/admin/staff-form-sheet";
import { Plus, Trash2, UserRound } from "lucide-react";
import type { StaffPublic } from "@/lib/types";

const roleLabels: Record<string, string> = {
  owner: "Owner",
  manager: "Manager",
  cashier: "Cashier",
  kitchen: "Kitchen",
  staff: "Staff",
};

export default function StaffManagementPage() {
  const { token, staff: me } = useAuth();
  const toast = useToast();
  const { confirm, dialog } = useConfirmDialog();
  const [staff, setStaff] = useState<StaffPublic[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    try {
      setStaff(await listStaff(token));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal memuat daftar staf.");
    }
  }

  async function handleDelete(member: StaffPublic) {
    const ok = await confirm({ message: `Hapus ${member.name}?`, confirmLabel: "Hapus" });
    if (!ok) return;
    setError(null);
    try {
      await deleteStaff(token, member.id);
      setStaff((prev) => prev.filter((s) => s.id !== member.id));
      toast.success(`${member.name} berhasil dihapus dari staf.`);
    } catch (err) {
      // Surfaces the backend's "cannot remove the only owner" message
      // as-is — it's already a clear, user-facing sentence.
      setError(err instanceof ApiError ? err.message : "Gagal menghapus staf.");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="font-display text-xl font-semibold text-ink">Staf</p>
        <Button onClick={() => setFormOpen(true)}>
          <Plus size={16} />
          Tambah Staf
        </Button>
      </div>

      {error && (
        <p className="mt-4 rounded-xl bg-danger-tint px-4 py-2 text-sm text-danger">{error}</p>
      )}

      <div className="mt-5 divide-y divide-border rounded-2xl border border-border bg-surface">
        {staff.map((member) => (
          <div key={member.id} className="flex items-center gap-3 px-4 py-3.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary">
              <UserRound size={17} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-ink">
                {member.name}
                {member.id === me.id && (
                  <span className="ml-2 text-xs text-ink-muted">(kamu)</span>
                )}
              </p>
              <p className="truncate text-xs text-ink-muted">{member.email}</p>
            </div>
            <span className="shrink-0 rounded-full bg-primary-tint px-3 py-1 text-xs font-semibold text-primary">
              {roleLabels[member.role] ?? member.role}
            </span>
            <button
              onClick={() => handleDelete(member)}
              className="flex shrink-0 items-center gap-1 text-sm text-danger underline"
            >
              <Trash2 size={13} />
              Hapus
            </button>
          </div>
        ))}
      </div>

      <StaffFormSheet
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onCreated={(s) => {
          setStaff((prev) => [...prev, s]);
          toast.success(`${s.name} berhasil ditambahkan sebagai staf.`);
        }}
      />
      {dialog}
    </div>
  );
}
