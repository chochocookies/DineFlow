"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { ApiError, getMyRestaurant, updateMyRestaurant } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ExternalLink, Loader2 } from "lucide-react";

const MAX_LENGTH = 2000;

export default function SettingsPage() {
  const { token, staff } = useAuth();
  const toast = useToast();

  const [description, setDescription] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const rst = await getMyRestaurant(token);
        setDescription(rst.description ?? "");
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Gagal memuat data restoran.");
      } finally {
        setLoaded(true);
      }
    })();
  }, [token]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await updateMyRestaurant(token, description);
      toast.success("Deskripsi restoran berhasil disimpan.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menyimpan deskripsi.");
    } finally {
      setSaving(false);
    }
  }

  const landingPageHref = `/r/${staff.restaurant_id}`;

  return (
    <div>
      <p className="font-display text-xl font-semibold text-ink">Pengaturan</p>
      <p className="mt-1 text-sm text-ink-muted">
        Deskripsi ini tampil di halaman landing publik restoran kamu —
        tempat calon pelanggan lihat profil & menu sebelum datang.
      </p>

      {error && (
        <p className="mt-4 rounded-xl bg-danger-tint px-4 py-2 text-sm text-danger">{error}</p>
      )}

      {!loaded ? (
        <p className="mt-6 text-sm text-ink-muted">Memuat…</p>
      ) : (
        <div className="mt-6 rounded-2xl border border-border bg-surface p-4">
          <label className="text-sm font-medium text-ink" htmlFor="description">
            Tentang Restoran
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, MAX_LENGTH))}
            rows={6}
            placeholder="Ceritakan tentang restoran kamu — konsep, menu andalan, suasana, dsb."
            className="mt-2 w-full resize-none rounded-xl border border-border bg-bg px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-primary"
          />
          <div className="mt-1 flex justify-end">
            <span className="text-xs text-ink-muted">
              {description.length}/{MAX_LENGTH}
            </span>
          </div>

          <Button onClick={handleSave} disabled={saving} className="mt-2 w-full sm:w-auto">
            {saving && <Loader2 size={16} className="spin-slow" />}
            {saving ? "Menyimpan…" : "Simpan"}
          </Button>
        </div>
      )}

      <Link
        href={landingPageHref}
        target="_blank"
        className="mt-4 flex items-center gap-1.5 text-sm text-primary underline"
      >
        <ExternalLink size={14} />
        Lihat halaman landing publik
      </Link>
    </div>
  );
}
