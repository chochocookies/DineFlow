import { LoginForm } from "@/components/auth/login-form";

export default function KitchenLoginPage() {
  return (
    <LoginForm
      title="DineFlow Kitchen"
      subtitle="Masuk pakai akun staf untuk buka Kitchen Display."
      redirectTo="/kitchen"
    />
  );
}
