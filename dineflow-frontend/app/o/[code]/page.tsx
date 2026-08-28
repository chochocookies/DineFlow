import { ApiError, getOrderByCode } from "@/lib/api";
import { OrderTracker } from "@/components/order/order-tracker";

export default async function OrderStatusPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  try {
    const order = await getOrderByCode(code);
    return <OrderTracker code={code} initialOrder={order} />;
  } catch (err) {
    const isNotFound = err instanceof ApiError && err.status === 404;
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg px-6 text-center">
        <p className="font-display text-2xl font-semibold text-ink">
          {isNotFound ? "Pesanan tidak ditemukan" : "Tidak bisa memuat pesanan"}
        </p>
        <p className="max-w-sm text-ink-muted">
          {isNotFound
            ? `Kode pesanan "${code}" nggak ketemu. Cek lagi kode-nya atau tanya staf restoran.`
            : "Terjadi kesalahan saat memuat pesanan. Coba muat ulang halaman ini."}
        </p>
      </main>
    );
  }
}
