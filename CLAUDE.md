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
- Impor Excel: `read-excel-file` (membaca .xlsx) dan `write-excel-file` (template) di frontend, dimuat saat dibutuhkan, lalu data dikirim ke Edge Function. (Bukan `xlsx`/SheetJS: versi di npm punya celah keamanan yang belum ditambal.)
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
  lib/                      supabase client, tanggal WIB, format rupiah, galat (terjemahan error DB), cari (filter aman), sampul, akun (Edge Function), imporAnggota (format kolom Excel), sirkulasi (pemanggil fungsi transaksi), laporan (penyusun isi 4 laporan), ambilSemua (ambil data berhalaman)
  auth/                     KonteksAuth (sesi+profil, masuk/keluar), Penjaga (WajibLogin, HanyaTamu, ArahkanAwal)
  layouts/                  LayoutPetugas (sidebar), LayoutAnggota (navigasi bawah)
  components/               komponen UI bersama (`ui.tsx`: kelas tombol/input, Lencana, Modal, Konfirmasi, Pemberitahuan, Paginasi; `anggota.tsx`: SampulBuku, kartu pinjaman, penanda jatuh tempo/ketersediaan)
  pages/petugas/            halaman petugas
  pages/anggota/            halaman anggota
  pages/                    Login, GantiKataSandi
supabase/
  migrations/               SQL berurutan: 01 enum+tabel, 02 fungsi bantu+trigger, 03 view, 04 RLS, 05 fungsi sirkulasi, 06 denda+blokir login, 07 view anggota+bucket sampul, 08 nama petugas di v_pinjaman
  pasang_struktur_database.sql   GABUNGAN semua migrasi (dibuat `npm run gabung-sql`, jangan diedit langsung)
  seed.sql                  data contoh (bukan data siswa asli)
  tests/uji_aturan_bisnis.sql    79 uji AB-01..AB-10 + RLS; aman dijalankan kapan saja (membatalkan perubahannya)
  tests/00_tiruan_supabase_lokal.sql  HANYA untuk uji di PostgreSQL biasa, jangan dijalankan di Supabase
  functions/kelola-akun/index.ts  Edge Function manajemen akun (satu file, bisa ditempel di editor dashboard)
  config.toml               verify_jwt = false untuk kelola-akun (fungsi memeriksa sendiri)
  buat_petugas_pertama.sql  membuat akun petugas tanpa seed
scripts/gabung-sql.mjs      pembuat file gabungan migrasi
scripts/uji-lokal/          alat uji pengembang: halaman dijalankan di browser, data dijawab PostgreSQL lokal (lihat BACA.md)
PANDUAN_SUPABASE.md         langkah memasang/memperbarui database, Edge Function, dan .env (bahasa sederhana)
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
  - Migrasi dan uji sudah dijalankan di PostgreSQL 16 lokal dengan tiruan Supabase (68/68 lulus, termasuk uji dua transaksi bersamaan). Pada 14/11/2026 pemilik memasang struktur + seed di project Supabase sungguhan dan menjalankan skrip uji: 68/68 LULUS. (Di SQL Editor, saat menjalankan skrip uji pilih "Run without RLS" karena peringatan itu hanya untuk tabel sementara `hasil_uji`.)
  - Catatan untuk Tahap 3: Supabase Auth mensyaratkan kata sandi minimal 6 karakter. NIS/NIP yang lebih pendek perlu aturan kata sandi awal khusus (seed memakai NIS 6 digit). Belum ada cara membuat petugas pertama tanpa seed → sediakan skrip SQL khusus.
  - Belum ada (tidak diminta dokumen): cara mengubah `status_denda` dari `belum_lunas` ke `lunas` setelah pengembalian. Tanyakan pemilik bila sekolah menerapkan denda.
