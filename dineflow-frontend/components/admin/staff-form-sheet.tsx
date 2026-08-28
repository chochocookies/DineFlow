"use client";

import { FormEvent, useState } from "react";
import { ApiError, createStaff } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import type { StaffPublic } from "@/lib/types";

const ROLES = [
  { value: "owner", label: "Owner" },
  { value: "manager", label: "Manager" },
  { value: "cashier", label: "Cashier" },
  { value: "kitchen", label: "Kitchen" },
  { value: "staff", label: "Staff" },
];

export function StaffFormSheet({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (staff: StaffPublic) => void;
}) {
  const { token } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("staff");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const staff = await createStaff(token, { name, email, password, role });
      onCreated(staff);
      setName("");
      setEmail("");
      setPassword("");
      setRole("staff");
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menambah staf.");
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
        aria-label="Tambah staf"
      >
        <div className="flex items-center justify-between">
          <p className="font-display text-xl font-semibold text-ink">Tambah Staf</p>
          <button onClick={onClose} aria-label="Tutup" className="flex h-8 w-8 items-center justify-center rounded-full bg-bg text-ink-muted">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <label className="block text-sm font-medium text-ink">
            Nama
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm text-ink focus:border-primary"
            />
          </label>

          <label className="block text-sm font-medium text-ink">
            Email
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm text-ink focus:border-primary"
            />
          </label>

          <label className="block text-sm font-medium text-ink">
            Password
            <input
              required
              type="password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm text-ink focus:border-primary"
            />
          </label>

          <label className="block text-sm font-medium text-ink">
            Role
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm text-ink focus:border-primary"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>

          {error && (
            <p className="rounded-xl bg-danger-tint px-3 py-2 text-sm text-danger">{error}</p>
          )}

          <Button type="submit" disabled={submitting} size="lg" className="w-full">
            {submitting ? "Menyimpan…" : "Tambah Staf"}
          </Button>
        </form>
      </div>
    </>
  );
}
