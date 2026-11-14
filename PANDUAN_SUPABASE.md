# Panduan Memasang Database SIMPUS di Supabase

Panduan ini untuk pemilik project. Tidak perlu memasang aplikasi apa pun, cukup browser.
Waktu yang dibutuhkan sekitar 15 menit.

## A. Membuat project Supabase (gratis)

1. Buka https://supabase.com lalu klik **Start your project**. Daftar memakai akun Google atau GitHub.
2. Klik **New project**.
3. Isi:
   - **Name**: `simpus`
   - **Database Password**: klik **Generate a password**, lalu **salin dan simpan** di tempat aman
     (catatan pribadi). Kata sandi ini jarang dipakai, tetapi tidak bisa dilihat lagi nanti.
   - **Region**: pilih **Southeast Asia (Singapore)** agar cepat diakses dari Indonesia.
4. Klik **Create new project** dan tunggu 1–2 menit sampai selesai disiapkan.

## B. Memasang struktur database

1. Di menu kiri Supabase, klik **SQL Editor**, lalu **New query** (atau tanda **+**).
2. Buka file `supabase/pasang_struktur_database.sql` dari project ini, salin **seluruh** isinya
   (Ctrl+A lalu Ctrl+C), tempel ke SQL Editor (Ctrl+V).
3. Klik **Run** (atau Ctrl+Enter).
   - Jika muncul peringatan seperti *"Potential issue detected"* / *"destructive operation"*,
     itu wajar karena skrip mengatur hak akses. Klik **Run this query**.
4. Berhasil jika di bagian bawah muncul tulisan: `Struktur database SIMPUS berhasil dipasang`.

## C. Mengisi data contoh

1. Klik **New query** lagi (lembar kosong baru).
2. Salin seluruh isi file `supabase/seed.sql`, tempel, lalu **Run**.
3. Berhasil jika muncul satu baris angka:
   `petugas 1, anggota 10, kategori 6, buku 30, eksemplar 60, pinjaman_aktif 12, pinjaman_terlambat 3`.

Data contoh ini karangan (bukan data siswa asli). Akun contohnya:

| Peran | Username | Kata sandi awal |
|---|---|---|
| Petugas | `PTG001` | `PTG001` |
| Siswa | `240001`, `240002`, `240003`, `230004`, `230005`, `220006` | sama dengan username |
| Siswa nonaktif | `220007` | (tidak bisa login) |
| Guru | `198501012010011001`, `199003152015032002`, `197811202005011003` | sama dengan username |

## D. Menjalankan uji aturan bisnis

1. Klik **New query** lagi.
2. Salin seluruh isi file `supabase/tests/uji_aturan_bisnis.sql`, tempel, lalu **Run**.
3. Muncul tabel berisi 68 baris uji. Gulir ke baris paling bawah (**RINGKASAN**).
   Seharusnya tertulis: `68 uji dijalankan: 68 LULUS, 0 GAGAL` dan `LULUS SEMUA`.

Uji ini aman dijalankan kapan saja: ia membuat data uji sendiri lalu membatalkannya,
sehingga data Anda tidak berubah.

## E. Menyalin alamat dan kunci untuk aplikasi

1. Di Supabase, klik ikon roda gigi **Project Settings** (kiri bawah).
2. Buka **Data API** untuk melihat **Project URL**, dan **API Keys** untuk melihat kunci.
3. Yang dibutuhkan aplikasi hanya dua:
   - **Project URL** (contoh: `https://abcdefgh.supabase.co`)
   - kunci **anon / public** (pada tampilan baru bernama **Publishable key**)
4. **JANGAN** menyalin atau membagikan kunci **service_role** / **Secret key** ke siapa pun,
   termasuk ke dalam percakapan. Kunci itu bisa membuka seluruh data.

Kedua nilai di langkah 3 aman dibagikan (memang dirancang untuk dipakai di aplikasi),
dan akan diisikan ke file `.env` pada Tahap 3.

## Jika ada yang gagal

Salin pesan error berwarna merah yang muncul di SQL Editor, lalu kirimkan apa adanya.
Jangan menjalankan ulang `pasang_struktur_database.sql` pada project yang sudah terpasang;
skrip itu hanya untuk project yang masih kosong.
