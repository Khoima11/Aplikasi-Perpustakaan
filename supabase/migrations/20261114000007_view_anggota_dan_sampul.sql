-- =====================================================================
-- SIMPUS - Migrasi 7
--   (a) View v_anggota: daftar anggota + nama + jumlah pinjaman aktif,
--       dipakai halaman Data Anggota (bisa dicari berdasarkan nama/NIS)
--   (b) Penyimpanan gambar sampul buku (Supabase Storage, bucket "sampul")
-- =====================================================================

-- ---------- (a) View daftar anggota ----------
create or replace view public.v_anggota
with (security_invoker = true) as
select
  a.id_anggota,
  a.id_pengguna,
  a.nomor_induk,
  p.nama,
  a.jenis_anggota,
  a.kelas,
  a.jenis_kelamin,
  a.no_hp,
  a.status_anggota,
  p.wajib_ganti_password,
  p.terakhir_login,
  coalesce(x.aktif, 0)::int     as pinjaman_aktif,
  coalesce(x.terlambat, 0)::int as pinjaman_terlambat
from public.anggota a
join public.profil_pengguna p on p.id = a.id_pengguna
left join lateral (
  select count(*) filter (where d.status = 'dipinjam') as aktif,
         count(*) filter (where d.status = 'dipinjam' and d.tanggal_jatuh_tempo < public.hari_ini_wib()) as terlambat
    from public.peminjaman pj
    join public.detail_peminjaman d on d.id_peminjaman = pj.id_peminjaman
   where pj.id_anggota = a.id_anggota
) x on true;

revoke all on public.v_anggota from anon, authenticated;
grant select on public.v_anggota to authenticated;
grant all on public.v_anggota to service_role;

-- ---------- (b) Bucket gambar sampul ----------
-- Bucket bersifat publik untuk DIBACA (gambar sampul bukan data rahasia, dan
-- agar bisa ditampilkan langsung di katalog). Menulis/menghapus hanya petugas.
-- Batas ukuran 1 MB per gambar; aplikasi mengecilkan gambar sebelum mengunggah.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sampul', 'sampul', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists sampul_lihat_daftar on storage.objects;
drop policy if exists sampul_unggah_petugas on storage.objects;
drop policy if exists sampul_ubah_petugas on storage.objects;
drop policy if exists sampul_hapus_petugas on storage.objects;

create policy sampul_lihat_daftar on storage.objects for select to authenticated
  using (bucket_id = 'sampul' and (select public.pengguna_aktif()));
create policy sampul_unggah_petugas on storage.objects for insert to authenticated
  with check (bucket_id = 'sampul' and (select public.adalah_petugas()));
create policy sampul_ubah_petugas on storage.objects for update to authenticated
  using (bucket_id = 'sampul' and (select public.adalah_petugas()))
  with check (bucket_id = 'sampul' and (select public.adalah_petugas()));
create policy sampul_hapus_petugas on storage.objects for delete to authenticated
  using (bucket_id = 'sampul' and (select public.adalah_petugas()));
