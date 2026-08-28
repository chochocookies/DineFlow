import { ApiError, getPublicMenus, getTableByQrToken } from "@/lib/api";
import { CartProvider } from "@/lib/cart-context";
import { MenuBrowser } from "@/components/menu/menu-browser";

export default async function OrderPage({
  params,
}: {
  params: Promise<{ qrToken: string }>;
}) {
  const { qrToken } = await params;

  try {
    const tableInfo = await getTableByQrToken(qrToken);
    const menus = await getPublicMenus(tableInfo.table.restaurant_id);

    return (
      <CartProvider qrToken={qrToken}>
        <MenuBrowser qrToken={qrToken} tableInfo={tableInfo} menus={menus} />
      </CartProvider>
    );
  } catch (err) {
    return <QrErrorState error={err} />;
  }
}

function QrErrorState({ error }: { error: unknown }) {
  const isNotFound = error instanceof ApiError && error.status === 404;
  const isUnreachable = error instanceof ApiError && error.status === 0;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg px-6 text-center">
      <p className="font-display text-2xl font-semibold text-ink">
        {isNotFound ? "Kode meja tidak ditemukan" : "Tidak bisa memuat menu"}
      </p>
      <p className="max-w-sm text-ink-muted">
        {isNotFound
          ? "QR code ini sepertinya sudah tidak berlaku. Coba scan ulang QR code yang ada di meja kamu."
          : isUnreachable
            ? "Server DineFlow belum bisa dihubungi. Kalau kamu tim development, pastikan backend-nya sudah jalan."
            : "Terjadi kesalahan saat memuat data. Coba scan ulang QR code di meja kamu."}
      </p>
    </main>
  );
}
