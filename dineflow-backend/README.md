# DineFlow — Backend

Fondasi + core ordering loop untuk DineFlow: platform digital ordering &
management restoran (QR table ordering, POS, Kitchen Display System,
payment, realtime).

## Status

Keenam fase ini sudah **dites end-to-end** (build, migrasi ke PostgreSQL
beneran, jalanin server, hit tiap endpoint pakai curl, dan — khusus Phase 2,
3 & 5 — koneksi WebSocket beneran dites nerima broadcast realtime). Satu
pengecualian penting ada di Phase 5, dijelaskan di situ.

**Phase 1 — Fondasi & Skema DB**
- Struktur project ala Standard Go Project Layout, sama seperti pola LifeSync
- Migrasi database untuk 6 tabel inti: `restaurants`, `staff`, `tables`, `menus`, `orders`, `order_items`
- `database/sql` + `lib/pq` (tanpa ORM), JWT helper & middleware, CORS
- Modul **auth** (register restoran + login staff)
- Modul **menu** (CRUD)

**Phase 2 — Core Ordering Loop**
- Modul **table**: CRUD meja + generate QR token acak per meja
- Modul **order**: alur order customer lengkap — validasi meja & menu,
  hitung subtotal/tax/service/total di server, simpan order+items dalam
  satu transaksi DB
- **WebSocket Kitchen Display** (`pkg/ws` + `internal/realtime`): order baru
  & perubahan status langsung di-broadcast realtime
- Endpoint publik (tanpa login) buat customer: scan QR → lihat menu → order
  → cek status pesanan

**Phase 3 — Status Order & Payment (Simulasi)** ✅ *baru*
- Endpoint konfirmasi pembayaran manual (`PATCH /orders/:id/payment`) —
  staff tandain cash/QRIS diterima, belum nyambung ke gateway asli
- Aturan bisnis: order nggak bisa di-mark **completed** sebelum
  `payment_status` = `paid` (mirip POS beneran yang nggak bisa nutup
  tagihan yang belum lunas)
- Role restriction pertama yang beneran dipasang: cuma `owner`/`manager`/
  `cashier` yang boleh konfirmasi pembayaran, `kitchen` di-block (403) —
  udah dites, bukan cuma ditulis
- Endpoint staff management (`POST /staff`, `GET /staff`, `DELETE
  /staff/:id`, semuanya owner/manager only) buat
  nambah akun cashier/kitchen/dll — sebelumnya cuma bisa ada 1 akun
  (owner) dari hasil register

**Phase 4 — Admin Dashboard** ✅ *baru*
- `GET /dashboard/summary` — sales hari ini/minggu ini/bulan ini + rata-rata
  per order + tren 7 hari terakhir (zero-filled, jadi selalu 7 titik data
  walau ada hari kosong)
- `GET /dashboard/best-sellers` — menu paling laku, urut dari quantity
  terjual terbanyak
- Semua query agregat di atas `orders`/`order_items` yang udah ada — nggak
  ada tabel baru
- Dibatasin `owner`/`manager` doang (role lain kena 403) — udah dites

**Phase 5 — Payment Gateway Asli** ✅ *baru*
- `pkg/paymentgateway`: interface `Gateway` (`CreateQRISCharge`,
  `ParseWebhook`, `IsPaid`) — biar gampang ganti provider tanpa nyentuh
  `internal/payment` atau `internal/order`
- `pkg/paymentgateway/midtrans`: implementasi asli buat Midtrans Core API
  (charge QRIS + verifikasi signature webhook SHA512)
- `pkg/paymentgateway/mock`: implementasi buat dev lokal, nggak butuh
  credential asli
- `internal/payment`: `POST /public/orders/:code/charge` (customer minta
  kode QRIS) dan `POST /payments/webhook` (gateway lapor status bayar) —
  keduanya manggil `order.Service.UpdatePayment` yang sama dari Phase 3,
  jadi aturan "harus paid dulu sebelum completed" otomatis berlaku di sini
  juga tanpa kode tambahan
