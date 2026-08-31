"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Boxes,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Settings,
  Table2,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { clearStoredAuth, getStoredAuth, type StoredAuth } from "@/lib/auth";
import { AuthProvider } from "@/lib/auth-context";
import { canAccessPage, firstAccessiblePage } from "@/lib/permissions";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/orders", label: "Pesanan", icon: ClipboardList },
  { href: "/admin/menu", label: "Menu", icon: UtensilsCrossed },
  { href: "/admin/tables", label: "Meja", icon: Table2 },
  { href: "/admin/inventory", label: "Inventory", icon: Boxes },
  { href: "/admin/staff", label: "Staf", icon: Users },
  { href: "/admin/settings", label: "Pengaturan", icon: Settings },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [auth, setAuth] = useState<StoredAuth | null | undefined>(undefined);

  useEffect(() => {
    const stored = getStoredAuth();
    if (!stored) {
      router.replace("/admin/login");
      return;
    }
    // A role that can't use this page (e.g. cashier hitting /admin/staff
    // directly by URL) gets bounced to the first page it CAN use, instead
    // of landing on something that just 403s when it tries to load data.
    if (!canAccessPage(stored.staff.role, pathname)) {
      router.replace(firstAccessiblePage(stored.staff.role));
      return;
    }
    setAuth(stored);
  }, [router, pathname]);

  // undefined = still checking localStorage; null = confirmed logged out
  // and already redirecting; role-disallowed path = also mid-redirect.
  // Render nothing in all three cases rather than a flash of admin
  // content — importantly, this also stops a disallowed page's own data
  // fetch (e.g. staff/page.tsx's listStaff()) from firing during the brief
  // moment between a same-role navigation and the redirect above landing.
  if (!auth || !canAccessPage(auth.staff.role, pathname)) return null;

  const visibleNav = NAV.filter((item) => canAccessPage(auth.staff.role, item.href));

  function logout() {
    clearStoredAuth();
    router.replace("/admin/login");
  }

  return (
    <AuthProvider value={auth}>
      <div className="min-h-dvh bg-bg">
        <header className="border-b border-border bg-surface px-5 py-4">
          <div className="mx-auto flex max-w-4xl items-center justify-between">
            <div>
              <p className="font-display text-lg font-semibold text-ink">
                DineFlow Admin
              </p>
              <p className="text-xs text-ink-muted">{auth.staff.name} · {auth.staff.role}</p>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 text-sm text-ink-muted underline"
            >
              <LogOut size={14} />
              Keluar
            </button>
          </div>
          <nav className="mx-auto mt-4 flex max-w-4xl gap-1 overflow-x-auto pb-1 [scrollbar-width:none]">
            {visibleNav.map((item) => {
              const active =
                item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-primary text-white"
                      : "text-ink-muted hover:bg-primary-tint"
                  }`}
                >
                  <Icon size={15} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <div className="mx-auto max-w-4xl px-5 py-6">{children}</div>
      </div>
    </AuthProvider>
  );
}
