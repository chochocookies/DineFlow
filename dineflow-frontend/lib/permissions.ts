// Mirrors cmd/api/main.go's actual middleware.RequireRole(...) gates —
// this list exists so the UI never shows a nav link or page that would
// just 403 once it tries to fetch. It is not itself an access-control
// boundary: the backend is what actually enforces roles; this only keeps
// the frontend honest about what each role can already do.
//
//   /dashboard/*   -> owner, manager   (internal/dashboard)
//   /ingredients/* -> owner, manager   (internal/inventory, "ingredients" group)
//   /staff/*       -> owner, manager   (internal/staff)
//   everything else staff-facing (menus, tables, orders except the
//   payment PATCH, which orders/page.tsx already gates inline) -> any
//   authenticated role
const ELEVATED_ROLES = ["owner", "manager"];

export const ADMIN_PAGES = [
  { href: "/admin", roles: ELEVATED_ROLES },
  { href: "/admin/orders", roles: null }, // null = every role
  { href: "/admin/menu", roles: null },
  { href: "/admin/tables", roles: null },
  { href: "/admin/inventory", roles: ELEVATED_ROLES },
  { href: "/admin/staff", roles: ELEVATED_ROLES },
] as const;

export function canAccessPage(role: string, href: string): boolean {
  const page = ADMIN_PAGES.find((p) => p.href === href);
  if (!page) return true; // unknown path — not this map's job to block it
  return page.roles === null || (page.roles as readonly string[]).includes(role);
}

// Where to land right after login, and where to bounce a role away from a
// page it can't use (e.g. a cashier hitting /admin/staff directly by URL).
// /admin/orders is every role's first entry above, so it's always safe.
export function firstAccessiblePage(role: string): string {
  return ADMIN_PAGES.find((p) => canAccessPage(role, p.href))?.href ?? "/admin/orders";
}