- **Yang udah dites penuh**: seluruh alur pakai mock gateway (charge → jadi
  `pending` → simulasi webhook → jadi `paid` → broadcast WebSocket), plus
  order yang udah paid ditolak kalau di-charge lagi, plus webhook dengan
  `order_id` nggak dikenal di-handle dengan sopan (200, bukan error)
- **Yang belum bisa saya tes**: panggilan HTTP asli ke
  `api.sandbox.midtrans.com`. Sandbox tempat saya kerja nggak bisa akses
  domain itu. Kode `pkg/paymentgateway/midtrans` saya tulis & review
  sesuai dokumentasi resmi Midtrans, tapi **kamu perlu coba sendiri** pakai
  Server Key sandbox asli sebelum dipakai serius — lihat bagian "Nyoba
  Midtrans asli" di bawah

**Phase 6 — Inventory & Multi-tenant** ✅ *baru*

Inventory:
- Modul **inventory**: CRUD ingredients + stock quantity, plus resep
  (`PUT /menus/:id/recipe`) yang ngaitin ingredient ke menu dengan takaran
  per unit
- Order otomatis motong stok ingredient sesuai resep, **dalam transaksi
  yang sama** dengan pembuatan order — kalau stok nggak cukup, seluruh
  order di-rollback (nggak ada order "setengah jadi" atau stok yang
  kepotong sebagian). Udah dites: order gede yang stoknya kurang ditolak
  409 dan stok kebukti nggak berubah sama sekali
- Resep itu **opsional per menu** — menu tanpa resep tetap bisa di-order
  normal, nggak ada yang wajib pasang inventory
- Endpoint `PATCH /ingredients/:id/stock` buat restock manual/koreksi,
  dijagain juga nggak bisa sampai minus

Multi-tenant:
- `POST /restaurants` (owner only) — owner yang udah ada bisa bikin
  restoran kedua di bawah identitas yang sama, langsung dapet token baru
  buat restoran itu tanpa perlu login ulang
- `GET /public/restaurants` — listing publik semua restoran, buat flow
  customer "pilih restoran dulu" (alternatif dari langsung scan QR meja)
- **Isolasi data udah gitu dari Phase 1** (tiap query staff selalu scoped
  `restaurant_id` dari JWT, bukan dari input client) — di fase ini saya
  tulis test eksplisit yang MEMBUKTIKANNYA: token restoran ke-2 coba akses
  menu restoran ke-1 → 404, bukan malah kebaca datanya
- **Keterbatasan yang jujur perlu disebut**: supaya 1 owner bisa punya
  banyak restoran, keunikan email di tabel `staff` saya longgarkan dari
  "unik global" jadi "unik per-restoran". Konsekuensinya: `POST
  /auth/login` sekarang belum bisa milih dengan pasti restoran mana kalau
  1 email kepakai di lebih dari 1 restoran — baru keambil salah satu
  secara nggak terjamin urutannya. Buat sekarang, cara resmi masuk ke
  restoran baru adalah lewat token yang langsung dikasih balik dari `POST
  /restaurants`, bukan login ulang. Disambiguasi login yang proper itu
  next step yang jujur belum digarap di sini.

**Phase 7 — Perbaikan Hasil Testing & Developer Tooling** ✅ *baru*

Tiga hal ini ketemu pas testing manual end-to-end lewat frontend (bukan
cuma curl), jadi taruh di sini:

