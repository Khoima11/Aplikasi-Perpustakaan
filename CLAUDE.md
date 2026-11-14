# CLAUDE.md — SIMPUS (Sistem Informasi Perpustakaan Sekolah)

Panduan kerja untuk siapa pun (manusia atau AI) yang melanjutkan project ini.
**Acuan utama: `docs/SIMPUS_Dokumen_Kebutuhan.docx`.** Jangan menambah fitur di luar dokumen.
Semua teks antarmuka, pesan error, dan komunikasi dengan pemilik project memakai **Bahasa Indonesia**.
Pemilik project bukan programmer berpengalaman: jelaskan langkah manual dengan bahasa sederhana.

## 1. Ringkasan

Web aplikasi responsif (PWA) untuk perpustakaan **satu sekolah**, tahap uji coba.

**Prinsip utama:** semua transaksi sirkulasi dicatat **petugas** di meja layanan.
**Anggota hanya membaca informasi.**

| Peran | Siapa | Hak akses |
|---|---|---|
| `petugas` (admin) | Pustakawan | Kelola kategori, buku, eksemplar, anggota + akun, aturan peminjaman; catat peminjaman, pengembalian, perpanjangan; lihat keterlambatan; buat laporan. Tampilan desktop dengan sidebar. |
| `anggota` | Siswa & guru (dibedakan `jenis_anggota`) | HANYA melihat katalog & ketersediaan, detail buku, pinjaman aktif & jatuh tempo miliknya, riwayat pinjaman, ubah kata sandi. Tidak bisa membuat transaksi apa pun. Tampilan HP dengan navigasi bawah. |
| Kepala sekolah | — | **Bukan pengguna.** Hanya menerima laporan cetak/PDF dari petugas. |

Tidak ada pendaftaran mandiri. Akun anggota dibuat petugas.

## 2. Aturan bisnis (wajib ditegakkan di DATABASE, bukan hanya di tampilan)

| Kode | Aturan |
|---|---|
| AB-01 | Hanya petugas yang bisa mencatat peminjaman, pengembalian, dan perpanjangan. |
| AB-02 | Anggota boleh meminjam jika akun aktif, tidak punya pinjaman lewat jatuh tempo, dan (pinjaman aktif + buku baru) ≤ `maks_pinjam`. |
| AB-03 | Eksemplar boleh dipinjam jika `status = 'tersedia'` dan `buku.dapat_dipinjam = true` (buku referensi = baca di tempat). |
| AB-04 | Jatuh tempo = tanggal pinjam + `lama_pinjam_hari` sesuai jenis anggota, **disimpan** saat transaksi. |
| AB-05 | Perpanjangan hanya jika belum terlambat dan `jumlah_perpanjangan < maks_perpanjangan`. Jatuh tempo baru = tanggal perpanjangan + `lama_pinjam_hari`. |
| AB-06 | Hari terlambat = tanggal kembali − jatuh tempo (hari kalender, minimal 0). |
| AB-07 | Denda = hari terlambat × `denda_per_hari` (boleh 0). |
| AB-08 | Sistem TIDAK PERNAH otomatis mengubah eksemplar menjadi `hilang`. Rusak/hilang hanya ditetapkan petugas. |
| AB-09 | Perubahan aturan hanya berlaku untuk transaksi baru (jatuh tempo lama tidak berubah). |
| AB-10 | Anggota tidak dihapus, hanya dinonaktifkan (tidak bisa login & meminjam), agar riwayat tetap ada. |

Nilai awal `aturan_peminjaman` (bisa diubah petugas di menu Pengaturan):

| jenis | maks_pinjam | lama_pinjam_hari | maks_perpanjangan | denda_per_hari |
|---|---|---|---|---|
| siswa | 2 | 7 | 1 | 0 |
| guru | 5 | 14 | 1 | 0 |

## 3. Teknologi (semua gratis)

- Frontend: React + Vite + TypeScript, Tailwind CSS, React Router, PWA (`vite-plugin-pwa`).
- Backend: Supabase (PostgreSQL, Auth, RLS, fungsi database/RPC, Edge Functions, Storage untuk sampul).
- Hosting: Vercel (Hobby).
- Zona waktu: **Asia/Jakarta (WIB)** untuk semua perhitungan tanggal, di database maupun frontend.
- Impor Excel: library `xlsx` (SheetJS) di frontend untuk membaca file, lalu dikirim ke Edge Function.
- Cetak/PDF: halaman ramah cetak + `window.print()` (pengguna memilih "Simpan sebagai PDF"). Tanpa library PDF.

## 4. Keputusan teknis

### Database (PostgreSQL, disesuaikan dari desain tabel dokumen bagian I.1)
- ENUM → tipe enum Postgres; TINYINT(1) → `boolean`; AUTO_INCREMENT → `identity`; YEAR → `smallint`.
- Tabel `pengguna` diganti **`profil_pengguna`** dengan `id uuid = auth.users.id`. Kata sandi dikelola Supabase Auth (hash), tidak disimpan di tabel kita.
  Kolom: `id, nama, username (unik), role, status, wajib_ganti_password, terakhir_login`.