- Tahap 3 (login & akun), 14/11/2026:
  - **Keputusan pemilik:** NIS/NIP di sekolah pas 6 angka → kata sandi awal = nomor induk tanpa aturan tambahan; Edge Function menolak nomor induk < 6 karakter. Sekolah **menerapkan denda Rp1.000/hari** (migrasi 06 mengisi siswa & guru; bisa diubah di Pengaturan).
  - Migrasi 06: `tandai_denda_lunas(id_detail)` (petugas saja). Tombolnya dibuat di Tahap 5 (halaman Pengembalian: daftar denda belum lunas).
  - Migrasi 06: trigger `trg_samakan_status_akun` kini juga mengisi `auth.users.banned_until` → anggota nonaktif ditolak login oleh Supabase Auth (bukan hanya oleh aplikasi). Edge Function `ubah_status` cukup mengubah `anggota.status_anggota`.
  - Project Supabase pemilik: ref `lsxtzwiftvilplpggvmy`, memakai kunci model baru (`sb_publishable_...`) dan JWT ES256. Karena itu `verify_jwt` gerbang dimatikan untuk `kelola-akun`; fungsi memverifikasi token lewat `auth.getUser(token)` lalu memeriksa role petugas di `profil_pengguna`.
  - Edge Function `kelola-akun` (satu fungsi, banyak aksi): `cek`, `buat_anggota`, `impor_anggota` (maks 200 baris/permintaan), `reset_sandi`, `ubah_status`, `ubah_nomor_induk`. Selalu menjawab JSON `{ok, pesan, data}`. Dipanggil dari frontend lewat `src/lib/akun.ts` → `kelolaAkun(aksi, isi)`.
  - Frontend: sesi di `KonteksAuth`; peran dibaca dari `profil_pengguna`, bukan dipilih pengguna. Penjaga route hanya untuk kenyamanan; keamanan data tetap RLS. Ganti kata sandi: `supabase.auth.updateUser` lalu RPC `tandai_sandi_sudah_diganti`; sandi baru min. 6 karakter dan tidak boleh sama dengan username. Di halaman profil/ubah sandi diminta sandi lama (diverifikasi dengan login ulang).
  - Halaman Profil anggota (info akun, ubah sandi, logout) dan menu "Ubah Kata Sandi" petugas dibuat sekarang karena dibutuhkan untuk logout/uji login.
  - Sudah diuji ke project Supabase pemilik: login akun seed, penolakan sandi salah/akun nonaktif, pengalihan per peran (23 uji browser). **Belum diuji:** Edge Function versi terpasang (pemilik belum deploy) dan penggantian kata sandi sungguhan (sengaja tidak mengubah sandi akun pemilik).
  - Catatan Tahap 4: impor Excel harus membaca sel nomor induk sebagai TEKS (NIP 18 digit rusak bila dibaca sebagai angka).
  - Tugas manual pemilik yang tertunda: jalankan migrasi 06, matikan "Allow new users to sign up", deploy Edge Function (lihat PANDUAN_SUPABASE.md bagian 2–4).
  - GitHub: pemilik push sendiri ke `main` dari ZIP; push dari sesi cloud masih 403. Hasil tiap tahap dikirim sebagai ZIP.
- Tahap 4 (data master), 14/11/2026:
  - Pemilik sudah menyelesaikan tugas manual Tahap 3 (diverifikasi dari luar): migrasi 06 aktif, pendaftaran mandiri mati, Edge Function `kelola-akun` terpasang dan menolak non-petugas. Sandi `PTG001` sudah diganti pemilik (tidak diketahui sesi ini).
  - Migrasi 07: view `v_anggota` (anggota + nama + pinjaman_aktif + pinjaman_terlambat, `security_invoker`) dan bucket Storage `sampul` (publik untuk dibaca, tulis/hapus hanya petugas, maks 1 MB, jpeg/png/webp).
  - `buku.sampul` menyimpan LOKASI file di bucket (`buku-<id>/<waktu>.jpg`), bukan URL. Tampilkan lewat `urlSampul()`. Gambar dikecilkan di browser (maks 480x720, JPEG) sebelum diunggah.
  - Halaman: Data Kategori, Data Buku (cari judul/pengarang/ISBN, saring kategori, 20 per halaman), Detail Buku & Eksemplar (rute `/petugas/buku/:id`, `baru` untuk tambah), Data Anggota (tab, cari, saring kelas, tambah/edit/reset sandi/nonaktifkan/aktifkan, impor Excel), Pengaturan Aturan.
  - Edit anggota: nama → `profil_pengguna.nama`, data lain → `anggota` (langsung, dibatasi RLS + izin kolom); perubahan NIS/NIP → Edge Function `ubah_nomor_induk`. Tambah, reset, ubah status → Edge Function.
  - Format impor Excel hanya diatur di `src/lib/imporAnggota.ts` (`KOLOM_IMPOR`). Template berisi baris judul saja (tanpa baris contoh, karena anggota yang terlanjur dibuat tidak bisa dihapus). Baris diperiksa di browser, yang sah dikirim 25 baris per permintaan; server tetap memeriksa ulang.
  - Halaman dimuat malas (`React.lazy`) per rute; `Suspense` ada di dalam layout agar sidebar/navigasi tidak berkedip.
  - Pengujian: kueri baca dijalankan sungguhan ke project pemilik (sebagai anggota contoh, lewat RLS katalog); semua permintaan tulis dicegat di browser uji (54 uji, tidak ada yang sampai ke server). **Belum diuji sungguhan:** tulis data master sebagai petugas, Edge Function dengan sesi petugas, unggah sampul ke Storage, `v_anggota` di project pemilik (migrasi 07 belum dijalankan pemilik). Mengunduh PostgREST untuk tiruan lokal ditolak sistem izin; jangan dicoba lagi tanpa persetujuan pemilik.
