# Alat uji lokal (khusus pengembang)

Folder ini TIDAK dipakai aplikasi dan tidak perlu dijalankan pemilik project.
Isinya alat untuk menguji halaman sirkulasi tanpa menyentuh data di Supabase.

Cara kerjanya: halaman dibuka di browser otomatis (Playwright). Setiap permintaan data
`/rest/v1/...` dicegat dan dijawab oleh database PostgreSQL lokal yang berisi migrasi dan
seed yang sama, dijalankan sebagai petugas lewat role `authenticated`. Jadi fungsi transaksi,
RLS, dan pesan penolakannya sungguhan.

| File | Isi |
|---|---|
| `siapkan-db.sh` | Membuat ulang database `simpus_uji` (tiruan Supabase + migrasi + seed) |
| `db-lokal.cjs` | Penjawab permintaan REST dari database lokal |
| `uji-sirkulasi.cjs` | 50 uji: keterlambatan, peminjaman, bukti, pengembalian, perpanjangan, denda |

Menjalankan (database lokal harus disegarkan dulu karena uji mengubah datanya):

```bash
scripts/uji-lokal/siapkan-db.sh
npm run build && npx vite preview --port 4173 &
node scripts/uji-lokal/uji-sirkulasi.cjs
```

Syarat: PostgreSQL lokal, Playwright, dan file `.env` yang terisi (login uji memakai akun
contoh `240002`; perannya ditirukan menjadi petugas hanya di browser uji).
Tangkapan layar dan PDF hasil uji disimpan di `keluaran/` (tidak ikut di-commit).