- **Bug: meja nggak balik "available" setelah order completed.** Dari
  Phase 2 sampai sekarang, `table.Service` cuma punya `MarkOccupied` — nggak
  ada lawan `MarkAvailable`-nya. Efeknya, order yang di-mark `completed`
  (baik dibayar cash maupun QRIS, dua-duanya lewat kode yang sama) nggak
  pernah ngelepas mejanya, jadi meja itu keliatan "Terisi" selamanya biar
  udah kelar. Sekarang `order.Service.UpdateStatus` ngecek dulu apa masih
  ada order lain yang aktif (bukan `completed`/`cancelled`) di meja yang
  sama — kalau nggak ada, baru mejanya di-`MarkAvailable` + broadcast
  `table_status_updated`. Dicek dulu gitu (bukan langsung lepas) karena satu
  meja bisa punya beberapa ronde order (misal appetizer dipesan terpisah
  dari main course) — order pertama selesai bukan berarti mejanya udah
  kosong.
- **Endpoint dev buat "menyelesaikan" pembayaran QRIS tanpa gateway
  asli.** Sebelumnya, satu-satunya cara nge-mark charge QRIS mock jadi
  `paid` adalah nembak `POST /payments/webhook` manual dengan payload JSON
  yang kamu ketik sendiri (lihat langkah 13 di bagian "Alur lengkap" di
  bawah — itu masih valid, tetap jalan). Sekarang ada jalan pintas:
  `POST /public/orders/:code/simulate-payment` — nggak perlu body sama
  sekali, langsung jalanin order yang bersangkutan lewat
  `ParseWebhook -> IsPaid -> UpdatePayment` yang sama persis kayak webhook
  asli (bukan shortcut yang skip logic itu). **Cuma nyala kalau
  `PAYMENT_GATEWAY=mock`** (default lokal) — dicek lewat type assertion ke
  `SimulatePayload` yang cuma diimplementasi `pkg/paymentgateway/mock`, jadi
  begitu kamu pindah ke `PAYMENT_GATEWAY=midtrans` endpoint ini otomatis
  balikin 404, nggak ada jalan buat fake payment asli.
- **`cmd/seed`** — CLI kecil buat ngisi menu awal (20 item, dibagi
  Makanan Utama/Camilan/Minuman/Dessert) ke sebuah restoran, biar Kitchen
  Display/dashboard/ordering flow nggak keliatan kosong pas testing. Aman
  dijalanin berkali-kali — item yang namanya udah ada di-skip, nggak
  dobel. Lihat bagian "Menjalankan" di bawah buat cara pakainya.

## Struktur Project

**Phase 9 — Landing Page, Estimasi Waktu Masak, & Deskripsi Restoran** ✅ *baru*

Tiga fitur baru di sini, dan tiga bug asli yang ketemu pas testing
end-to-end-nya (bukan cuma `go build`/`go vet` — dua-duanya bersih padahal
ketiga bug ini ada, jadi dicatat detail biar jelas kenapa saya keukeuh
nyalain server beneran tiap kali ada perubahan di layer SQL/routing):

- **`restaurants.description`** (migrasi 000012) — teks bebas buat halaman
  landing publik restoran. `GET/PATCH /restaurants/me` (owner-only, restoran
  sendiri dari JWT) buat admin edit, `GET /public/restaurants/:restaurant_id`
  (tanpa auth) buat landing page baca. `cmd/seed` otomatis ngisi deskripsi
  contoh kalau masih kosong (nggak nimpa yang udah diisi manual).
- **`menus.prep_time_minutes`** (migrasi 000013, default 15, `CHECK > 0`) —
  estimasi waktu masak per item, dipakai countdown di sisi customer.
  `cmd/seed` ngasih nilai realistis per item (minuman 1-5 menit, gorengan
  8-10 menit, sate 20 menit, dst) — bukan cuma pasrah ke default.
- **`orders.preparing_started_at`** (migrasi 000014, nullable) — di-set
  SEKALI, pertama kali status jadi `preparing` (lihat
  `order.Repository.UpdateStatus`), dan nggak pernah ditimpa lagi walau
  status berubah lagi setelahnya — biar jadi titik acuan yang stabil buat
  countdown di frontend, bukan ngikut `updated_at` yang berubah tiap
  update apapun (termasuk yang nggak ada hubungannya sama masak-memasak).

**Tiga bug yang ketemu pas testing (urut sesuai ditemukannya):**

