# SIMPUS — Sistem Informasi Perpustakaan Sekolah

Aplikasi web responsif untuk perpustakaan satu sekolah. Bisa dipasang di layar utama HP (PWA).
Tampilan bernuansa cokelat karamel dengan satu gaya untuk komputer dan HP.

- **Petugas** (tampilan komputer): mengelola kategori, buku, eksemplar, anggota, dan aturan
  peminjaman; mencatat peminjaman, pengembalian, dan perpanjangan; memantau keterlambatan;
  membuat laporan untuk kepala sekolah.
- **Anggota** (siswa dan guru, tampilan HP): melihat katalog dan ketersediaan buku, pinjaman
  aktif dan jatuh tempo, riwayat pinjaman, dan mengubah kata sandi. Anggota tidak bisa membuat
  transaksi apa pun; semua peminjaman dicatat petugas di meja layanan.

Rancangan lengkap ada di `docs/SIMPUS_Dokumen_Kebutuhan.docx`.
Catatan teknis dan riwayat keputusan ada di `CLAUDE.md`.

---

## Daftar isi

1. [Yang dibutuhkan](#1-yang-dibutuhkan)
2. [Menyiapkan Supabase (database)](#2-menyiapkan-supabase-database)
3. [Menjalankan di komputer sendiri](#3-menjalankan-di-komputer-sendiri)
4. [Deploy ke Vercel (online)](#4-deploy-ke-vercel-online)
5. [Memasang di HP](#5-memasang-di-hp)
6. [Pemakaian sehari-hari](#6-pemakaian-sehari-hari)
7. [Memperbarui aplikasi](#7-memperbarui-aplikasi)
8. [Masalah yang sering terjadi](#8-masalah-yang-sering-terjadi)
9. [Keamanan](#9-keamanan)
10. [Untuk pengembang](#10-untuk-pengembang)

---

## 1. Yang dibutuhkan

Semua layanan di bawah ini gratis.

| Kebutuhan | Untuk apa | Dapatkan di |
|---|---|---|
| Akun Supabase | Database, login, penyimpanan gambar sampul | https://supabase.com |
| Akun GitHub | Menyimpan kode | https://github.com |
| Akun Vercel | Menaruh aplikasi online | https://vercel.com (daftar dengan akun GitHub) |
| Node.js versi LTS | Menjalankan aplikasi di komputer (opsional) | https://nodejs.org |
| Git | Mengirim kode ke GitHub | https://git-scm.com |

---

## 2. Menyiapkan Supabase (database)

Langkah lengkap dengan bahasa sederhana ada di **`PANDUAN_SUPABASE.md`**. Ringkasannya:

1. Buat project Supabase baru (region **Southeast Asia (Singapore)**).
2. SQL Editor → jalankan `supabase/pasang_struktur_database.sql` (sekali saja).
3. Isi data awal, pilih salah satu:
   - uji coba: jalankan `supabase/seed.sql` (data contoh karangan);
   - pemakaian sungguhan: ubah lalu jalankan `supabase/buat_petugas_pertama.sql`.
4. Jalankan `supabase/tests/uji_aturan_bisnis.sql` (pilih **Run without RLS**).
   Baris terakhir harus `... LULUS, 0 GAGAL`.
5. Authentication → matikan **Allow new users to sign up**.
6. Edge Functions → buat fungsi bernama **`kelola-akun`**, tempel isi
   `supabase/functions/kelola-akun/index.ts`, Deploy, lalu matikan
   **Verify JWT with legacy secret**.
7. Project Settings → salin **Project URL** dan kunci **Publishable** (anon/public).

---

## 3. Menjalankan di komputer sendiri

Buka CMD, lalu jalankan satu per satu.

```bash
cd /d C:\Projects\Aplikasi-Perpustakaan
```

Buat file pengaturan dari contohnya (sekali saja):

```bash
copy .env.example .env
```

```bash
notepad .env
```

Isi tiga baris ini, lalu simpan:

```
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_xxxxxxxxxxxx
VITE_NAMA_SEKOLAH=Nama Sekolah Anda
```

Pasang bahan-bahannya (sekali saja, atau setiap kali ada pembaruan):

```bash
npm install
```

Jalankan:

```bash
npm run dev
```

Buka http://localhost:5173 di browser. Tekan **Ctrl+C** di CMD untuk berhenti.

---

## 4. Deploy ke Vercel (online)

Setelah langkah ini aplikasi punya alamat seperti `https://simpus-namasekolah.vercel.app`
yang bisa dibuka dari HP mana pun.

### 4.1 Pastikan kode terbaru sudah ada di GitHub

```bash
cd /d C:\Projects\Aplikasi-Perpustakaan
```

```bash
git add .
```

```bash
git commit -m "Siap deploy"
```

```bash
git push
```

### 4.2 Hubungkan ke Vercel

1. Buka https://vercel.com, klik **Sign Up** / **Log In**, pilih **Continue with GitHub**.
2. Klik **Add New…** → **Project**.
3. Pada daftar repository, cari **Aplikasi-Perpustakaan**, klik **Import**.
   Jika tidak muncul, klik **Adjust GitHub App Permissions** dan izinkan repository itu.
4. Di halaman **Configure Project**:
   - **Project Name**: misalnya `simpus-namasekolah` (ini menjadi alamat web).
   - **Framework Preset**: harus terbaca **Vite**. Jika tidak, pilih Vite.
   - **Build Command**, **Output Directory**, **Install Command**: biarkan bawaan
     (`npm run build`, `dist`, `npm install`).
5. Buka bagian **Environment Variables**, tambahkan tiga baris (nama persis seperti ini):

   | Key | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | Project URL dari Supabase |
   | `VITE_SUPABASE_ANON_KEY` | Kunci Publishable dari Supabase |
   | `VITE_NAMA_SEKOLAH` | Nama sekolah, misalnya `SMP Negeri 1 Contoh` |

   **Jangan** menambahkan kunci Secret / service_role di sini.
6. Klik **Deploy** dan tunggu 1–2 menit sampai muncul tulisan **Congratulations**.
7. Klik gambar pratinjau atau **Continue to Dashboard** → **Visit** untuk membuka aplikasinya.

### 4.3 Periksa setelah deploy

- Buka alamatnya, login sebagai petugas, buka beberapa menu.
- Tidak boleh ada pita oranye "Koneksi Supabase belum diatur". Jika ada, Environment
  Variables belum terisi benar (lihat bagian 8).
- Buka alamat yang sama di HP dan login sebagai anggota.

### 4.4 Mengganti nama sekolah atau pengaturan lain

Vercel → project → **Settings** → **Environment Variables** → ubah nilainya →
lalu **Deployments** → titik tiga pada deployment teratas → **Redeploy**.
Perubahan pengaturan baru berlaku setelah redeploy.

---

## 5. Memasang di HP

Setelah aplikasi online:

- **Android (Chrome)**: buka alamat aplikasi → menu titik tiga → **Tambahkan ke layar utama**
  / **Instal aplikasi**.
- **iPhone (Safari)**: buka alamat aplikasi → tombol **Bagikan** → **Tambahkan ke Layar Utama**.

Ikon SIMPUS akan muncul seperti aplikasi biasa. Aplikasi tetap butuh internet; data
perpustakaan selalu diambil terbaru dari server.

---

## 6. Pemakaian sehari-hari

### Login

Pengguna mengetik **NIS / NIP / ID petugas** dan kata sandi.
Kata sandi awal sama dengan nomor induknya dan wajib diganti saat login pertama.
Lupa kata sandi → petugas membuka Data Anggota → **Reset Sandi** (kata sandi kembali ke NIS/NIP).

### Petugas

| Menu | Kegunaan |
|---|---|
| Dashboard | Ringkasan hari ini, grafik 7 hari, ringkasan koleksi, jatuh tempo hari ini |
| Data Kategori | Tambah, ubah, hapus kategori |
| Data Buku | Daftar judul; **Detail / Edit** untuk mengubah data buku, sampul, dan eksemplar |
| Data Anggota | Tambah anggota, **Impor Excel**, reset sandi, nonaktifkan/aktifkan |
| Peminjaman | Ketik NIS/NIP → masukkan nomor induk buku → Simpan → cetak bukti |
| Pengembalian | Ketik nomor induk buku → pilih kondisi → Simpan; atau Perpanjang; tandai denda lunas |
| Keterlambatan | Daftar pinjaman yang lewat jatuh tempo |
| Laporan | Peminjaman, keterlambatan, buku terpopuler, koleksi; Cetak / Unduh PDF untuk kepala sekolah |
| Pengaturan | Batas pinjam, lama pinjam, batas perpanjangan, denda per hari (siswa dan guru) |

**Impor anggota dari Excel**: Data Anggota → Impor Excel → **Unduh Template** → isi satu
anggota per baris (kolom `nomor_induk, nama, jenis_anggota, kelas, jenis_kelamin, no_hp`) →
pilih file → periksa pratinjau → Impor. Atur format sel `nomor_induk` dan `no_hp` menjadi
**Teks** di Excel agar angka nol di depan dan NIP panjang tidak berubah.

**Menyimpan PDF**: tombol Cetak / Unduh PDF membuka jendela cetak; pilih printer
**Simpan sebagai PDF** (Save as PDF).

### Anggota (HP)

Beranda (peringatan jatuh tempo, pinjaman aktif, buku baru), Katalog (cari dan saring
kategori), Pinjaman (aktif dan riwayat), Profil (ubah kata sandi, logout).

### Aturan yang dijaga sistem

- Hanya petugas yang bisa mencatat transaksi.
- Anggota tidak bisa meminjam jika akunnya nonaktif, punya pinjaman terlambat, atau sudah
  mencapai batas jumlah pinjam.
- Buku referensi (hanya dibaca di tempat) dan eksemplar yang tidak tersedia tidak bisa dipinjam.
- Jatuh tempo dihitung otomatis dan disimpan; mengubah aturan tidak mengubah pinjaman lama.
- Perpanjangan ditolak jika sudah terlambat atau batas perpanjangan tercapai.
- Denda = hari terlambat × denda per hari.
- Buku yang terlambat **tidak pernah** otomatis dianggap hilang; status rusak/hilang hanya
  ditetapkan petugas.
- Anggota tidak dihapus, hanya dinonaktifkan, agar riwayatnya tetap ada.

---

## 7. Memperbarui aplikasi

1. Ganti file di folder project dengan versi baru.
2. Jika ada **file migrasi baru** di `supabase/migrations/`, jalankan file itu di
   Supabase SQL Editor (lihat `PANDUAN_SUPABASE.md` bagian 2), lalu jalankan lagi skrip uji.
3. Jika `supabase/functions/kelola-akun/index.ts` berubah, tempel ulang di Edge Function
   lalu **Deploy updates**.
4. Kirim ke GitHub:

```bash
git add .
```

```bash
git commit -m "Pembaruan SIMPUS"
```

```bash
git push
```

Vercel otomatis membangun dan memasang versi baru dalam 1–2 menit setelah push.

---

## 8. Masalah yang sering terjadi

| Gejala | Penyebab dan solusi |
|---|---|
| Pita oranye "Koneksi Supabase belum diatur" | File `.env` (komputer) atau Environment Variables (Vercel) belum diisi. Setelah mengubah di Vercel, lakukan **Redeploy**. |
| `npm error enoent ... package.json` | CMD tidak berada di folder project. Jalankan `cd /d C:\Projects\Aplikasi-Perpustakaan` dulu. |
| "Username atau kata sandi salah" | Periksa NIS/NIP. Jika lupa, petugas melakukan Reset Sandi. |
| "Akun Anda dinonaktifkan" | Anggota dinonaktifkan. Petugas bisa mengaktifkan kembali di Data Anggota. |
| "Edge Function kelola-akun belum dipasang" | Pasang Edge Function (PANDUAN_SUPABASE.md bagian 4), nama harus persis `kelola-akun`. |
| Tambah anggota gagal dengan pesan tentang sesi/JWT | Matikan **Verify JWT with legacy secret** pada Edge Function `kelola-akun`. |
| "Penyimpanan sampul belum disiapkan" | Jalankan migrasi `...000007_view_anggota_dan_sampul.sql`. |
| Halaman kosong setelah deploy / error 404 saat memuat ulang halaman | Pastikan file `vercel.json` ikut ter-push ke GitHub. |
| Tampilan di HP tidak berubah setelah pembaruan | Tutup aplikasi lalu buka lagi (versi baru dipasang otomatis saat dibuka). |
| Project Supabase "paused" | Paket gratis Supabase menghentikan sementara project yang tidak dipakai sekitar seminggu. Buka dashboard Supabase dan klik **Restore project**. |

---

## 9. Keamanan

- Aplikasi di browser hanya memakai kunci **Publishable** (aman dibagikan). Kunci
  **Secret / service_role** hanya ada di server Supabase untuk Edge Function dan **tidak
  boleh** dimasukkan ke `.env`, Vercel, atau kode.
- Semua tabel dilindungi Row Level Security: anggota hanya bisa membaca pinjamannya sendiri,
  dan hanya petugas yang bisa mengubah data.
- File `.env` tidak ikut ke GitHub (diatur di `.gitignore`).
- Kata sandi disimpan Supabase dalam bentuk hash.
- Lakukan cadangan data berkala: Supabase → Database → Backups (paket gratis menyimpan
  cadangan harian beberapa hari), atau ekspor tabel dari Table Editor.

---

## 10. Untuk pengembang

```bash
npm run dev          # server pengembangan
npm run build        # pemeriksaan TypeScript + build produksi ke dist/
npm run preview      # menjalankan hasil build
npm run gabung-sql   # menyusun ulang supabase/pasang_struktur_database.sql dari folder migrations
```

- Struktur folder, keputusan teknis, dan log keputusan: `CLAUDE.md`.
- Perubahan database selalu lewat **file migrasi baru** di `supabase/migrations/`,
  lalu jalankan `npm run gabung-sql`.
- Uji aturan bisnis di database: `supabase/tests/uji_aturan_bisnis.sql`.
- Uji halaman di browser (Playwright): `scripts/uji-lokal/` (lihat `BACA.md` di sana).

Teknologi: React + Vite + TypeScript, Tailwind CSS, React Router, vite-plugin-pwa,
Supabase (PostgreSQL, Auth, RLS, Edge Functions, Storage), Vercel.
