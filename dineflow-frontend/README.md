# DineFlow — Frontend

Next.js frontend untuk DineFlow. Mencakup alur customer (scan → menu →
order → tracking), Kitchen Display real-time, dashboard admin (login,
kelola menu + resep, kelola meja + generate QR, kelola staf, kelola
inventory, sales summary), halaman Pesanan/Cashier, dan dukungan PWA.

## Status

- **Sudah dites beneran**, bukan cuma `npm run build` doang:
  - Backend Go dan frontend ini dijalanin bareng, halaman `/order/[qrToken]`
    dan `/o/[code]` di-curl langsung dan HTML yang di-generate server
    diperiksa — nama restoran, meja, harga (format Rupiah), dan status
    order yang muncul semuanya data asli dari PostgreSQL, bukan dummy.
  - Alur WebSocket Kitchen Display **dan** halaman Pesanan (keduanya
    connect ke `/ws/kitchen` yang sama) dites pakai script yang connect
    persis kayak kode React-nya, lalu bikin order & ubah status/pembayaran
    lewat API — semua event (`new_order`, `order_status_updated`,
    `order_payment_updated`) diterima dengan bentuk data yang sesuai
    ekspektasi komponennya.
  - Semua alur admin (login, dashboard summary, best-sellers, CRUD menu +
    toggle ketersediaan, CRUD meja, konfirmasi pembayaran cash, CRUD staf,
    CRUD ingredient + adjust stock, set/get resep menu) dites pakai script
    Node yang manggil endpoint yang sama persis dengan `lib/api.ts`,
    terhadap backend asli — termasuk kasus role `kitchen` yang kena 403 pas
    coba konfirmasi pembayaran.
  - Testing inventory ini yang **nemuin bug beneran** di backend: hapus
    ingredient yang masih dipakai di resep balikin 500 generik. Udah
    dibetulin di backend (sekarang 409 dengan pesan jelas) — kejadian ini
    justru nunjukkin kenapa testing kontrak API kayak gini penting,
    bukan cuma percaya kode-nya bakal jalan.
  - Generate QR code (`qrcode` package) dan generate icon PWA (`sharp`)
    dua-duanya dites langsung, hasilnya valid.
- **Yang JUJUR belum bisa saya verifikasi**: tampilan visual halaman-halaman
  aplikasi beneran di browser (CSS, layout, spacing). Sandbox tempat saya
  kerja nggak punya browser/screenshot tool. Icon PWA statis bisa saya
  lihat langsung (itu cuma gambar), tapi halaman web yang jalan (JS,
  routing, state) tetap di luar jangkauan saya.
- **Phase 8 (dashboard live update, struk, halaman per-role, gambar
  menu)** — `tsc --noEmit` dan `next build` dua-duanya bersih (build-nya
  malah sempat gagal beneran duluan: fungsi `firstAccessiblePage` dioper
  sebagai prop dari Server Component `admin/login/page.tsx` ke Client
  Component `LoginForm`, yang nggak boleh di Next.js App Router — sudah
  dibetulin dengan nambahin `"use client"`). Pembatasan halaman per-role
  di `lib/permissions.ts` bukan cuma dugaan dari baca kode: saya bikin
  akun tiap role (owner/manager/cashier/kitchen/staff) beneran lewat API
  dan nembak keenam endpoint yang relevan satu-satu, hasilnya PAS sama
  yang ditulis di `lib/permissions.ts` (dashboard/ingredients/staff
  403 buat cashier/kitchen/staff, sisanya 200 buat semua role). Yang
  **belum** bisa saya verifikasi: WebSocket-triggered refetch di
  dashboard, hasil cetak struk, dan animasi/placeholder gambar menu
  beneran kelihatan benar di browser — sama seperti keterbatasan di atas.