1. **Gin panic pas start**: `GET /public/restaurants/:restaurant_id` (baru)
   ditaruh di grup yang sama dengan `menu.Handler`'s
   `GET /public/restaurants/:restaurant_id/menus` (lama) — awalnya saya
   pakai nama parameter `:id`, beda sama punya menu (`:restaurant_id`).
   Gin nggak izinin dua nama wildcard beda di posisi tree yang sama, jadi
   langsung panic pas `main()` jalan, bukan pas request masuk. Perbaikannya
   gampang begitu ketauan: samain namanya jadi `:restaurant_id` di kedua
   handler.
2. **`prep_time_minutes` hilang di response order yang BARU dibuat** (tapi
   muncul normal kalau di-GET ulang) — `order.Service.CreateOrder` bikin
   `entity.OrderItem` manual di Go dari data menu yang udah di-fetch
   (`FindByIDs`), dan saya lupa nyalin field `PrepTimeMinutes`-nya padahal
   datanya udah ada di tangan. Jalur baca (`itemsByOrderID`, JOIN ke
   `menus`) udah bener dari awal — cuma jalur create-nya yang kelewatan.
3. **`ERROR: inconsistent types deduced for parameter $1`** — ini yang
   paling nggak kelihatan kalau cuma dites lewat `psql -c` biasa. Query
   `UpdateStatus` awalnya pakai `$1` dua kali: sekali di `status = $1`
   (kolom `character varying`), sekali lagi di
   `CASE WHEN $1 = 'preparing' ...` (dibandingin ke literal teks, yang
   default-nya `text`). Postgres nolak nyimpulin SATU tipe konsisten buat
   `$1` yang dipakai di dua konteks beda gitu — tapi CUMA lewat extended
   query protocol (yang dipakai `database/sql`/`lib/pq`); `psql -c` dengan
   value literal nggak pernah lewat jalur itu, jadi kelihatan baik-baik aja
   pas saya tes manual duluan. Sempet coba `$1::text` buat cast salah satu
   sisi, tetep gagal (Postgres tetep anggep `text` vs `character varying`
   sebagai dua tipe beda, walau saling bisa di-convert). Perbaikan yang
   akhirnya jalan: itung `status == "preparing"` di Go dulu (jadi
   `bool`), kirim sebagai `$4` yang terpisah — nggak ada lagi parameter
   yang dipakai dobel di konteks tipe yang beda.

Ketiga hal ini nggak bakal ketauan cuma dari baca kode atau dari
`go build`/`go vet` — makanya bagian "Menjalankan" di bawah worth
diikutin persis kalau kamu nambah query SQL baru yang pakai parameter yang
sama di lebih dari satu tempat.

## Struktur Project

```
dineflow-backend/
├── cmd/api/main.go            # entry point, wiring semua module
├── cmd/seed/main.go           # CLI: isi menu awal ke sebuah restoran (lihat Phase 7)
├── internal/
│   ├── config/                  # load environment variables
│   ├── entity/                    # struct model (Restaurant, Staff, Table, Menu, Order, OrderItem)
│   ├── auth/                      # register, login staff, + add staff (POST /staff), + restaurant profile (Phase 9: GET/PATCH /restaurants/me, GET /public/restaurants/:restaurant_id)
│   ├── menu/                      # CRUD menu (+ endpoint publik list menu tersedia) + prep_time_minutes (Phase 9)
│   ├── table/                     # CRUD meja + QR token (+ endpoint publik scan QR)
│   ├── order/                     # order customer (publik) + status & pembayaran (staff)
│   ├── payment/                   # charge QRIS (publik) + terima webhook gateway
│   ├── dashboard/                 # sales summary + best sellers (read-only, owner/manager)
│   ├── inventory/                 # ingredients CRUD, resep menu, deduksi stok otomatis
│   └── realtime/                  # handler WebSocket /ws/kitchen (auth via query param)
├── pkg/
│   ├── database/                   # koneksi PostgreSQL
│   ├── jwt/                        # generate & verify JWT
│   ├── middleware/                 # RequireAuth, RequireRole, CORS
│   ├── response/                   # helper JSON response yang konsisten
│   ├── paymentgateway/             # interface Gateway + implementasi midtrans & mock
│   └── ws/                         # hub WebSocket per-restoran (broadcast ke Kitchen Display)
├── migrations/                     # SQL migration (format golang-migrate)
├── go.mod
├── Dockerfile
├── docker-compose.yml
├── Makefile
└── .env.example
```

