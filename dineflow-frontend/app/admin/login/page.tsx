"use client";

import { LoginForm } from "@/components/auth/login-form";
import { firstAccessiblePage } from "@/lib/permissions";

export default function AdminLoginPage() {
  return (
    <LoginForm
      title="DineFlow Admin"
      subtitle="Masuk untuk kelola menu, meja, dan lihat laporan penjualan."
      redirectTo={firstAccessiblePage}
    />
  );
}