- **Phase 9 (landing page, estimasi waktu masak, fix animasi)** —
  `tsc --noEmit` dan `next build` bersih. Tiga catatan:
  - **Animasi kenapa nggak kelihatan pas `npm run dev`**: bukan bug kode —
    semua animasi (termasuk yang dari sebelum Phase 9) dibungkus
    `@media (prefers-reduced-motion: no-preference)`, jadi kalau OS/browser
    kamu lagi report `reduce` (gampang ke-set nggak sengaja di VM/remote
    desktop, atau ketinggalan nyala di Chrome DevTools' Rendering tab),
    SEMUA animasi mati serentak tanpa error apapun. Sekarang animasinya
    jalan default, dan preferensi reduced-motion cuma memperhalus
    (collapse ke durasi ~0 buat entrance/toast/modal, `animation: none`
    buat yang sifatnya pengulangan kayak pulse), bukan menghilangkan.
  - **`components/order/cooking-countdown.tsx` sempat kena error ESLint
    baru** (`react-hooks/purity`, dari versi `eslint-plugin-react-hooks`
    yang lebih strict di Next 16): manggil `Date.now()` langsung di body
    komponen dianggap "impure" karena hasilnya beda tiap render — bukan
    cuma soal gaya, di jalur fallback (kalau `preparing_started_at`
    somehow kosong) ini beneran bisa geser baseline countdown tiap
    re-render. Dipindah ke `useState(() => ...)` (lazy initializer,
    dihitung sekali doang pas mount) — errornya hilang dan bug-nya juga
    ikut kefix.
  - **`lib/permissions.ts` dapet tier baru**: `/admin/settings` khusus
    `owner` (BUKAN owner+manager kayak Dashboard/Inventory/Staff) — ini
    saya cek langsung ke `cmd/api/main.go`
    (`restaurantGroup.Use(..., RequireRole("owner"))`), terus diverifikasi
    empiris juga: bikin akun manager beneran, tembak
    `GET /restaurants/me`, hasilnya 403 (punya owner 200). Jangan disamain
    sama tier owner+manager yang lain kalau nanti nambah halaman baru di
    grup ini.

## Konsep desain

Dua identitas visual yang disengaja:
- **Sisi customer** (menu, cart, tracking): hangat, warna terinspirasi
  sambal (`#C8401E`) dan kunyit (`#DFA23B`) di atas latar krem hangat
  (`#FAF3E7`) — bukan oranye generik ala app makanan pada umumnya.
- **Kitchen Display**: gelap & utilitarian (`#17130F`), mirip KDS
  komersial beneran — biar kebaca jelas di kondisi dapur yang terang/silau.

Motif pemersatu: **"tiket robek"** (notch bulat di kiri-kanan + garis
perforasi putus-putus, lihat class `.ticket` di `app/globals.css`) dipakai
di cart, konfirmasi order, dan kartu order di Kitchen Display — karena
produk ini pada dasarnya mendigitalkan selembar tiket order dapur.

Font: **Fraunces** (display/nama menu, ada karakter), **Plus Jakarta
Sans** (UI/body — font bikinan Indonesia), **IBM Plex Mono** (kode order &
angka, kesan struk kasir). Di-self-host lewat `@fontsource` (bukan
`next/font/google`) karena sandbox tempat ini dibuat nggak bisa akses
`fonts.googleapis.com` — lihat "Catatan implementasi" di bawah.

## Struktur

```
dineflow-frontend/
├── app/
│   ├── layout.tsx              # font loading, metadata, PWA/iOS meta tags
│   ├── manifest.ts              # Web App Manifest (Next.js convention)
│   ├── globals.css             # design tokens (Tailwind v4 @theme) + motif tiket
│   ├── page.tsx                 # landing/demo — input qr_token manual buat testing
│   ├── r/[restaurantId]/        # landing page PUBLIK restoran (Phase 9) — profil + full menu, read-only, no cart
│   ├── order/[qrToken]/         # menu browsing (server component, fetch table+menu)
│   ├── o/[code]/                 # tracking status order + bayar QRIS + countdown waktu masak + bukti bayar
│   ├── kitchen/
│   │   ├── login/                 # login staff
│   │   └── page.tsx               # Kitchen Display — WebSocket real-time
│   └── admin/
│       ├── login/                 # login admin
│       └── (dashboard)/           # route group: semua butuh auth, share layout+nav
│           ├── layout.tsx           # auth guard + ROLE guard (lib/permissions.ts), nav difilter per role
│           ├── page.tsx              # -> /admin: sales summary, best sellers, status/meja/stok sekilas, transaksi terbaru — live via WebSocket
│           ├── orders/               # daftar pesanan real-time + konfirmasi bayar cash + selesaikan pesanan + preview/cetak struk
│           ├── menu/                 # CRUD menu (+ waktu masak) + tombol "Resep" per item + thumbnail
│           ├── settings/             # (Phase 9, owner-only) edit deskripsi restoran buat landing page
│           ├── tables/               # CRUD meja + modal QR code
│           ├── inventory/            # CRUD ingredient + adjust stok (owner/manager saja)
│           └── staff/                # CRUD staf (owner/manager saja)
├── components/
│   ├── ui/                      # Button, status badges, Toast, ConfirmDialog
│   ├── auth/                    # LoginForm (dipakai kitchen & admin; redirect abis login role-aware buat admin)
│   ├── menu/                    # MenuBrowser, MenuItemRow (placeholder gambar + animasi), CartSheet
│   ├── order/                   # OrderTracker (timeline + QRIS + struk bukti bayar + countdown), Receipt, useReceiptPreview, CookingCountdown
│   ├── kitchen/                 # OrderTicket
│   └── admin/                   # MenuFormSheet, RecipeFormSheet, TableQrModal, StaffFormSheet, IngredientFormSheet, StockAdjustModal
├── lib/
│   ├── types.ts                  # tipe TS yang match persis sama entity Go
│   ├── api.ts                    # API client (fetch wrapper + kitchenSocketUrl)
│   ├── auth.ts                   # localStorage session (dipakai kitchen & admin)
│   ├── auth-context.tsx          # React context buat auth di dalam /admin
│   ├── cart-context.tsx          # state cart, persist ke localStorage per meja
│   ├── permissions.ts            # peta halaman admin -> role yang boleh akses, mirror middleware.RequireRole di backend
│   ├── placeholder.ts            # generate URL placehold.co buat menu yang belum punya foto
│   └── format.ts                 # formatRupiah, statusLabel
├── components/service-worker-register.tsx  # registrasi sw.js
├── public/
│   ├── sw.js                     # service worker (cuma cache asset statis)
│   ├── icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png
│   └── favicon.ico
├── scripts/                      # source SVG icon (buat generate ulang kalau perlu)
└── .env.local.example
```

## Menjalankan

1. **Jalankan backend-nya dulu** (lihat README di `dineflow-backend/`) —
   frontend ini nggak ngapa-ngapain tanpa API-nya jalan.

2. **Setup env**
   ```bash
   cp .env.local.example .env.local
   # isinya: NEXT_PUBLIC_API_URL=http://localhost:8080
   ```

3. **Install & jalankan**
   ```bash
   npm install
   npm run dev
   ```
   Buka `http://localhost:3000` — ada input buat masukin `qr_token` manual
   (dari `POST /api/v1/tables` di backend) buat langsung ke halaman menu,
   plus link ke login Kitchen Display.

4. **Coba alur customer**: buka `/order/<qr_token>`, tambah menu ke cart,
   pesan, kamu bakal diarahkan ke `/o/<order_code>` buat tracking + bayar.

5. **Coba Kitchen Display**: login di `/kitchen/login` pakai akun staf
   (owner/manager/cashier/kitchen — role apa aja bisa lihat Kitchen
   Display), order yang barusan kamu buat bakal langsung muncul real-time.

6. **Coba Admin Dashboard**: login di `/admin/login` (akun yang sama juga
   bisa — satu login berlaku buat `/kitchen` dan `/admin`). Dari sini bisa
   tambah/edit/hapus menu, tambah meja + lihat & download QR code-nya, dan
   lihat sales summary.

7. **Coba halaman Pesanan**: tab "Pesanan" di admin nunjukkin semua order
   real-time (WebSocket yang sama kayak Kitchen Display) dengan filter
   "Belum Lunas". Tombol "Tandai Lunas (Cash)" cuma muncul & aktif buat
   role owner/manager/cashier — kalau login sebagai kitchen, tombolnya
   nggak ada (backend-nya sendiri juga nolak 403 kalau dipaksa).

8. **Coba Staf & Inventory**: tab "Staf" buat tambah/hapus akun staf
   (nggak bisa hapus owner terakhir). Tab "Inventory" buat tambah
   ingredient + sesuaikan stok. Di tab "Menu", tombol "Resep" di tiap item
   buka form buat nentuin ingredient apa aja yang kepakai per porsi —
   order berikutnya buat menu itu otomatis motong stok sesuai resep.

## Catatan implementasi

- **Font self-hosted lewat `@fontsource`**, bukan `next/font/google` —
  sandbox tempat ini dibuat nggak bisa akses `fonts.googleapis.com` (mirip
  kasus `go.mod` di backend). Ini sebenarnya bukan cuma workaround: nggak
  ada dependency runtime ke CDN Google sama sekali, jadi kamu bisa pakai
  ini apa adanya di komputer kamu tanpa perlu ganti balik ke
  `next/font/google` kalau nggak mau.
- **Foto menu pakai `<img>` biasa, bukan `next/image`** — soalnya
  `image_url` itu bisa dari domain mana aja (tiap restoran nge-host
  fotonya sendiri-sendiri), dan `next/image` butuh domain-nya didaftarin
  di `next.config.ts` dulu. Trade-off-nya kehilangan optimasi gambar
  otomatis dari Next.js.
- **Cart pakai localStorage**, di-key per `qr_token` — jadi kalau kamu
  buka 2 meja beda tab, cart-nya nggak ke-mix.
- **Status order di halaman customer pakai polling** (tiap 4 detik), bukan
  WebSocket — WebSocket sengaja cuma dipasang di Kitchen Display, biar
  customer nggak perlu buka koneksi persisten buat sekadar ngecek status.
- **Estimasi tax/service di cart** (`CartSheet`) itu cuma preview di sisi
  klien pakai rate yang sama kayak backend (10%/5%) — angka final yang
  beneran dipakai selalu dari response server setelah order dibuat, jadi
  nggak ada risiko selisih hitungan dipercaya buat pembayaran beneran.
- **Halaman order/status yang nggak ketemu balikin HTTP 200**, bukan 404
  — pesan errornya udah jelas buat user, tapi status code-nya belum
  presisi. Kalau mau dibetulin: pakai `notFound()` dari `next/navigation`
  + file `not-found.tsx`.
- **`/kitchen` dan `/admin` share satu auth key** (`dineflow:staff` di
  `lib/auth.ts`) — login sekali kepakai di dua-duanya, sesuai kondisi
  nyata: biasanya itu device/sesi yang sama.
- **Role-aware sekarang di dua lapis.** Lapis halaman
  (`lib/permissions.ts`, dipakai di `admin/(dashboard)/layout.tsx`):
  Dashboard, Inventory, dan Staff disembunyikan dari nav + redirect
  otomatis buat role selain owner/manager — ini mirror persis
  `middleware.RequireRole(...)` di backend (`cmd/api/main.go`), sudah
  diverifikasi lewat testing API asli per role, bukan cuma dugaan. Lapis
  aksi (`canConfirmPayment` di `orders/page.tsx`): tombol "Tandai Lunas"
  & "Selesaikan Pesanan" disembunyikan buat role selain
  owner/manager/cashier. Menu dan Meja **tetap** kebuka buat semua role
  yang login, sesuai backend-nya sendiri (route itu nggak di-`RequireRole`
  sama sekali) — jadi ini bukan lubang keamanan, cuma frontend yang jujur
  soal apa yang backend-nya sendiri izinin.
- **Service worker sengaja nggak cache apa-apa yang dinamis** — cuma 4
  file icon statis (lihat `STATIC_ASSETS` di `public/sw.js`). Semua
  halaman dan panggilan `/api/*` selalu tembus ke network. Ini pilihan
  sadar, bukan kelupaan: kalau menu/status order sempat ke-cache basi,
  itu bug yang jauh lebih parah daripada nggak ada PWA sama sekali.
- **Icon PWA** bentuknya sengaja motif geometris (lingkaran konsentris ala
  piring), bukan monogram huruf — biar renderingnya nggak bergantung ke
  font tertentu yang mungkin nggak ke-load pas di-generate (lihat
  `scripts/icon-source.svg`, di-convert ke PNG pakai `sharp`). Ganti aja
  filenya di `public/` kalau mau icon yang lebih matang.
- **PWA install prompt butuh HTTPS** (kecuali localhost buat development)
  — belum sempat dites di HP beneran karena butuh deployment publik.
- **Hapus staf yang lagi login itu sendiri secara teknis dibolehin** di
  UI (nggak ada pengecualian khusus) — backend bakal tetep nolak kalau itu
  owner terakhir, tapi kalau bukan owner terakhir, staf bisa "menghapus
  dirinya sendiri" dari daftar staf tanpa otomatis logout. Sesi lokalnya
  tetap aktif sampai token JWT-nya kadaluarsa.
- **Hapus ingredient yang masih dipakai di resep** balikin pesan error dari
  backend apa adanya ("ingredient is used in one or more menu recipes...")
  — UI belum nunjukkin menu mana aja yang makein, cuma nolak hapusnya.
- **Placeholder foto menu pakai placehold.co**, bukan `source.unsplash.com`
  — itu API resmi udah almarhum (dimatiin pertengahan 2024), jadi kalau
  dipaksa dipakai hasilnya broken-image semua. placehold.co dipilih
  karena nggak butuh API key, nggak ada rate limit yang relevan buat
  ukuran aplikasi ini, dan warnanya di-generate dari kategori menu pakai
  palet warna yang sama kayak badge lain (lihat `lib/placeholder.ts`) —
  jadi tetap kerasa "dirancang", bukan abu-abu generik. `image_url` asli
  selalu menang begitu diisi lewat form Menu.
- **Cetak struk pakai `window.print()` + CSS `@media print`**
  (`.receipt-print` di `globals.css`), bukan library PDF — nyembunyiin
  semua elemen lain di halaman lalu nampilin cuma `<Receipt>`. Ini juga
  yang dipakai bukti pembayaran customer (`OrderTracker`) dan preview
  admin (`useReceiptPreview`), jadi satu mekanisme buat dua konteks.
  Belum bisa saya verifikasi hasil cetaknya beneran rapi di kertas/PDF
  beneran (butuh browser), tapi struktur HTML-nya sengaja sederhana
  (dashed border, monospace buat angka) supaya risikonya kecil.
- **Widget "Stok Menipis" di dashboard nyortir berdasarkan angka stok
  mentah**, bukan ambang batas — soalnya `Ingredient` belum punya kolom
  semacam `min_stock`. Jadi ini sekadar "5 ingredient dengan stok
  ter-rendah", bukan "ingredient yang beneran perlu di-restock" (3kg
  beras vs 3pcs telur nggak sebanding). Kalau mau lebih presisi: perlu
  migrasi baru + field di form Ingredient.