Setiap modul baru (mis. `payment`, `inventory`) tinggal ngikutin pola yang
sama persis kayak `internal/menu/` atau `internal/table/`: `dto.go` →
`repository.go` → `service.go` → `handler.go`, terus di-wire di
`cmd/api/main.go`.

## Kalau kamu dari Laravel...

| Laravel | Go (project ini) |
|---|---|
| `routes/api.php` | `RegisterRoutes()` / `RegisterPublicRoutes()` di tiap handler, di-mount dari `cmd/api/main.go` |
| Controller | `handler.go` |
| Service class | `service.go` |
| Eloquent Model / query builder | `repository.go` (raw SQL manual, bukan ORM) |
| `App\Models\*` | `internal/entity/*.go` |
| Middleware (`auth:sanctum`) | `pkg/middleware.RequireAuth()` |
| Form Request validation | tag `binding:"required,..."` di struct DTO |
| DB transaction (`DB::transaction()`) | `db.BeginTx()` / `tx.Commit()` / `defer tx.Rollback()` — lihat `internal/order/repository.go` |
| Laravel Echo / Pusher broadcast | `pkg/ws.Hub.Broadcast()` — versi minimal tanpa Redis, cukup buat 1 instance server |
| `php artisan migrate` | `migrate` CLI (lihat bagian Migrasi di bawah) |

Beda paling terasa: nggak ada ORM/magic — semua query SQL ditulis manual di
`repository.go`. Lebih verbose dibanding Eloquent, tapi kamu selalu tahu
persis query apa yang jalan ke database — dan itu juga alasan
`restaurant_id` selalu ada manual di WHERE clause tiap query staff: itu
batas tenant-nya, belum ada "global scope" otomatis kayak di Laravel.

## Menjalankan

1. **Copy env** — `cp .env.example .env`
2. **Jalankan PostgreSQL** — `docker compose up -d postgres`
3. **Install dependency** — di komputer kamu (internet normal): `go mod tidy`
4. **Jalankan migrasi** — `make migrate-up`
5. **(Opsional) isi menu awal** — `make seed` (seed ke restoran pertama yang
   ketemu; kalau mau restoran tertentu: `make seed RESTAURANT_ID=<uuid>`).
   Perlu minimal 1 restoran udah ke-register duluan (lihat langkah 1 di
   "Alur lengkap" di bawah) — kalau belum ada, seeder-nya kasih tau gitu aja
   terus berhenti, bukan bikin restoran fiktif sendiri.
6. **Jalankan server** — `make run` (jalan di `http://localhost:8080`)

## Alur lengkap yang sudah dites

