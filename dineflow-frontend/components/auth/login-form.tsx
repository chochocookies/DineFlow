"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, login } from "@/lib/api";
import { setStoredAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";

export function LoginForm({
  title,
  subtitle,
  redirectTo,
  footer,
}: {
  title: string;
  subtitle: string;
  /** Either a fixed path, or a function of the logged-in staff's role —
   *  the admin login uses the latter so each role lands on the first page
   *  it's actually allowed to use (see lib/permissions.ts). */
  redirectTo: string | ((role: string) => string);
  /** Optional content below the form — e.g. admin login's "belum punya
   *  akun? Daftar" link. Kept out of this component's own markup since
   *  only the admin login needs it, not kitchen login. */
  footer?: React.ReactNode;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await login(email, password);
      setStoredAuth({ token: res.token, staff: res.staff });
      const target =
        typeof redirectTo === "function" ? redirectTo(res.staff.role) : redirectTo;
      router.push(target);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Gagal masuk. Coba lagi.",
      );
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-kds-bg px-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl bg-kds-surface p-7"
      >
        <p className="font-display text-2xl font-semibold text-kds-text">
          {title}
        </p>
        <p className="mt-1 text-sm text-kds-muted">{subtitle}</p>

        <label className="mt-6 block text-sm text-kds-muted">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-kds-bg px-3.5 py-2.5 text-kds-text placeholder:text-kds-muted focus:border-kds-preparing"
            placeholder="kamu@restoran.test"
          />
        </label>

        <label className="mt-4 block text-sm text-kds-muted">
          Password
          <PasswordInput
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </label>

        {error && (
          <p className="mt-4 rounded-xl bg-kds-urgent/15 px-3 py-2 text-sm text-kds-urgent">
            {error}
          </p>
        )}

        <Button type="submit" disabled={submitting} size="lg" className="mt-6 w-full">
          {submitting ? "Masuk…" : "Masuk"}
        </Button>
      </form>
      {footer}
    </main>
  );
}
