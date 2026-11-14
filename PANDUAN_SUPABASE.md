# Panduan Memasang SIMPUS di Supabase

Panduan ini untuk pemilik project. Hampir semuanya cukup lewat browser.
Nama tombol di Supabase kadang berubah sedikit; cari yang paling mirip.

Daftar isi:
- Bagian 1 — Memasang database dari nol (project Supabase baru)
- Bagian 2 — Memperbarui database yang sudah terpasang
- Bagian 3 — Mematikan pendaftaran mandiri
- Bagian 4 — Memasang Edge Function `kelola-akun`
- Bagian 5 — Menghubungkan aplikasi (file `.env`) dan menjalankannya di komputer

---

## Bagian 1 — Memasang database dari nol

### A. Membuat project Supabase (gratis)

1. Buka https://supabase.com lalu klik **Start your project**. Daftar memakai akun Google atau GitHub.
2. Klik **New project**.
3. Isi:
   - **Name**: `simpus`
   - **Database Password**: klik **Generate a password**, lalu **salin dan simpan** di tempat aman.
   - **Region**: **Southeast Asia (Singapore)**.
4. Klik **Create new project** dan tunggu 1–2 menit.

### B. Memasang struktur database

1. Di menu kiri klik **SQL Editor**, lalu **New query**.
2. Salin **seluruh** isi file `supabase/pasang_struktur_database.sql`, tempel, lalu klik **Run**.
   - Jika muncul peringatan *"Potential issue detected"* / *"destructive operation"*, klik **Run this query**.
3. Berhasil jika muncul: `Struktur database SIMPUS berhasil dipasang`.

File ini hanya untuk project yang masih kosong. Jangan dijalankan dua kali.

### C. Mengisi data awal (pilih salah satu)

- **Uji coba:** jalankan `supabase/seed.sql` (data contoh karangan: 1 petugas, 10 anggota, 30 buku).
  Berhasil jika muncul: petugas 1, anggota 10, kategori 6, buku 30, eksemplar 60, pinjaman_aktif 12, pinjaman_terlambat 3.
- **Pemakaian sungguhan (tanpa data contoh):** buka `supabase/buat_petugas_pertama.sql`,
  ganti ID dan nama petugas di bagian atas, lalu jalankan. Data lain diisi lewat aplikasi.

Akun contoh dari `seed.sql` (kata sandi awal = username, wajib diganti saat login pertama):

| Peran | Username |
|---|---|
| Petugas | `PTG001` |
| Siswa | `240001`, `240002`, `240003`, `230004`, `230005`, `220006` |
| Siswa nonaktif (tidak bisa login) | `220007` |
| Guru | `198501012010011001`, `199003152015032002`, `197811202005011003` |

### D. Menjalankan uji aturan bisnis

1. **New query** baru, tempel seluruh isi `supabase/tests/uji_aturan_bisnis.sql`, lalu **Run**.
2. Jika muncul peringatan RLS untuk tabel `hasil_uji`, pilih **Run without RLS**
   (itu hanya tabel sementara penampung hasil uji).
3. Baris paling bawah (**RINGKASAN**) seharusnya `... LULUS, 0 GAGAL` dan `LULUS SEMUA`.

Uji ini aman dijalankan kapan saja; ia membatalkan sendiri semua perubahannya.

---

## Bagian 2 — Memperbarui database yang sudah terpasang

Setiap perubahan struktur database datang sebagai file baru di `supabase/migrations/`.
Jalankan **hanya file yang belum pernah dijalankan**, urut dari nomor terkecil:
SQL Editor → New query → tempel isi file → Run. Berhasil jika muncul `Success. No rows returned`.

| File migrasi | Isi | Sudah termasuk di `pasang_struktur_database.sql`? |
|---|---|---|
| `...000001` s.d. `...000005` | Struktur awal (Tahap 2) | Ya |
| `...000006_denda_dan_blokir_login.sql` | Denda Rp1.000/hari, tandai denda lunas, akun nonaktif diblokir login | Ya (untuk pemasangan baru) |
| `...000007_view_anggota_dan_sampul.sql` | Daftar anggota untuk halaman Data Anggota, tempat penyimpanan gambar sampul | Ya (untuk pemasangan baru) |
| `...000008_nama_petugas_di_pinjaman.sql` | Nama petugas pencatat pada bukti peminjaman dan daftar transaksi | Ya (untuk pemasangan baru) |

Jika database Anda dipasang **sebelum** sebuah migrasi ada, jalankan file migrasi itu secara terpisah.
Setelah itu jalankan lagi skrip uji (Bagian 1-D) untuk memastikan semuanya tetap lulus.

---

## Bagian 3 — Mematikan pendaftaran mandiri

SIMPUS tidak mengenal pendaftaran sendiri; akun dibuat petugas. Matikan fitur daftar bawaan Supabase:

1. Menu kiri **Authentication** → **Sign In / Providers** (atau **Providers**).
2. Di bagian **User Signups**, matikan **Allow new users to sign up**.
3. Klik **Save**.

Petugas tetap bisa membuat akun anggota dari aplikasi; yang ditutup hanya pendaftaran dari luar.

---

## Bagian 4 — Memasang Edge Function `kelola-akun`

Edge Function ini yang membuat akun anggota, impor Excel, reset kata sandi, dan menonaktifkan anggota.
Ia berjalan di server Supabase dan memegang kunci rahasia, sehingga kunci itu tidak pernah sampai ke browser.

1. Menu kiri **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Isi nama fungsi persis: `kelola-akun`
3. Hapus semua kode contoh di editor, lalu tempel **seluruh** isi file
   `supabase/functions/kelola-akun/index.ts`.
4. Klik **Deploy function**.
5. Setelah terpasang, buka fungsi `kelola-akun` → tab **Details** (atau **Settings**).
   Matikan **Verify JWT with legacy secret** (kadang tertulis **Enforce JWT Verification**), lalu **Save**.
   Ini aman: fungsi memeriksa sendiri bahwa pemanggil sudah login dan berperan petugas.

Tidak ada kunci yang perlu Anda salin atau isi; Supabase menyediakannya otomatis untuk fungsi ini.

Jika kode fungsi berubah di tahap berikutnya, ulangi langkah 3–4 pada fungsi yang sama
(buka fungsi → tab **Code** → ganti isinya → **Deploy updates**).

---

## Bagian 5 — Menghubungkan aplikasi dan menjalankannya di komputer

### Nilai yang dibutuhkan (dari Supabase → Project Settings)

- **Project URL** — di **Data API** (contoh `https://abcdefgh.supabase.co`)
- kunci **Publishable** (dulu bernama *anon / public*) — di **API Keys**

**JANGAN** memakai atau membagikan kunci **Secret / service_role**. Kunci itu membuka seluruh data.

### Membuat file `.env`

Di CMD, dari dalam folder project:

```bash
copy .env.example .env
```

```bash
notepad .env
```

Isi tiga baris ini dengan nilai Anda, lalu simpan (Ctrl+S):

```
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_xxxxxxxxxxxx
VITE_NAMA_SEKOLAH=Nama Sekolah Anda
```

File `.env` tidak ikut ter-push ke GitHub (sudah diatur di `.gitignore`).

### Menjalankan aplikasi

Perlu Node.js versi LTS (unduh di https://nodejs.org, pasang dengan Next sampai selesai, lalu buka CMD baru).

```bash
npm install
```

```bash
npm run dev
```

Buka alamat yang muncul (biasanya http://localhost:5173). Untuk berhenti, tekan Ctrl+C di CMD.

---

## Jika ada yang gagal

Salin pesan error apa adanya (atau screenshot), lalu kirimkan.