```bash
# 1) Staff login
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"eko@kopikita.test","password":"secret123"}'
# -> simpan token-nya

# 2) Staff bikin meja (server generate qr_token otomatis)
curl -X POST http://localhost:8080/api/v1/tables \
  -H "Content-Type: application/json" -H "Authorization: Bearer <token>" \
  -d '{"code":"05"}'
# -> qr_token dari response ini yang di-encode jadi QR code fisik di meja

# 3) Customer "scan QR" (endpoint publik, tanpa login)
curl http://localhost:8080/api/v1/public/tables/<qr_token>
curl http://localhost:8080/api/v1/public/restaurants/<restaurant_id>/menus

# 4) Customer order (endpoint publik)
curl -X POST http://localhost:8080/api/v1/public/orders \
  -H "Content-Type: application/json" \
  -d '{"qr_token":"<qr_token>","items":[{"menu_id":"<menu_id>","quantity":2}]}'
# -> broadcast otomatis ke semua Kitchen Display yang connect ke restoran ini

# 5) Customer cek status pesanan (endpoint publik)
curl http://localhost:8080/api/v1/public/orders/<order_code>

# 6) Kitchen Display connect (WebSocket, browser nggak bisa kirim header
#    custom saat handshake makanya token lewat query param)
#    wss://localhost:8080/ws/kitchen?token=<token>

# 7) Staff/kitchen update status pesanan -> broadcast lagi ke semua Kitchen Display
curl -X PATCH http://localhost:8080/api/v1/orders/<order_id>/status \
  -H "Content-Type: application/json" -H "Authorization: Bearer <token>" \
  -d '{"status":"preparing"}'

# 8) Owner/manager tambah staff baru dengan role tertentu
curl -X POST http://localhost:8080/api/v1/staff \
  -H "Content-Type: application/json" -H "Authorization: Bearer <owner_token>" \
  -d '{"name":"Budi","email":"budi@kopikita.test","password":"secret123","role":"cashier"}'

# 9) Cashier/owner/manager konfirmasi pembayaran (kitchen role akan kena 403 di sini)
curl -X PATCH http://localhost:8080/api/v1/orders/<order_id>/payment \
  -H "Content-Type: application/json" -H "Authorization: Bearer <token>" \
  -d '{"payment_status":"paid","payment_method":"cash"}'

# 10) Baru sekarang order boleh di-mark completed (akan ditolak 409 kalau belum paid)
curl -X PATCH http://localhost:8080/api/v1/orders/<order_id>/status \
  -H "Content-Type: application/json" -H "Authorization: Bearer <token>" \
  -d '{"status":"completed"}'

# 11) Owner/manager lihat dashboard (kitchen/cashier/staff kena 403 di sini)
curl http://localhost:8080/api/v1/dashboard/summary -H "Authorization: Bearer <owner_token>"
curl http://localhost:8080/api/v1/dashboard/best-sellers?limit=5 -H "Authorization: Bearer <owner_token>"

# 12) Customer minta kode QRIS buat order-nya (default: mock gateway)
curl -X POST http://localhost:8080/api/v1/public/orders/<order_code>/charge

# 13) Simulasikan gateway lapor pembayaran berhasil (ini yang beneran
#     dipanggil Midtrans lewat webhook di dunia nyata)
curl -X POST http://localhost:8080/api/v1/payments/webhook \
  -H "Content-Type: application/json" \
  -d '{"order_id":"<order_code>","transaction_status":"settlement","gross_amount":<total>,"payment_type":"qris"}'
# -> order_payment_updated ke-broadcast ke Kitchen Display, payment_status jadi "paid"

# 13b) Cara yang lebih gampang buat testing lokal (Phase 7): nggak perlu
#      ngetik payload sendiri, cukup ini — cuma jalan kalau PAYMENT_GATEWAY=mock
curl -X POST http://localhost:8080/api/v1/public/orders/<order_code>/simulate-payment
# -> hasilnya sama kayak langkah 13, tapi lewat satu request tanpa body

# 14) Owner/manager bikin ingredient, terus pasang resep ke sebuah menu
curl -X POST http://localhost:8080/api/v1/ingredients \
  -H "Content-Type: application/json" -H "Authorization: Bearer <owner_token>" \
  -d '{"name":"Beras","unit":"kg","stock_quantity":10}'

curl -X PUT http://localhost:8080/api/v1/menus/<menu_id>/recipe \
  -H "Content-Type: application/json" -H "Authorization: Bearer <owner_token>" \
  -d '{"items":[{"ingredient_id":"<beras_id>","quantity_per_unit":0.15}]}'
# -> order berikutnya buat menu ini otomatis motong stok Beras; kalau
#    kurang, order-nya ditolak 409 dan stok nggak kesentuh sama sekali

# 15) Owner bikin restoran kedua di bawah identitas yang sama
curl -X POST http://localhost:8080/api/v1/restaurants \
  -H "Content-Type: application/json" -H "Authorization: Bearer <owner_token>" \
  -d '{"name":"Kopi Kita - Cabang Kedua"}'
# -> response-nya udah termasuk token baru buat restoran ini, langsung
#    dipakai tanpa perlu login ulang

# 16) Listing publik semua restoran
curl http://localhost:8080/api/v1/public/restaurants
```

