# DineFlow — Mobile (Capacitor)

Wrapper native buat `dineflow-frontend`, biar bisa jadi APK (Android) dan
IPA (iOS) beneran — bukan cuma PWA "Add to Home Screen".

## Kenapa app-nya cuma "wrapper", bukan bundle statis?

`dineflow-frontend` pakai Next.js **Server Components** — halaman menu,
tracking order, dan seterusnya itu ambil data (harga, status order) di
server tiap kali di-request, bukan di-generate sekali waktu build. Ini
nggak bisa di-"static export" jadi kumpulan file HTML/JS yang di-bundle ke
dalam app, karena nggak ada server buat jalanin logic itu kalau app-nya
offline dari internet.

Solusinya (dan ini cara resmi yang didukung Capacitor buat kasus kayak
gini): `capacitor.config.ts` diarahkan ke **URL deployment yang jalan**
lewat `server.url`. Jadi app native ini pada dasarnya WebView yang nunjuk
ke website `dineflow-frontend` kamu yang sudah di-deploy — sama seperti
kalau kamu buka websitenya di browser HP, cuma dibungkus jadi app dengan
icon & splash screen sendiri, tanpa address bar.

## Status

- **Struktur project Android (Gradle) dan iOS (Xcode) berhasil di-generate**
  lewat `npx cap add android` dan `npx cap add ios` — dua-duanya valid,
  saya cek langsung isinya (AndroidManifest.xml, Info.plist, dll udah
  bener, app name "DineFlow" ke-set dengan benar di kedua platform).
- **Icon & splash screen** di-generate otomatis buat semua ukuran/density
  yang dibutuhin kedua platform (87 file Android, 10 file iOS) dari satu
  source SVG yang sama kayak icon PWA di frontend — pakai
  `@capacitor/assets`. Saya sempat lihat langsung hasil source image-nya
  (`resources/splash.png`), kelihatan bagus.
- **JUJUR belum bisa saya build APK/IPA beneran** dari sandbox ini —
  sempat saya coba `./gradlew --version` dan Gradle-nya butuh download
  dari `services.gradle.org`, yang di-block sama pembatasan jaringan
  sandbox ini (403), persis kasus yang sama kayak `go.mod` di backend dan
  Google Fonts di frontend. Struktur project-nya valid, tapi
  compile-nya beneran perlu Android Studio (buat APK) atau Xcode di Mac
  (buat IPA) di komputer kamu sendiri.

## Setup

1. **Deploy `dineflow-frontend` dulu** ke domain publik dengan HTTPS
   (Vercel, atau hosting lain yang support Next.js server-side rendering
   — bukan static hosting biasa, karena butuh Server Components).

2. **Set URL-nya** di `capacitor.config.ts`:
   ```ts
   server: {
     url: "https://your-deployed-frontend.com",
     cleartext: false,
   }
   ```
   (atau set env var `DINEFLOW_WEB_URL` sebelum build)

3. **Install dependency & sync**
   ```bash
   npm install
   npx cap sync
   ```

## Build Android (APK)

1. Buka folder `android/` di **Android Studio**
2. Biarin Gradle sync (ini yang butuh internet normal buat download
   Gradle + dependency Android — nggak akan kena masalah kayak di sandbox
   saya karena komputer kamu nggak dibatasin jaringannya)
3. Build → Build Bundle(s) / APK(s) → Build APK(s)
4. APK-nya muncul di `android/app/build/outputs/apk/`

## Build iOS (IPA)

**Butuh Mac dengan Xcode** — nggak bisa dari Linux/Windows.

1. Buka `ios/App/App.xcworkspace` (bukan `.xcodeproj`) di Xcode
2. Pilih target `App`, set Team di tab Signing & Capabilities (butuh
   Apple Developer account buat sign)
3. Product → Archive buat bikin build yang bisa di-distribusikan
4. (Opsional) rename target dari "App" ke "DineFlow" di Project Navigator
   — nama yang tampil di bawah icon (`CFBundleDisplayName`) udah otomatis
   "DineFlow", ini cuma soal nama internal project

## Testing lokal (sebelum deploy)

Buat coba app-nya nunjuk ke `dineflow-frontend` yang jalan di komputer
kamu sendiri (`localhost:3000`) sebelum deploy beneran:

- **Android emulator**: pakai `http://10.0.2.2:3000` (alias emulator ke
  localhost host machine), dan set `cleartext: true` sementara di
  `capacitor.config.ts` (HTTP biasa cuma boleh buat testing, jangan
  kepakai pas production)
- **HP fisik**: perlu expose localhost lewat HTTPS beneran, misalnya pakai
  [ngrok](https://ngrok.com) (`ngrok http 3000`), terus pakai URL ngrok-nya

## Struktur

```
dineflow-mobile/
├── capacitor.config.ts   # konfigurasi utama — URL deployment ada di sini
├── android/               # project Gradle lengkap, buka di Android Studio
├── ios/                   # project Xcode lengkap, buka App.xcworkspace
├── resources/             # source icon.png (1024x1024) & splash.png (2732x2732)
└── www/                   # placeholder kosong, cuma dibutuhin Capacitor CLI,
                            # nggak pernah beneran ke-load (server.url yang dipakai)
```

## Selanjutnya

- Deploy `dineflow-frontend` ke hosting yang support Next.js SSR, update
  `server.url`
- Build & sign APK di Android Studio, IPA di Xcode
- Kalau butuh fitur native beneran (push notification, dll.) yang nggak
  bisa dari web biasa, itu perlu Capacitor plugin tambahan — sejauh ini
  wrapper-nya polos, cuma WebView + icon + splash