- Tahap 5 (sirkulasi), 14/11/2026:
  - Uji coba pemilik di Tahap 4 terbukti berhasil di Supabase sungguhan (terlihat dari data): kategori baru, buku baru dengan sampul di Storage, dan eksemplar tersimpan. Migrasi 07 aktif.
  - Migrasi 08: `v_pinjaman` ditambah kolom `nama_petugas` dan `nama_petugas_kembali` (kosong bagi anggota karena RLS profil).
  - Halaman: Peminjaman (cek kelayakan → daftar buku → simpan → bukti), Bukti Peminjaman (`/petugas/peminjaman/bukti/:id`, cetak/PDF lewat `window.print()`), Pengembalian & Perpanjangan (+ daftar "Denda Belum Lunas" dengan tombol Tandai Lunas), Daftar Keterlambatan (detail → tautan ke Pengembalian `?no=<nomor induk>`).
  - Nomor transaksi tampil sebagai `PJ-` + id 6 digit (`nomorTransaksi()`), tidak disimpan terpisah.
  - Tampilan hanya melakukan pemeriksaan awal (duplikat, batas pinjam, status eksemplar) agar petugas cepat tahu; keputusan akhir selalu oleh fungsi database, dan pesan penolakannya ditampilkan apa adanya.
  - Kondisi kembali Rusak/Hilang selalu meminta konfirmasi petugas (AB-08). Kolom nomor induk berfokus otomatis dan menerima Enter (siap untuk scanner keyboard).
  - Alat uji baru `scripts/uji-lokal/`: 50 uji alur sirkulasi dijalankan di browser dengan data dari PostgreSQL lokal (fungsi dan RLS sungguhan). Uji Tahap 4 yang lama membaca data pemilik dan mengandaikan jumlah seed, jadi tidak lagi cocok setelah pemilik menambah data (bukan regresi).
  - **Belum diuji di Supabase pemilik:** halaman sirkulasi dengan sesi petugas sungguhan (menunggu migrasi 08 dan uji coba pemilik).
  - **Keputusan ditunda pemilik (15/11/2026):** perpanjangan di hari yang sama dengan hari pinjam menghasilkan jatuh tempo yang sama tetapi memakai jatah perpanjangan (sesuai AB-05: tanggal perpanjangan + lama pinjam). Dua pilihan yang sudah ditawarkan: (A) aturan tetap, tolak perpanjangan yang tidak menambah jatuh tempo; (B) ubah menjadi jatuh tempo lama + lama pinjam (mengubah AB-05, perlu persetujuan sekolah). Pemilik memilih "nanti saja" → JANGAN diubah sebelum pemilik memutuskan; tanyakan lagi di Tahap 8.