Format pesan yang di-broadcast ke `/ws/kitchen`:
```json
{"event": "new_order", "data": { ...order lengkap dengan items... }}
{"event": "order_status_updated", "data": { ...order lengkap... }}
{"event": "order_payment_updated", "data": { ...order lengkap... }}
```

## Nyoba Midtrans asli

1. Daftar akun sandbox gratis di [dashboard.midtrans.com](https://dashboard.midtrans.com/register) — nggak butuh dokumen bisnis buat mode sandbox.
2. Ambil **Server Key** sandbox dari Settings → Access Keys.
3. Set di `.env`:
   ```
   PAYMENT_GATEWAY=midtrans
   MIDTRANS_SERVER_KEY=SB-Mid-server-xxxxxxxxxxxxx
   ```
4. Restart server, coba `POST /public/orders/<code>/charge` beneran —
   response-nya harusnya isi `qr_image_url` yang bisa langsung di-scan pakai
   simulator GoPay/QRIS bawaan sandbox Midtrans.
5. Buat webhook-nya beneran nyampe, di Settings → Configuration, isi
   **Payment Notification URL** dengan `https://<domain-kamu>/api/v1/payments/webhook`
   (butuh domain publik — pakai [ngrok](https://ngrok.com) kalau masih coba
   di localhost).
6. Kalau ada yang nggak sesuai dokumentasi Midtrans yang terbaru, paling
   gampang dibetulin di `pkg/paymentgateway/midtrans/midtrans.go` — cuma 1
   file, nggak nyentuh apa pun di `internal/`.

## Catatan implementasi

- **Harga selalu dari server.** Request order cuma kirim `menu_id` +
  `quantity` — harga, subtotal, tax (10%), service fee (5%), dan total
  semua dihitung ulang dari data menu di database, nggak pernah percaya
  angka dari client.
- **order_code** (contoh `DFE22BB5`) itu kunci akses ringan buat customer
  cek status tanpa perlu akun — mirip nomor konfirmasi di guest checkout.
  Bukan sequential biar nggak gampang ditebak.
- **WebSocket hub** (`pkg/ws`) itu in-memory, per-instance server — belum
  pakai Redis pub/sub. Cukup buat 1 instance; kalau nanti scale ke banyak
  instance server, itu saat yang tepat buat nambah Redis (sesuai roadmap
  awal, sengaja di-skip dulu di fase ini).
- **Tax & service rate** masih konstanta di `internal/order/service.go`
  (`taxRate`, `serviceRate`) — jadiin setting per-restoran kalau udah masuk
  fase multi-tenant.
- **Payment masih simulasi manual** — `PATCH /orders/:id/payment` itu staff
  yang konfirmasi dengan tangan, belum ada verifikasi apa pun ke gateway
  pembayaran. `payment_method` cuma string bebas (`"cash"`, `"qris"`, dst.),
  belum di-enum-kan karena bentuk data aslinya nanti ngikutin apa yang
  dikembalikan gateway asli di Phase 5.
- **Role check** ada di 3 tempat sekarang: `POST /staff`, `PATCH
  /orders/:id/payment`, dan seluruh `/dashboard/*` (owner/manager doang).
  Route lain (menu, table, order status) sengaja masih terbuka buat semua
  role yang login — `pkg/middleware.RequireRole` tinggal ditambahin ke
  route mana pun yang perlu, pola-nya sama kayak yang udah ada.
- **"Sales" di dashboard** = semua order yang nggak `cancelled`, bukan cuma
  yang udah `paid` — soalnya customer dine-in sering baru bayar di akhir,
  jadi ini angka operasional "hari ini rame nggak", bukan angka akuntansi
  ketat. Kalau butuh angka "uang yang beneran diterima", tinggal tambah
  filter `payment_status = 'paid'` di `internal/dashboard/repository.go`.
- **`DELETE /staff/:id` nolak (409) kalau itu owner terakhir di restoran
  itu** — dijaga di level query SQL (`internal/auth/repository.go`), bukan
  dicek dulu baru dihapus, jadi aman dari race condition dua request hapus
  barengan.
- **`DELETE /ingredients/:id` nolak (409, pesan jelas) kalau ingredient
  itu masih dipakai di resep menu manapun** — awalnya ini balikin 500
  generik (ke-catch pas nulis frontend-nya), sekarang di-tangkep khusus
  dari kode error Postgres `23503` (foreign_key_violation) di
  `internal/inventory/repository.go`. Constraint-nya sendiri (`ON DELETE
  RESTRICT` di migrasi `000010`) tetap dipertahankan sengaja — hapus
  ingredient nggak boleh diam-diam ngubah resep menu manapun.
- **Ganti provider payment** (misalnya nambah Xendit) = bikin implementasi
  baru dari interface `paymentgateway.Gateway`, terus ganti pemilihan
  gateway di `cmd/api/main.go`. Nggak ada yang perlu diubah di
  `internal/payment` atau `internal/order`.
- **Deduksi inventory pakai conditional UPDATE** (`stock_quantity =
  stock_quantity - $1 WHERE stock_quantity >= $1`) di dalam transaksi yang
  sama dengan `order.Repository.Create` — bukan cek-dulu-baru-kurangi yang
  rawan race condition antar 2 order barengan. Kalau salah satu ingredient
  nggak cukup, `RowsAffected() == 0` langsung men-trigger rollback seluruh
  transaksi (order + semua deduksi lain yang mungkin udah jalan duluan).
- **Email staff sekarang unik per-restoran**, bukan global (lihat migrasi
  `000011`) — ini yang bikin `POST /restaurants` bisa makein ulang email
  yang sama buat restoran baru. Efek sampingnya soal login sudah dijelaskan
  di bagian Status Phase 6 di atas.

## Catatan soal go.mod / go.sum

Project ini di-develop & di-compile-test di sandbox dengan akses internet
terbatas (cuma boleh akses github.com, bukan proxy Go resmi). Yang kamu
terima ini sudah **dibersihkan** dari workaround jaringan itu — `go.mod`
cuma isi dependency langsung yang beneran dipakai, dan `go.sum` sengaja
nggak disertakan supaya `go mod tidy` generate yang fresh & valid dari
proxy Go resmi di komputer kamu.

## Selanjutnya

Backend-nya sekarang udah nyentuh hampir semua yang ada di rencana awal:
auth, menu, table+QR, order+realtime, role, dashboard, payment gateway,
inventory, multi-tenant. Dua arah yang masuk akal dari sini:

- **Login disambiguation** — beresin keterbatasan yang disebut di Status
  Phase 6: cara yang proper buat login ke restoran tertentu kalau 1 email
  punya lebih dari 1 restoran (butuh restoran ke berapa dipilih eksplisit
  saat login, bukan otomatis keambil satu)
- **Frontend Next.js** — backend-nya udah punya semua endpoint yang
  dibutuhin (termasuk publik buat customer, WebSocket buat Kitchen
  Display), tapi belum ada satu pun baris frontend. Ini yang bikin project-
  nya kelihatan "hidup" buat orang lain, bukan cuma kelihatan bagus di
  Postman/curl — dan sekarang backend-nya udah cukup lengkap buat nggak
  perlu banyak berubah lagi pas frontend-nya digarap.

