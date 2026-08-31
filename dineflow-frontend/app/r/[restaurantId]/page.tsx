import { ApiError, getPublicMenus, getRestaurantProfile } from "@/lib/api";
import { formatRupiah } from "@/lib/format";
import { menuImageUrl } from "@/lib/placeholder";
import { Clock, QrCode, UtensilsCrossed } from "lucide-react";
import type { Menu } from "@/lib/types";

// A pure server component on purpose — nothing here needs client state
// (no cart, no interactivity), so it ships zero extra JS. Ordering itself
// still only happens through the QR-code flow at /order/[qrToken]; this
// page's job is letting someone find and browse a restaurant BEFORE
// they're at a table, which that flow can't do since it requires a table's
// QR token up front.
export default async function RestaurantLandingPage({
  params,
}: {
  params: Promise<{ restaurantId: string }>;
}) {
  const { restaurantId } = await params;

  try {
    const [restaurant, menus] = await Promise.all([
      getRestaurantProfile(restaurantId),
      getPublicMenus(restaurantId),
    ]);

    const grouped = new Map<string, Menu[]>();
    for (const m of menus) {
      const list = grouped.get(m.category) ?? [];
      list.push(m);
      grouped.set(m.category, list);
    }

    return (
      <main className="mx-auto min-h-dvh max-w-2xl bg-bg px-5 pb-16 pt-10">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary-tint text-primary">
            <UtensilsCrossed size={26} />
          </div>
          <h1 className="font-display mt-3 text-2xl font-semibold text-ink">
            {restaurant.name}
          </h1>
          {restaurant.description && (
            <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-ink-muted">
              {restaurant.description}
            </p>
          )}
        </div>

        <div className="animate-in mt-6 flex items-center gap-2 rounded-2xl border border-dashed border-primary/40 bg-primary-tint px-4 py-3 text-sm text-primary">
          <QrCode size={18} className="shrink-0" />
          Untuk memesan, scan QR code yang ada di meja restoran ini.
        </div>

        {menus.length === 0 ? (
          <p className="mt-10 text-center text-sm text-ink-muted">
            Menu belum tersedia saat ini.
          </p>
        ) : (
          <div className="mt-8 space-y-8">
            {[...grouped.entries()].map(([category, items]) => (
              <section key={category}>
                <p className="font-display mb-3 font-semibold text-ink">{category}</p>
                <div className="divide-y divide-border rounded-2xl border border-border bg-surface">
                  {items.map((menu, i) => (
                    <div
                      key={menu.id}
                      className="animate-in flex gap-3 p-4"
                      style={{ animationDelay: `${Math.min(i, 8) * 40}ms`, animationFillMode: "backwards" }}
                    >
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-primary-tint">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={menuImageUrl(menu)}
                          alt={menu.name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-display font-medium text-ink">{menu.name}</p>
                        {menu.description && (
                          <p className="mt-0.5 line-clamp-2 text-sm text-ink-muted">
                            {menu.description}
                          </p>
                        )}
                        <div className="mt-1.5 flex items-center gap-3">
                          <span className="font-data text-sm font-medium text-ink">
                            {formatRupiah(menu.price)}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-ink-muted">
                            <Clock size={12} />
                            ~{menu.prep_time_minutes} menit
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    );
  } catch (err) {
    return <LandingErrorState error={err} />;
  }
}

function LandingErrorState({ error }: { error: unknown }) {
  const isNotFound = error instanceof ApiError && error.status === 404;
  const isUnreachable = error instanceof ApiError && error.status === 0;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg px-6 text-center">
      <p className="font-display text-2xl font-semibold text-ink">
        {isNotFound ? "Restoran tidak ditemukan" : "Tidak bisa memuat halaman"}
      </p>
      <p className="max-w-sm text-ink-muted">
        {isNotFound
          ? "Link restoran ini sepertinya sudah tidak berlaku."
          : isUnreachable
            ? "Server DineFlow belum bisa dihubungi. Kalau kamu tim development, pastikan backend-nya sudah jalan."
            : "Terjadi kesalahan saat memuat data restoran."}
      </p>
    </main>
  );
}
