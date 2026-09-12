# DineFlow

Platform pemesanan & manajemen restoran berbasis QR code — dari meja
pelanggan sampai dashboard pemilik, semuanya terhubung dan real-time.

**Scan. Order. Enjoy.**

## Fitur

**Untuk pelanggan**
- Scan QR code di meja → langsung ke menu, tanpa install aplikasi
- Checkout & bayar (cash atau QRIS)
- Tracking pesanan real-time, lengkap dengan estimasi waktu masak
  (countdown, dihitung dari item terlama yang dipesan)
- Bukti pembayaran digital yang bisa dicetak/disimpan sebagai PDF
- Landing page publik per restoran (profil + menu lengkap) buat
  ditemukan sebelum pelanggan datang

**Untuk dapur**
- Kitchen Display System real-time (WebSocket) — pesanan masuk langsung
  ke layar, update status tanpa kertas

**Untuk admin/owner**
- Dashboard live: ringkasan penjualan, menu terlaris, status pesanan aktif,
  ketersediaan meja, dan ingredient yang stoknya menipis
- Kelola menu — kategori, harga, foto, estimasi waktu masak
- Kelola meja + generate QR code per meja
- Inventory & resep — hubungkan ingredient ke tiap menu, stok
  ke-deduct otomatis begitu ada order masuk
- Kelola staf dengan role-based access (owner/manager/cashier/kitchen/staff)
- Preview & cetak struk per transaksi
- Pengaturan profil restoran (deskripsi buat landing page publik)

## Arsitektur

Repo ini punya tiga komponen independen:

| Folder | Stack | Fungsi |
|---|---|---|
| [`dineflow-backend/`](./dineflow-backend) | Go, Gin, PostgreSQL | REST API + WebSocket |
| [`dineflow-frontend/`](./dineflow-frontend) | Next.js, TypeScript, Tailwind CSS | Web app (customer, admin, kitchen) |
| [`dineflow-mobile/`](./dineflow-mobile) | Capacitor | Wrapper native Android/iOS dari frontend |

```
Pelanggan (HP)  ──scan QR──►  dineflow-frontend  ──REST + WebSocket──►  dineflow-backend  ──►  PostgreSQL
Admin/Dapur (browser/app) ──►  dineflow-frontend  ──REST + WebSocket──►  dineflow-backend
dineflow-mobile hanya membungkus dineflow-frontend jadi APK/IPA — tidak
punya logic sendiri, lihat README-nya buat alasannya.
```

## Quick Start

Tiap folder punya README sendiri dengan detail lengkap (struktur kode,
skema database, semua endpoint, dan catatan implementasi) — ringkasan buat
jalanin semuanya secara lokal:

```bash
# 1. Backend
cd dineflow-backend
cp .env.example .env
docker compose up -d postgres
make migrate-up
make seed          # opsional — isi menu, ingredient, resep, & deskripsi contoh
make run           # http://localhost:8080

# 2. Frontend (di terminal baru)
cd dineflow-frontend
cp .env.local.example .env.local
npm install
npm run dev        # http://localhost:3000

# 3. Mobile (opsional, cuma perlu kalau mau build APK/IPA)
cd dineflow-mobile
npm install
npx cap sync
```

Detail lengkap ada di README masing-masing folder — termasuk cara testing
alur penuh (register → order → bayar → dapur proses → selesai) lewat curl,
cara nyoba QRIS tanpa gateway asli, dan variabel environment yang perlu
diisi.

## Tech Stack

- **Backend**: Go 1.22, Gin, PostgreSQL, JWT, WebSocket (`gorilla/websocket`),
  Midtrans (payment gateway asli, dengan mock gateway buat development)
- **Frontend**: Next.js 16 (App Router), TypeScript, Tailwind CSS v4, React 19
- **Mobile**: Capacitor (Android & iOS)

## Status

Dikerjain bertahap — tiap README folder punya bagian "Status"/"Phase N"
yang mencatat detail tiap fitur, apa yang sudah dites, dan bug apa aja
yang ketemu+diperbaiki di sepanjang jalan (termasuk beberapa yang cuma
kelihatan lewat testing runtime asli, bukan dari baca kode doang). Backend
diverifikasi dengan `go build`/`go vet`/`gofmt` plus testing end-to-end
pakai PostgreSQL asli; frontend dengan `tsc --noEmit`/`next build`/`eslint`.

## Dibuat oleh

**Eko Aryanto** — [GitHub](https://github.com/chochocookies) ·
[Portfolio](https://ekoaryanto-porto.vercel.app)
