const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatRupiah(amount: number): string {
  return rupiah.format(amount);
}

const statusLabels: Record<string, string> = {
  pending: "Menunggu Konfirmasi",
  confirmed: "Dikonfirmasi",
  preparing: "Sedang Dimasak",
  ready: "Siap Diambil",
  served: "Sudah Diantar",
  completed: "Selesai",
  cancelled: "Dibatalkan",
  unpaid: "Belum Dibayar",
  paid: "Sudah Dibayar",
};

export function statusLabel(status: string): string {
  return statusLabels[status] ?? status;
}