- Kolom FK yang merujuk pengguna/petugas (`anggota.id_pengguna`, `peminjaman.id_petugas`, `detail_peminjaman.id_petugas_kembali`, `laporan.id_petugas`) bertipe `uuid` → `profil_pengguna.id`.
- Tabel lain mengikuti dokumen: `anggota, kategori, buku, eksemplar (nomor_induk unik), peminjaman, detail_peminjaman, aturan_peminjaman (jenis_anggota unik), laporan`.
- Status **"terlambat" TIDAK disimpan**. Dihitung: `tanggal_jatuh_tempo < hari_ini_WIB AND tanggal_kembali IS NULL`.
- View: ketersediaan per buku (tersedia/total) dan daftar keterlambatan.
- `anggota.status_anggota` dan `profil_pengguna.status` dijaga selalu sama (diubah bersama oleh Edge Function).
- Kategori yang masih punya buku tidak bisa dihapus (FK `RESTRICT`), dengan pesan jelas.

### Login
- Pengguna mengetik NIS / NIP / ID petugas. Frontend memetakan ke email buatan: `<username huruf kecil>@simpus.local`.
- ID petugas berpola `PTG001`, `PTG002`, ... (bebas, tidak dipaksa oleh sistem).
- **Kata sandi awal = NIS/NIP/ID** pengguna itu. `wajib_ganti_password = true` → dipaksa ganti saat login pertama. Reset kata sandi oleh petugas juga mengembalikan ke NIS/NIP dan mewajibkan ganti lagi.
- Akun nonaktif ditolak login (Auth user di-ban lewat Edge Function + dicek di frontend & RLS).

### Keamanan
- RLS aktif di **semua** tabel.
- Anggota hanya membaca data pinjaman miliknya. Katalog (kategori, buku, eksemplar, view ketersediaan) dibaca semua pengguna login. Tulis data master hanya petugas.
- Transaksi sirkulasi **HANYA** lewat fungsi `security definer` yang memeriksa role petugas:
  `catat_peminjaman(nomor_induk_anggota, daftar_nomor_induk_eksemplar[])`,
  `catat_pengembalian(nomor_induk_eksemplar, kondisi, status_denda, catatan)`,
  `catat_perpanjangan(nomor_induk_eksemplar)`,
  `cek_kelayakan_anggota(nomor_induk)`.
  Atomik, mengunci baris eksemplar (`SELECT ... FOR UPDATE`), pesan penolakan berbahasa Indonesia.
  Tabel `peminjaman` & `detail_peminjaman` tidak punya policy INSERT/UPDATE langsung.
- Buat akun, impor Excel, reset sandi, nonaktifkan/aktifkan akun → **Supabase Edge Function** dengan service role key.
  **Service role key TIDAK BOLEH ada di kode frontend** atau di variabel `VITE_*`.
- Frontend hanya memakai `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` dari `.env` (tidak di-commit; ada `.env.example`).

### Format impor Excel anggota (disetujui pemilik, bisa direvisi)
Kolom: `nomor_induk | nama | jenis_anggota (siswa/guru) | kelas | jenis_kelamin (L/P, opsional) | no_hp (opsional)`.
Definisi kolom ada di satu tempat di kode agar mudah diubah; template Excel bisa diunduh dari halaman Data Anggota.

## 5. Di luar cakupan (JANGAN dibuat)
Reservasi/booking, usulan pengadaan, pengumuman kegiatan literasi, notifikasi WhatsApp/email/SMS,
pembayaran denda online, barcode scanner/RFID, integrasi perpustakaan lain, akun kepala sekolah.
(Kolom input nomor induk boleh menerima input dari scanner keyboard-wedge — cukup input teks biasa + Enter.)

## 6. Struktur folder

```
docs/                       dokumen kebutuhan (acuan utama)
public/                     ikon PWA
src/
  lib/                      supabase client, helper tanggal WIB, format rupiah
  auth/                     konteks sesi, penjaga route per role
  layouts/                  LayoutPetugas (sidebar), LayoutAnggota (navigasi bawah)
  components/               komponen UI bersama
  pages/petugas/            halaman petugas
  pages/anggota/            halaman anggota
  pages/                    Login, GantiKataSandi
supabase/
  migrations/               SQL berurutan: 01 enum+tabel, 02 fungsi bantu+trigger, 03 view, 04 RLS, 05 fungsi sirkulasi
  pasang_struktur_database.sql   GABUNGAN semua migrasi (dibuat `npm run gabung-sql`, jangan diedit langsung)
  seed.sql                  data contoh (bukan data siswa asli)
  tests/uji_aturan_bisnis.sql    68 uji AB-01..AB-10 + RLS; aman dijalankan kapan saja (membatalkan perubahannya)
  tests/00_tiruan_supabase_lokal.sql  HANYA untuk uji di PostgreSQL biasa, jangan dijalankan di Supabase
  functions/                Edge Functions manajemen akun
scripts/gabung-sql.mjs      pembuat file gabungan migrasi
PANDUAN_SUPABASE.md         langkah memasang database di Supabase (bahasa sederhana)
```

