"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Boxes,
  ChefHat,
  CircleCheckBig,
  FlaskConical,
  LayoutDashboard,
  QrCode,
  UtensilsCrossed,
} from "lucide-react";

const FEATURES = [
  {
    icon: QrCode,
    title: "Pesan via QR Code",
    body: "Pelanggan scan kode di meja dan pesan langsung dari HP mereka sendiri — nggak perlu install aplikasi apapun.",
  },
  {
    icon: ChefHat,
    title: "Kitchen Display Real-time",
    body: "Pesanan masuk langsung ke layar dapur, update status tanpa kertas dan tanpa teriak-teriak lintas ruangan.",
  },
  {
    icon: LayoutDashboard,
    title: "Dashboard Live",
    body: "Pantau penjualan, menu terlaris, status meja, dan pesanan aktif — semuanya real-time dari satu layar.",
  },
  {
    icon: Boxes,
    title: "Kelola Stok & Resep",
    body: "Lacak bahan baku dan hubungkan ke resep tiap menu, biar nggak kehabisan stok tanpa sadar.",
  },
];

const STEPS = [
  {
    icon: QrCode,
    label: "Scan",
    body: "Pelanggan scan QR code yang ada di meja restoran kamu.",
  },
  {
    icon: UtensilsCrossed,
    label: "Order",
    body: "Pilih menu, checkout, bayar cash atau QRIS — semuanya dari HP mereka.",
  },
  {
    icon: CircleCheckBig,
    label: "Enjoy",
    body: "Dapur masak, pelanggan dapat update real-time sampai pesanan siap, plus struk digital.",
  },
];

export default function HomePage() {
  const router = useRouter();
  const [token, setToken] = useState("");

  function handleTestSubmit(e: FormEvent) {
    e.preventDefault();
    if (token.trim()) router.push(`/order/${token.trim()}`);
  }

  return (
    <main className="min-h-dvh bg-bg">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-6">
        <p className="font-display text-xl font-semibold text-ink">DineFlow</p>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/admin/login" className="text-ink-muted underline-offset-4 hover:underline">
            Masuk
          </Link>
          <Button size="md" onClick={() => router.push("/register")}>
            Daftar Gratis
          </Button>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-3xl px-5 pb-16 pt-10 text-center sm:pt-16">
        <div className="animate-in">
          <p className="font-display text-5xl font-semibold text-ink sm:text-6xl">
            DineFlow
          </p>
          <p className="font-display mt-2 text-xl text-primary sm:text-2xl">
            Scan. Order. Enjoy.
          </p>
        </div>
        <p
          className="animate-in mx-auto mt-6 max-w-xl text-base leading-relaxed text-ink-muted sm:text-lg"
          style={{ animationDelay: "80ms", animationFillMode: "backwards" }}
        >
          Platform pemesanan &amp; manajemen restoran berbasis QR code — dari
          meja pelanggan sampai dashboard kamu, semuanya terhubung dan
          real-time.
        </p>
        <div
          className="animate-in mt-8 flex flex-wrap items-center justify-center gap-3"
          style={{ animationDelay: "160ms", animationFillMode: "backwards" }}
        >
          <Button size="lg" onClick={() => router.push("/register")}>
            Daftarkan Restoran Kamu
          </Button>
          <Button size="lg" variant="secondary" onClick={() => router.push("/admin/login")}>
            Masuk ke Akun
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-5 py-10">
        <p className="font-display text-center text-2xl font-semibold text-ink">
          Kenapa DineFlow?
        </p>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className="animate-in rounded-2xl border border-border bg-surface p-5 transition-transform duration-200 hover:-translate-y-1"
              style={{ animationDelay: `${i * 60}ms`, animationFillMode: "backwards" }}
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-tint text-primary">
                <f.icon size={22} />
              </div>
              <p className="font-display mt-3 font-semibold text-ink">{f.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-4xl px-5 py-10">
        <p className="font-display text-center text-2xl font-semibold text-ink">
          Cara Kerjanya
        </p>
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <div
              key={s.label}
              className="animate-in text-center"
              style={{ animationDelay: `${i * 80}ms`, animationFillMode: "backwards" }}
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-secondary-tint text-secondary">
                <s.icon size={26} />
              </div>
              <p className="font-display mt-3 font-semibold text-ink">
                {i + 1}. {s.label}
              </p>
              <p className="mx-auto mt-1 max-w-xs text-sm leading-relaxed text-ink-muted">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Local testing utility — preserved from the original page, just
          demoted to its own clearly-labeled section instead of being the
          entire homepage. Only meaningful for local development: a real
          customer always arrives via an actual QR scan, never by typing a
          qr_token in by hand. */}
      <section className="mx-auto max-w-md px-5 py-10">
        <div className="animate-in rounded-2xl border border-dashed border-border bg-surface p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-ink">
            <FlaskConical size={16} className="text-secondary" />
            Mode Testing Lokal
          </div>
          <p className="mt-1.5 text-sm text-ink-muted">
            Biasanya pelanggan sampai di halaman menu lewat scan QR code di
            meja. Buat coba-coba tanpa QR fisik, masukkan{" "}
            <code className="font-data rounded bg-primary-tint px-1.5 py-0.5 text-primary">
              qr_token
            </code>{" "}
            sebuah meja secara manual:
          </p>
          <form onSubmit={handleTestSubmit} className="mt-4 flex flex-col gap-3">
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="qr_token dari POST /tables"
              className="font-data w-full rounded-full border border-border bg-bg px-4 py-3 text-center text-sm text-ink placeholder:text-ink-muted focus:border-primary"
            />
            <Button type="submit" variant="secondary">
              Buka Menu
            </Button>
          </form>
        </div>
      </section>

      <footer className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-5 pb-10 pt-4 text-sm text-ink-muted">
        <div className="flex flex-wrap justify-center gap-4">
          <Link href="/admin/login" className="underline underline-offset-4">
            Masuk sebagai admin →
          </Link>
          <Link href="/kitchen/login" className="underline underline-offset-4">
            Masuk sebagai staf dapur →
          </Link>
        </div>
        <p className="text-xs">DineFlow — dibuat buat restoran Indonesia.</p>
      </footer>
    </main>
  );
}
