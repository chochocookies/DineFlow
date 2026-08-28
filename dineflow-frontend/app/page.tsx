"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  const router = useRouter();
  const [token, setToken] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (token.trim()) router.push(`/order/${token.trim()}`);
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-bg px-6 text-center">
      <div>
        <p className="font-display text-4xl font-semibold text-ink">
          DineFlow
        </p>
        <p className="mt-1 text-ink-muted">Scan. Order. Enjoy.</p>
      </div>

      <p className="max-w-sm text-sm text-ink-muted">
        Biasanya kamu sampai di sini lewat scan QR code yang ada di meja
        restoran. Untuk coba-coba secara lokal, masukkan{" "}
        <code className="font-data rounded bg-primary-tint px-1.5 py-0.5 text-primary">
          qr_token
        </code>{" "}
        sebuah meja secara manual:
      </p>

      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-3">
        <input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="qr_token dari POST /tables"
          className="font-data w-full rounded-full border border-border bg-surface px-4 py-3 text-center text-sm text-ink placeholder:text-ink-muted focus:border-primary"
        />
        <Button type="submit" size="lg">
          Buka Menu
        </Button>
      </form>

      <div className="flex gap-4 text-sm text-ink-muted">
        <a href="/admin/login" className="underline underline-offset-4">
          Masuk sebagai admin →
        </a>
        <a href="/kitchen/login" className="underline underline-offset-4">
          Masuk sebagai staf dapur →
        </a>
      </div>
    </main>
  );
}
