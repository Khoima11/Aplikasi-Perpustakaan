# Alat uji lokal (khusus pengembang)

Folder ini TIDAK dipakai aplikasi dan tidak perlu dijalankan pemilik project.
Isinya alat untuk menguji halaman di browser otomatis tanpa mengubah data di Supabase.

Cara kerjanya: halaman dibuka di browser otomatis (Playwright). Setiap permintaan data
`/rest/v1/...` dicegat dan dijawab oleh database PostgreSQL lokal yang berisi migrasi dan
seed yang sama, dijalankan sebagai petugas lewat role `authenticated`. Jadi fungsi transaksi,
RLS, dan pesan penolakannya sungguhan.

| File | Isi |
|---|---|
| `siapkan-db.sh` | Membuat ulang database `simpus_uji` (tiruan Supabase + migrasi + seed) |
| `db-lokal.cjs` | Penjawab permintaan REST dari database lokal |
| `uji-sirkulasi.cjs` | 50 uji: keterlambatan, peminjaman, bukti, pengembalian, perpanjangan, denda |
| `uji-login.cjs` | 23 uji login, pengalihan per peran, form ganti kata sandi; langsung ke Supabase di `.env` (tanpa mengubah kata sandi) |
| `uji-data-master.cjs` | 54 uji halaman data master; baca dari Supabase di `.env`, semua penulisan dicegat (tidak sampai ke server) |
| `uji-dashboard-laporan.cjs` | 36 uji: angka dashboard, grafik, keempat laporan, histori cetak, tampilan cetak (angka harapan dihitung dengan SQL) |
| `uji-anggota.cjs` | 71 uji halaman anggota; hanya membaca, langsung ke Supabase di `.env` (tidak butuh database lokal) |

Menjalankan (database lokal harus disegarkan dulu karena uji mengubah datanya):

```bash
scripts/uji-lokal/siapkan-db.sh
npm run build && npx vite preview --port 4173 &
node scripts/uji-lokal/uji-sirkulasi.cjs
scripts/uji-lokal/siapkan-db.sh          # segarkan lagi sebelum uji berikutnya
node scripts/uji-lokal/uji-dashboard-laporan.cjs
```

Syarat: PostgreSQL lokal, Playwright, dan file `.env` yang terisi (login uji memakai akun
contoh `240002`; perannya ditirukan menjadi petugas hanya di browser uji).
Tangkapan layar dan PDF hasil uji disimpan di `keluaran/` (tidak ikut di-commit).

Uji yang memakai Supabase di `.env` (`uji-login`, `uji-anggota`, `uji-data-master`) membutuhkan
akun contoh dari `seed.sql` yang kata sandinya belum diganti (240001, 240002, 240003, 230005,
220006, 220007). Uji itu hanya membaca; permintaan tulis dicegat di browser uji.