## 7. Cara kerja
- Bertahap (Tahap 0–8). Di akhir tiap tahap: laporkan hasil, cara mencoba, dan tugas pemilik; **tunggu persetujuan**.
- `npm run build` wajib sukses di setiap tahap.
- Perubahan struktur database selalu lewat **file migrasi baru** (jangan ubah migrasi yang sudah dijalankan).
- Catat setiap revisi dari sekolah di bagian Log Keputusan di bawah.
- Desain: bersih & sederhana; biru-putih (utama), hijau = tersedia, oranye = peringatan/terlambat; tombol nyaman disentuh (min. tinggi 44px).

## 8. Log keputusan
- Tahap 0: ID petugas pola `PTG001`; kata sandi awal = NIS/NIP/ID dan wajib ganti; format impor Excel seperti bagian 4.
- Tahap 0: kolom tambahan `detail_peminjaman.catatan_kembali` (untuk kolom "Catatan" di wireframe pengembalian); `jenis_kelamin` dan `no_hp` jadi kolom opsional di impor Excel; peringatan "mendekati jatuh tempo" = 2 hari sebelumnya.
- Tahap 1: nama sekolah belum ditentukan → dibaca dari `VITE_NAMA_SEKOLAH` di `.env` (default "Nama Sekolah"). Tailwind v4 (plugin `@tailwindcss/vite`, tema di `src/index.css`). Ikon PWA dibuat dari `public/favicon.svg`. `vercel.json` berisi rewrite agar route React Router jalan di Vercel.
- Tahap 2 (database):
  - Objek database: view `v_ketersediaan_buku`, `v_pinjaman` (semua pinjaman + kolom hitung `terlambat`, `hari_lewat_jatuh_tempo`), `v_keterlambatan`; semuanya `security_invoker`.
  - Fungsi tambahan di luar 4 fungsi wajib: `cari_pinjaman_aktif(nomor_induk_eksemplar)` (pratinjau hari terlambat/denda/boleh diperpanjang untuk halaman Pengembalian, hanya baca), `catat_login()`, `tandai_sandi_sudah_diganti()`, `hari_ini_wib()`, `adalah_petugas()`, `pengguna_aktif()`, `id_anggota_saya()`.
  - Status eksemplar `dipinjam` dijaga trigger: hanya sah jika ada pinjaman aktif. Petugas tidak bisa mengubah ke/dari `dipinjam` secara manual; rusak/hilang boleh diubah manual selama tidak sedang dipinjam.
  - Pinjaman dengan kondisi kembali `hilang` → `detail_peminjaman.status = 'hilang'`, eksemplar `hilang`, tidak lagi dihitung pinjaman aktif.
  - Denda dihitung saat pengembalian memakai `denda_per_hari` yang berlaku SAAT ITU (tarif tidak disimpan saat pinjam; yang dikunci AB-09 adalah jatuh tempo). Jika denda 0 → `status_denda = 'tidak_ada'`; jika > 0 dan tidak dipilih → `belum_lunas`.
  - Nomor induk (anggota & eksemplar) dan username dicocokkan tanpa membedakan huruf besar/kecil (unique index pada `lower(...)`).
  - Hapus anggota dilarang trigger (bahkan untuk service_role). `anggota.status_anggota` → otomatis menyalin ke `profil_pengguna.status` lewat trigger.
  - Izin: migrasi 04 mencabut semua izin bawaan anon/authenticated lalu memberi seperlunya. **Setiap fungsi baru di migrasi berikutnya harus di-`revoke ... from public, anon, authenticated` lalu di-`grant` secara eksplisit** (Supabase memberi izin execute bawaan ke anon).
  - Migrasi dan uji sudah dijalankan di PostgreSQL 16 lokal dengan tiruan Supabase (68/68 lulus, termasuk uji dua transaksi bersamaan). Belum diuji di project Supabase sungguhan sampai pemilik membuatnya.
  - Catatan untuk Tahap 3: Supabase Auth mensyaratkan kata sandi minimal 6 karakter. NIS/NIP yang lebih pendek perlu aturan kata sandi awal khusus (seed memakai NIS 6 digit). Belum ada cara membuat petugas pertama tanpa seed → sediakan skrip SQL khusus.
  - Belum ada (tidak diminta dokumen): cara mengubah `status_denda` dari `belum_lunas` ke `lunas` setelah pengembalian. Tanyakan pemilik bila sekolah menerapkan denda.
