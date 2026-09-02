"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ApiError, register } from "@/lib/api";
import { setStoredAuth } from "@/lib/auth";
import { firstAccessiblePage } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";

// Mirrors internal/auth.RegisterRequest's binding tags exactly (min=2 on
// both name fields, min=8 on password) so an obviously-invalid submission
// gets caught here instead of round-tripping to the backend just to learn
// the same thing. It's a client-side convenience on top of the backend's
// checks, not a replacement for them — the backend still validates
// everything again regardless of what this function decides.
function validate(fields: {
  restaurantName: string;
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}): string | null {
  if (fields.restaurantName.trim().length < 2) {
    return "Nama restoran minimal 2 karakter.";
  }
  if (fields.name.trim().length < 2) {
    return "Nama kamu minimal 2 karakter.";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
    return "Format email tidak valid.";
  }
  if (fields.password.length < 8) {
    return "Password minimal 8 karakter.";
  }
  if (fields.password !== fields.confirmPassword) {
    return "Konfirmasi password tidak cocok dengan password.";
  }
  return null;
}

export function RegisterForm() {
  const router = useRouter();
  const [restaurantName, setRestaurantName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const validationError = validate({ restaurantName, name, email, password, confirmPassword });
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await register(restaurantName, name, email, password);
      setStoredAuth({ token: res.token, staff: res.staff });
      router.push(firstAccessiblePage(res.staff.role));
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Gagal mendaftar. Coba lagi.",
      );
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-kds-bg px-6 py-10">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl bg-kds-surface p-7"
      >
        <p className="font-display text-2xl font-semibold text-kds-text">
          Daftarkan Restoran
        </p>
        <p className="mt-1 text-sm text-kds-muted">
          Satu akun buat kelola menu, meja, pesanan, dan staf restoran kamu.
        </p>

        <label className="mt-6 block text-sm text-kds-muted">
          Nama Restoran
          <input
            required
            value={restaurantName}
            onChange={(e) => setRestaurantName(e.target.value)}
            placeholder="Kopi Kita"
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-kds-bg px-3.5 py-2.5 text-kds-text placeholder:text-kds-muted focus:border-kds-preparing"
          />
        </label>

        <label className="mt-4 block text-sm text-kds-muted">
          Nama Kamu
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Pemilik / penanggung jawab"
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-kds-bg px-3.5 py-2.5 text-kds-text placeholder:text-kds-muted focus:border-kds-preparing"
          />
        </label>

        <label className="mt-4 block text-sm text-kds-muted">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="kamu@restoran.test"
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-kds-bg px-3.5 py-2.5 text-kds-text placeholder:text-kds-muted focus:border-kds-preparing"
          />
        </label>

        <label className="mt-4 block text-sm text-kds-muted">
          Password
          <PasswordInput
            value={password}
            onChange={setPassword}
            placeholder="Minimal 8 karakter"
            autoComplete="new-password"
          />
        </label>

        <label className="mt-4 block text-sm text-kds-muted">
          Konfirmasi Password
          <PasswordInput
            value={confirmPassword}
            onChange={setConfirmPassword}
            placeholder="Ulangi password"
            autoComplete="new-password"
          />
        </label>

        {error && (
          <p className="mt-4 rounded-xl bg-kds-urgent/15 px-3 py-2 text-sm text-kds-urgent">
            {error}
          </p>
        )}

        <Button type="submit" disabled={submitting} size="lg" className="mt-6 w-full">
          {submitting ? "Mendaftar…" : "Daftar"}
        </Button>
      </form>

      <p className="text-sm text-kds-muted">
        Sudah punya akun?{" "}
        <Link href="/admin/login" className="text-kds-text underline">
          Masuk di sini
        </Link>
      </p>
    </main>
  );
}
