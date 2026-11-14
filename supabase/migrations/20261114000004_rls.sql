-- =====================================================================
-- SIMPUS - Migrasi 4: hak akses (GRANT) dan Row Level Security (RLS)
--
-- Ringkasan:
--   * Pengunjung tanpa login (anon)  : tidak bisa apa-apa.
--   * Anggota                        : hanya MEMBACA katalog dan pinjamannya sendiri.
--   * Petugas                        : mengelola data master.
--   * Transaksi sirkulasi            : TIDAK ADA izin tulis langsung ke tabel
--     peminjaman/detail_peminjaman. Hanya lewat fungsi di migrasi 5.
--   * Buat akun / nonaktifkan anggota: lewat Edge Function (service_role).
-- =====================================================================

-- ---------- 1. Cabut semua izin bawaan, lalu beri yang diperlukan saja ----------
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

-- service_role (dipakai Edge Function, tidak pernah ada di frontend)
grant usage on schema public to authenticated, service_role;
grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Membaca (dibatasi lagi oleh RLS di bawah)
grant select on
  public.profil_pengguna, public.anggota, public.kategori, public.buku, public.eksemplar,
  public.peminjaman, public.detail_peminjaman, public.aturan_peminjaman, public.laporan,
  public.v_ketersediaan_buku, public.v_pinjaman, public.v_keterlambatan
to authenticated;

-- Menulis data master (hanya petugas yang lolos RLS)
grant insert, update, delete on public.kategori, public.buku, public.eksemplar to authenticated;
grant update (maks_pinjam, lama_pinjam_hari, maks_perpanjangan, denda_per_hari)
  on public.aturan_peminjaman to authenticated;
grant insert (id_petugas, jenis_laporan, periode_awal, periode_akhir) on public.laporan to authenticated;

-- Petugas boleh mengubah data diri anggota. Kolom lain (nomor induk, status, role,
-- username) hanya bisa diubah lewat Edge Function.
grant update (nama) on public.profil_pengguna to authenticated;
grant update (jenis_anggota, kelas, jenis_kelamin, no_hp) on public.anggota to authenticated;

-- Fungsi bantu yang boleh dipanggil pengguna login
grant execute on function
  public.hari_ini_wib(), public.adalah_petugas(), public.pengguna_aktif(), public.id_anggota_saya(),
  public.catat_login(), public.tandai_sandi_sudah_diganti()
to authenticated;

-- ---------- 2. Aktifkan RLS di SEMUA tabel ----------
alter table public.profil_pengguna    enable row level security;
alter table public.anggota            enable row level security;
alter table public.kategori           enable row level security;
alter table public.buku               enable row level security;
alter table public.eksemplar          enable row level security;
alter table public.peminjaman         enable row level security;
alter table public.detail_peminjaman  enable row level security;
alter table public.aturan_peminjaman  enable row level security;
alter table public.laporan            enable row level security;

-- ---------- 3. Policy ----------

-- profil_pengguna: setiap orang melihat profilnya sendiri; petugas melihat semua
create policy profil_baca on public.profil_pengguna for select to authenticated
  using (id = (select auth.uid()) or (select public.adalah_petugas()));
create policy profil_ubah_oleh_petugas on public.profil_pengguna for update to authenticated
  using ((select public.adalah_petugas()))
  with check ((select public.adalah_petugas()));

-- anggota: anggota melihat datanya sendiri; petugas melihat & mengubah semua
create policy anggota_baca on public.anggota for select to authenticated
  using (
    (select public.adalah_petugas())
    or (id_pengguna = (select auth.uid()) and (select public.pengguna_aktif()))
  );
create policy anggota_ubah_oleh_petugas on public.anggota for update to authenticated
  using ((select public.adalah_petugas()))
  with check ((select public.adalah_petugas()));
-- (tidak ada policy INSERT/DELETE: buat anggota lewat Edge Function, hapus dilarang - AB-10)

-- Katalog: dibaca semua pengguna login yang aktif, ditulis hanya petugas
create policy kategori_baca on public.kategori for select to authenticated
  using ((select public.pengguna_aktif()));
create policy kategori_tambah on public.kategori for insert to authenticated
  with check ((select public.adalah_petugas()));
create policy kategori_ubah on public.kategori for update to authenticated
  using ((select public.adalah_petugas())) with check ((select public.adalah_petugas()));
create policy kategori_hapus on public.kategori for delete to authenticated
  using ((select public.adalah_petugas()));

create policy buku_baca on public.buku for select to authenticated
  using ((select public.pengguna_aktif()));
create policy buku_tambah on public.buku for insert to authenticated
  with check ((select public.adalah_petugas()));
create policy buku_ubah on public.buku for update to authenticated
  using ((select public.adalah_petugas())) with check ((select public.adalah_petugas()));
create policy buku_hapus on public.buku for delete to authenticated
  using ((select public.adalah_petugas()));

create policy eksemplar_baca on public.eksemplar for select to authenticated
  using ((select public.pengguna_aktif()));
create policy eksemplar_tambah on public.eksemplar for insert to authenticated
  with check ((select public.adalah_petugas()));
create policy eksemplar_ubah on public.eksemplar for update to authenticated
  using ((select public.adalah_petugas())) with check ((select public.adalah_petugas()));
create policy eksemplar_hapus on public.eksemplar for delete to authenticated
  using ((select public.adalah_petugas()));

-- aturan_peminjaman: dibaca pengguna aktif, diubah hanya petugas
create policy aturan_baca on public.aturan_peminjaman for select to authenticated
  using ((select public.pengguna_aktif()));
create policy aturan_ubah on public.aturan_peminjaman for update to authenticated
  using ((select public.adalah_petugas())) with check ((select public.adalah_petugas()));

-- peminjaman & detail: HANYA BACA. Anggota hanya miliknya sendiri; petugas semua.
-- Sengaja tidak ada policy INSERT/UPDATE/DELETE (AB-01).
create policy peminjaman_baca on public.peminjaman for select to authenticated
  using (
    (select public.adalah_petugas())
    or id_anggota = (select public.id_anggota_saya())
  );
create policy detail_baca on public.detail_peminjaman for select to authenticated
  using (
    (select public.adalah_petugas())
    or exists (
      select 1 from public.peminjaman p
      where p.id_peminjaman = detail_peminjaman.id_peminjaman
        and p.id_anggota = (select public.id_anggota_saya())
    )
  );

-- laporan: hanya petugas; pencatat harus dirinya sendiri
create policy laporan_baca on public.laporan for select to authenticated
  using ((select public.adalah_petugas()));
create policy laporan_tambah on public.laporan for insert to authenticated
  with check ((select public.adalah_petugas()) and id_petugas = (select auth.uid()));
