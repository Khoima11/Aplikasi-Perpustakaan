-- =====================================================================
-- SIMPUS - Migrasi 8
-- Menambahkan nama petugas pencatat ke view v_pinjaman, untuk Bukti
-- Peminjaman dan daftar "Peminjaman Terakhir Hari Ini".
-- (Kolom baru ditaruh di akhir; kolom lama tidak berubah.)
-- Anggota tidak punya izin membaca profil petugas, sehingga bagi anggota
-- kedua kolom ini bernilai kosong.
-- =====================================================================
create or replace view public.v_pinjaman
with (security_invoker = true) as
select
  d.id_detail,
  d.id_peminjaman,
  p.tanggal_pinjam,
  p.id_petugas,
  a.id_anggota,
  a.nomor_induk            as nomor_induk_anggota,
  pa.nama                  as nama_anggota,
  a.jenis_anggota,
  a.kelas,
  a.no_hp,
  e.id_eksemplar,
  e.nomor_induk            as nomor_induk_eksemplar,
  b.id_buku,
  b.judul,
  b.pengarang,
  b.sampul,
  d.tanggal_jatuh_tempo,
  d.jumlah_perpanjangan,
  d.tanggal_kembali,
  d.id_petugas_kembali,
  d.kondisi_kembali,
  d.hari_terlambat,
  d.denda,
  d.status_denda,
  d.status,
  d.catatan_kembali,
  (d.status = 'dipinjam' and d.tanggal_jatuh_tempo < public.hari_ini_wib()) as terlambat,
  case when d.status = 'dipinjam'
       then public.hari_ini_wib() - d.tanggal_jatuh_tempo
  end as hari_lewat_jatuh_tempo,
  pp.nama                  as nama_petugas,
  pk.nama                  as nama_petugas_kembali
from public.detail_peminjaman d
join public.peminjaman p       on p.id_peminjaman = d.id_peminjaman
join public.anggota a          on a.id_anggota = p.id_anggota
join public.profil_pengguna pa on pa.id = a.id_pengguna
join public.eksemplar e        on e.id_eksemplar = d.id_eksemplar
join public.buku b             on b.id_buku = e.id_buku
left join public.profil_pengguna pp on pp.id = p.id_petugas
left join public.profil_pengguna pk on pk.id = d.id_petugas_kembali;
