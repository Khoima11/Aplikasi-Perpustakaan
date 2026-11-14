-- =====================================================================
-- SIMPUS - Migrasi 3: view
-- Semua view memakai security_invoker = true, artinya aturan RLS tetap
-- berlaku sesuai pengguna yang membuka (anggota hanya melihat miliknya).
-- =====================================================================

-- ---------- Ketersediaan per buku (tersedia / total) ----------
create or replace view public.v_ketersediaan_buku
with (security_invoker = true) as
select
  b.id_buku,
  b.id_kategori,
  k.nama_kategori,
  b.isbn,
  b.judul,
  b.pengarang,
  b.penerbit,
  b.tahun_terbit,
  b.lokasi_rak,
  b.sinopsis,
  b.sampul,
  b.dapat_dipinjam,
  b.tanggal_input,
  count(e.id_eksemplar)::int                                   as total_eksemplar,
  (count(*) filter (where e.status = 'tersedia'))::int         as tersedia,
  (count(*) filter (where e.status = 'dipinjam'))::int         as dipinjam,
  (count(*) filter (where e.status = 'rusak'))::int            as rusak,
  (count(*) filter (where e.status = 'hilang'))::int           as hilang
from public.buku b
join public.kategori k on k.id_kategori = b.id_kategori
left join public.eksemplar e on e.id_buku = b.id_buku
group by b.id_buku, k.nama_kategori;

-- ---------- Semua pinjaman dalam bentuk siap tampil ----------
-- Status "terlambat" TIDAK disimpan; dihitung di sini:
--   terlambat = belum kembali DAN jatuh tempo < hari ini (WIB)
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
  -- Untuk pinjaman aktif: selisih hari berjalan. Negatif/0 = belum terlambat (sisa hari).
  case when d.status = 'dipinjam'
       then public.hari_ini_wib() - d.tanggal_jatuh_tempo
  end as hari_lewat_jatuh_tempo
from public.detail_peminjaman d
join public.peminjaman p       on p.id_peminjaman = d.id_peminjaman
join public.anggota a          on a.id_anggota = p.id_anggota
join public.profil_pengguna pa on pa.id = a.id_pengguna
join public.eksemplar e        on e.id_eksemplar = d.id_eksemplar
join public.buku b             on b.id_buku = e.id_buku;

-- ---------- Daftar keterlambatan ----------
create or replace view public.v_keterlambatan
with (security_invoker = true) as
select
  id_detail,
  id_peminjaman,
  tanggal_pinjam,
  id_anggota,
  nomor_induk_anggota,
  nama_anggota,
  jenis_anggota,
  kelas,
  no_hp,
  id_eksemplar,
  nomor_induk_eksemplar,
  id_buku,
  judul,
  tanggal_jatuh_tempo,
  jumlah_perpanjangan,
  hari_lewat_jatuh_tempo as hari_terlambat
from public.v_pinjaman
where terlambat;
