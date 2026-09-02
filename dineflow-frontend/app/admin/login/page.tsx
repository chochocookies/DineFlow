"use client";

import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { firstAccessiblePage } from "@/lib/permissions";

export default function AdminLoginPage() {
  return (
    <LoginForm
      title="DineFlow Admin"
      subtitle="Masuk untuk kelola menu, meja, dan lihat laporan penjualan."
      redirectTo={firstAccessiblePage}
      footer={
        <p className="text-sm text-kds-muted">
          Restoran baru?{" "}
          <Link href="/register" className="text-kds-text underline">
            Daftar di sini
          </Link>
        </p>
      }
    />
  );
}