- Tahap 6 (halaman anggota), 15/11/2026:
  - Migrasi 08 sudah aktif di project pemilik (kolom `nama_petugas` terbaca). Tidak ada migrasi baru di tahap ini.
  - Halaman: Beranda (sapaan, cari → katalog, kotak Peringatan, pinjaman aktif, 6 buku baru), Katalog (cari otomatis 0,4 detik setelah mengetik, chip kategori, 20 per muat + "Muat lebih banyak", keadaan disimpan di alamat `?cari=&kategori=`), Detail Buku (tanpa tombol pinjam; keterangan "peminjaman di meja petugas"), Pinjaman Saya (tab Aktif/Riwayat). Profil sudah ada sejak Tahap 3.
  - Peringatan muncul untuk pinjaman terlambat dan yang jatuh tempo dalam `HARI_PERINGATAN_JATUH_TEMPO` (2) hari, dikelompokkan seperti wireframe ("N buku jatuh tempo pada ...", "N buku terlambat X hari").
  - Penanda ketersediaan: hijau "Tersedia x/y", oranye "Semua dipinjam", biru "Baca di tempat", abu "Tidak tersedia/Belum ada eksemplar".
  - Riwayat juga menampilkan keterlambatan dan denda milik anggota itu (lunas/belum lunas) — hanya informasi, tanpa aksi.
  - Halaman anggota tidak mengirim permintaan tulis apa pun (terbukti di uji: hanya `catat_login`).
  - Pengujian: `scripts/uji-lokal/uji-anggota.cjs` — 71 uji browser (iPhone 13) LANGSUNG ke project pemilik dengan 5 akun contoh; nilai harapan diambil dari API dengan token yang sama. Termasuk gambar sampul dari Storage, RLS (hanya pinjaman sendiri), ukuran sentuh >= 44px, tanpa gulir samping.
- Tahap 7 (laporan & dashboard), 15/11/2026:
  - Tidak ada migrasi baru. Isi laporan dihitung di browser dari `v_pinjaman`, `v_ketersediaan_buku`, dan `eksemplar` (`src/lib/laporan.ts`); data diambil berhalaman 1.000 baris (`ambilSemua`) karena batas baris Supabase.
  - Dashboard: 4 angka (peminjaman/pengembalian hari ini dihitung PER BUKU, jatuh tempo hari ini, terlambat + "Lihat daftar"), tombol pintas, grafik batang 7 hari (CSS biasa, tanpa library), ringkasan koleksi, tabel jatuh tempo hari ini (nomor induk menaut ke Pengembalian).
  - Laporan (4 tab, periode bawaan tanggal 1 bulan ini s.d. hari ini, langsung tampil saat tab dibuka):
    - Peminjaman: periode dari TANGGAL PINJAM; ringkasan transaksi/buku/anggota/"Pengembalian Terlambat" (kembali terlambat + masih terlambat).
    - Keterlambatan: periode dari TANGGAL JATUH TEMPO; pinjaman yang kembali terlambat atau masih terlambat; denda tercatat hanya untuk yang sudah kembali.
    - Buku Terpopuler: periode dari tanggal pinjam; peringkat per judul + "judul tidak dipinjam".
    - Koleksi: keadaan SAAT INI (per kategori + daftar eksemplar rusak/hilang); periode hanya dipakai untuk "eksemplar masuk pada periode".
  - Cetak/Unduh PDF: mencatat satu baris ke tabel `laporan` (jenis, periode, petugas) lalu `window.print()`. Tombol terkunci bila periode diubah tetapi belum ditampilkan. Tampilan cetak: kepala laporan (nama perpustakaan, judul, periode), tabel bergaris, "dicetak oleh", kolom tanda tangan Kepala Sekolah dan Petugas (hanya muncul saat dicetak).
  - Alat uji: `db-lokal.cjs` kini menjawab saringan sederhana (eq/neq/gt/gte/lt/lte/is/in), order, Range, dan hitung (HEAD + count). Bentuk kueri yang sama sudah dicek diterima PostgREST project pemilik (hanya baca, sebagai anggota).
  - Hasil uji terakhir: dashboard+laporan 36, sirkulasi 50, anggota 71, login 23, database 79 — semua lulus. **Belum diuji di project pemilik dengan sesi petugas:** Dashboard dan Laporan (angka seluruh sekolah hanya terbaca petugas).