## Selanjutnya

- **UI buat bikin restoran tambahan** (`POST /restaurants`, multi-tenant
  dari Phase 6) — backend-nya udah ada, belum ada tombolnya di admin
- **Coba install PWA-nya beneran di HP** setelah deploy ke domain dengan
  HTTPS — pastikan prompt "Add to Home Screen" muncul dan ikonnya
  kelihatan benar
- **Capacitor** — lihat folder `dineflow-mobile/` (dokumentasi terpisah)
- Perbaiki status code 404 yang disebut di atas
- Halaman "Resep" nunjukkin daftar menu yang makein sebuah ingredient,
  biar hapus ingredient yang lagi kepakai lebih jelas kenapa ditolak
- **Kolom `min_stock` per ingredient** — biar widget "Stok Menipis" di
  dashboard bisa bandingin stok terhadap ambang batas yang beneran
  berarti, bukan cuma angka mentah (lihat catatan di atas)
- **Restaurant name di struk** — `Receipt` masih belum nampilin nama
  restoran. Endpoint-nya sekarang UDAH ADA sejak Phase 9
  (`GET /restaurants/me` buat admin, `GET /public/restaurants/:restaurant_id`
  buat yang publik) — cuma belum di-wire ke komponen `Receipt` itu sendiri.
  Tinggal oper `restaurant.name` sebagai prop dari pemanggilnya (orders
  page & dashboard udah py `staff`/token buat fetch itu; `OrderTracker`
  perlu tambahan satu fetch lagi ke endpoint publik di atas).
- **Link ke landing page (`/r/[restaurantId]`) dari luar aplikasi** — saat
  ini cuma bisa diakses kalau tau restaurant_id-nya (lewat tombol "Tentang
  Kami" di halaman order, atau link "Lihat halaman landing publik" di
  Settings). Belum ada slug yang gampang diinget/dibagi (misal
  `/r/kopi-kita` bukan `/r/803199aa-...`) — perlu kolom `slug` baru di
  `restaurants` kalau mau itu.
