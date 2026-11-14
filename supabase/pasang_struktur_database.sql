-- =====================================================================
-- SIMPUS - STRUKTUR DATABASE LENGKAP (gabungan 8 file migrasi)
--
-- FILE INI DIBUAT OTOMATIS oleh "npm run gabung-sql". JANGAN DIEDIT LANGSUNG.
-- Sumber aslinya ada di folder supabase/migrations.
--
-- Cara pakai (hanya untuk project Supabase yang masih BARU/KOSONG):
--   Supabase > SQL Editor > New query > tempel seluruh isi file ini > Run
-- =====================================================================

begin;

-- >>>>>>>>>> 20261114000001_enum_dan_tabel.sql <<<<<<<<<<

-- =====================================================================
-- SIMPUS - Migrasi 1: tipe enum, tabel, constraint, dan index
-- Mengikuti desain tabel dokumen bagian I.1, disesuaikan ke PostgreSQL:
--   ENUM -> tipe enum, TINYINT(1) -> boolean, AUTO_INCREMENT -> identity,
--   YEAR -> smallint, tabel "pengguna" -> profil_pengguna (id = auth.users.id)
-- =====================================================================

-- ---------- Tipe enum ----------
create type public.peran_pengguna   as enum ('petugas', 'anggota');
create type public.status_aktif     as enum ('aktif', 'nonaktif');
create type public.jenis_anggota    as enum ('siswa', 'guru');
create type public.jenis_kelamin    as enum ('L', 'P');
create type public.status_eksemplar as enum ('tersedia', 'dipinjam', 'rusak', 'hilang');
create type public.kondisi_kembali  as enum ('baik', 'rusak', 'hilang');
create type public.status_denda     as enum ('tidak_ada', 'belum_lunas', 'lunas');
create type public.status_pinjaman  as enum ('dipinjam', 'dikembalikan', 'hilang');
create type public.jenis_laporan    as enum ('peminjaman', 'keterlambatan', 'buku_terpopuler', 'koleksi');

-- ---------- profil_pengguna (pengganti tabel "pengguna") ----------
-- Kata sandi TIDAK disimpan di sini. Kata sandi dikelola Supabase Auth (dalam bentuk hash).
create table public.profil_pengguna (
  id                    uuid primary key references auth.users (id) on delete cascade,
  nama                  varchar(100) not null,
  username              varchar(30)  not null,          -- NIS / NIP / ID petugas
  role                  public.peran_pengguna not null,
  status                public.status_aktif   not null default 'aktif',
  wajib_ganti_password  boolean not null default true,  -- true = wajib ganti kata sandi saat login pertama
  terakhir_login        timestamptz,
  constraint profil_pengguna_username_tidak_kosong check (length(btrim(username)) > 0)
);
-- Username unik tanpa membedakan huruf besar/kecil (PTG001 = ptg001)
create unique index profil_pengguna_username_unik on public.profil_pengguna (lower(username));

-- ---------- anggota ----------
create table public.anggota (
  id_anggota      integer generated always as identity primary key,
  id_pengguna     uuid not null unique references public.profil_pengguna (id),
  nomor_induk     varchar(20) not null,                 -- NIS (siswa) atau NIP (guru)
  jenis_anggota   public.jenis_anggota not null,
  kelas           varchar(10),                          -- dikosongkan untuk guru
  jenis_kelamin   public.jenis_kelamin,
  no_hp           varchar(15),
  status_anggota  public.status_aktif not null default 'aktif',
  constraint anggota_nomor_induk_tidak_kosong check (length(btrim(nomor_induk)) > 0)
);
create unique index anggota_nomor_induk_unik on public.anggota (lower(nomor_induk));
create index anggota_jenis_kelas_idx on public.anggota (jenis_anggota, kelas);

-- ---------- kategori ----------
create table public.kategori (
  id_kategori    integer generated always as identity primary key,
  nama_kategori  varchar(50) not null,
  keterangan     text,
  constraint kategori_nama_tidak_kosong check (length(btrim(nama_kategori)) > 0)
);
create unique index kategori_nama_unik on public.kategori (lower(nama_kategori));

-- ---------- buku (data judul) ----------
create table public.buku (
  id_buku         integer generated always as identity primary key,
  -- RESTRICT: kategori yang masih punya buku tidak bisa dihapus
  id_kategori     integer not null references public.kategori (id_kategori) on delete restrict,
  isbn            varchar(20),
  judul           varchar(200) not null,
  pengarang       varchar(150),
  penerbit        varchar(100),
  tahun_terbit    smallint,
  lokasi_rak      varchar(30),
  sinopsis        text,
  sampul          varchar(255),                         -- lokasi file gambar sampul (boleh kosong)
  dapat_dipinjam  boolean not null default true,        -- false = hanya dibaca di tempat
  tanggal_input   timestamptz not null default now(),   -- dipakai untuk daftar "buku baru"
  constraint buku_judul_tidak_kosong check (length(btrim(judul)) > 0),
  constraint buku_tahun_terbit_wajar check (tahun_terbit is null or tahun_terbit between 1000 and 2999)
);
create index buku_id_kategori_idx   on public.buku (id_kategori);
create index buku_tanggal_input_idx on public.buku (tanggal_input desc);

-- ---------- eksemplar (buku fisik) ----------
create table public.eksemplar (
  id_eksemplar      integer generated always as identity primary key,
  id_buku           integer not null references public.buku (id_buku) on delete cascade,
  nomor_induk       varchar(30) not null,               -- nomor induk buku fisik
  sumber_perolehan  varchar(50),
  tanggal_masuk     date,
  status            public.status_eksemplar not null default 'tersedia',
  keterangan        text,
  constraint eksemplar_nomor_induk_tidak_kosong check (length(btrim(nomor_induk)) > 0)
);
create unique index eksemplar_nomor_induk_unik on public.eksemplar (lower(nomor_induk));
create index eksemplar_id_buku_idx on public.eksemplar (id_buku);
create index eksemplar_status_idx  on public.eksemplar (status);

-- ---------- peminjaman (kepala transaksi) ----------
create table public.peminjaman (
  id_peminjaman   integer generated always as identity primary key,
  id_anggota      integer not null references public.anggota (id_anggota),
  id_petugas      uuid    not null references public.profil_pengguna (id),
  tanggal_pinjam  timestamptz not null default now()
);
create index peminjaman_id_anggota_idx     on public.peminjaman (id_anggota);
create index peminjaman_tanggal_pinjam_idx on public.peminjaman (tanggal_pinjam);

-- ---------- detail_peminjaman (satu baris per eksemplar yang dipinjam) ----------
create table public.detail_peminjaman (
  id_detail            integer generated always as identity primary key,
  id_peminjaman        integer not null references public.peminjaman (id_peminjaman) on delete cascade,
  id_eksemplar         integer not null references public.eksemplar (id_eksemplar),
  tanggal_jatuh_tempo  date not null,                   -- AB-04: disimpan saat transaksi
  jumlah_perpanjangan  smallint not null default 0,
  tanggal_kembali      timestamptz,                     -- kosong jika belum kembali
  id_petugas_kembali   uuid references public.profil_pengguna (id),
  kondisi_kembali      public.kondisi_kembali,
  hari_terlambat       integer not null default 0,
  denda                numeric(10,2) not null default 0,
  status_denda         public.status_denda not null default 'tidak_ada',
  status               public.status_pinjaman not null default 'dipinjam',
  catatan_kembali      text,                            -- kolom "Catatan" pada halaman pengembalian
  constraint detail_perpanjangan_tidak_negatif check (jumlah_perpanjangan >= 0),
  constraint detail_hari_terlambat_tidak_negatif check (hari_terlambat >= 0),   -- AB-06
  constraint detail_denda_tidak_negatif check (denda >= 0),
  -- Pinjaman berstatus 'dipinjam' pasti belum punya tanggal kembali, dan sebaliknya
  constraint detail_status_selaras_tanggal_kembali
    check ((status = 'dipinjam') = (tanggal_kembali is null)),
  constraint detail_kondisi_selaras_status
    check ((status = 'dipinjam') = (kondisi_kembali is null))
);
create index detail_id_peminjaman_idx on public.detail_peminjaman (id_peminjaman);
create index detail_id_eksemplar_idx  on public.detail_peminjaman (id_eksemplar);
-- Satu eksemplar hanya boleh punya SATU pinjaman aktif pada satu waktu
create unique index detail_satu_pinjaman_aktif_per_eksemplar
  on public.detail_peminjaman (id_eksemplar) where status = 'dipinjam';
-- Mempercepat daftar keterlambatan (status "terlambat" dihitung, tidak disimpan)
create index detail_jatuh_tempo_aktif_idx
  on public.detail_peminjaman (tanggal_jatuh_tempo) where status = 'dipinjam';

-- ---------- aturan_peminjaman (satu baris per jenis anggota) ----------
create table public.aturan_peminjaman (
  id_aturan          integer generated always as identity primary key,
  jenis_anggota      public.jenis_anggota not null unique,
  maks_pinjam        smallint not null check (maks_pinjam >= 1),
  lama_pinjam_hari   smallint not null check (lama_pinjam_hari >= 1),
  maks_perpanjangan  smallint not null check (maks_perpanjangan >= 0),
  denda_per_hari     numeric(10,2) not null default 0 check (denda_per_hari >= 0)
);

-- Nilai awal aturan (bisa diubah petugas di menu Pengaturan)
insert into public.aturan_peminjaman (jenis_anggota, maks_pinjam, lama_pinjam_hari, maks_perpanjangan, denda_per_hari)
values ('siswa', 2, 7, 1, 0),
       ('guru',  5, 14, 1, 0);

-- ---------- laporan (histori pembuatan laporan) ----------
create table public.laporan (
  id_laporan     integer generated always as identity primary key,
  id_petugas     uuid not null references public.profil_pengguna (id),
  jenis_laporan  public.jenis_laporan not null,
  periode_awal   date not null,
  periode_akhir  date not null,
  tanggal_cetak  timestamptz not null default now(),
  constraint laporan_periode_berurutan check (periode_akhir >= periode_awal)
);
create index laporan_tanggal_cetak_idx on public.laporan (tanggal_cetak desc);

-- >>>>>>>>>> 20261114000002_fungsi_bantu_dan_trigger.sql <<<<<<<<<<

-- =====================================================================
-- SIMPUS - Migrasi 2: fungsi bantu dan trigger penjaga data
-- =====================================================================

-- ---------- Tanggal hari ini menurut WIB ----------
-- Semua perhitungan tanggal (jatuh tempo, keterlambatan) memakai Asia/Jakarta.
create or replace function public.hari_ini_wib()
returns date
language sql
stable
set search_path = public, pg_temp
as $$
  select (now() at time zone 'Asia/Jakarta')::date;
$$;

-- ---------- Siapa pengguna yang sedang login? ----------
-- Fungsi-fungsi ini "security definer" agar bisa membaca profil_pengguna
-- tanpa terhalang RLS (dipakai di dalam policy RLS itu sendiri).

-- true jika pengguna login adalah petugas yang masih aktif
create or replace function public.adalah_petugas()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profil_pengguna
    where id = auth.uid() and role = 'petugas' and status = 'aktif'
  );
$$;

-- true jika pengguna login (petugas atau anggota) masih aktif
create or replace function public.pengguna_aktif()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profil_pengguna
    where id = auth.uid() and status = 'aktif'
  );
$$;

-- id_anggota milik pengguna login (null jika bukan anggota atau sudah nonaktif)
create or replace function public.id_anggota_saya()
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select a.id_anggota
  from public.anggota a
  join public.profil_pengguna p on p.id = a.id_pengguna
  where a.id_pengguna = auth.uid()
    and a.status_anggota = 'aktif'
    and p.status = 'aktif';
$$;

-- ---------- Dipanggil aplikasi setelah login / ganti kata sandi ----------
create or replace function public.catat_login()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.profil_pengguna set terakhir_login = now() where id = auth.uid();
$$;

create or replace function public.tandai_sandi_sudah_diganti()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.profil_pengguna set wajib_ganti_password = false where id = auth.uid();
$$;

-- ---------- Trigger: status 'dipinjam' pada eksemplar hanya diatur transaksi ----------
-- Aturan: eksemplar berstatus 'dipinjam' JIKA DAN HANYA JIKA ada pinjaman aktif
-- (detail_peminjaman.status = 'dipinjam') untuk eksemplar itu.
-- Akibatnya petugas tidak bisa mengubah status ke/dari 'dipinjam' secara manual;
-- perubahan itu hanya terjadi lewat catat_peminjaman dan catat_pengembalian.
-- Status rusak/hilang tetap boleh diubah petugas (AB-08) selama buku tidak sedang dipinjam.
create or replace function public.trg_jaga_status_eksemplar()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ada_pinjaman_aktif boolean;
begin
  if tg_op = 'INSERT' then
    if new.status = 'dipinjam' then
      raise exception 'Eksemplar baru tidak boleh langsung berstatus Dipinjam. Status Dipinjam hanya diatur oleh transaksi peminjaman.';
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    select exists (
      select 1 from public.detail_peminjaman d
      where d.id_eksemplar = new.id_eksemplar and d.status = 'dipinjam'
    ) into v_ada_pinjaman_aktif;

    if new.status = 'dipinjam' and not v_ada_pinjaman_aktif then
      raise exception 'Status Dipinjam tidak bisa diatur manual. Catat lewat menu Peminjaman.';
    end if;
    if old.status = 'dipinjam' and v_ada_pinjaman_aktif then
      raise exception 'Eksemplar % sedang dipinjam. Statusnya hanya berubah lewat menu Pengembalian.', old.nomor_induk;
    end if;
  end if;
  return new;
end;
$$;

create trigger jaga_status_eksemplar
  before insert or update on public.eksemplar
  for each row execute function public.trg_jaga_status_eksemplar();

-- ---------- Trigger: anggota tidak boleh dihapus (AB-10) ----------
create or replace function public.trg_larang_hapus_anggota()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'Data anggota tidak boleh dihapus agar riwayat pinjaman tetap tersimpan. Nonaktifkan anggota sebagai gantinya.';
end;
$$;

create trigger larang_hapus_anggota
  before delete on public.anggota
  for each row execute function public.trg_larang_hapus_anggota();

-- ---------- Trigger: status akun mengikuti status anggota ----------
-- Saat anggota dinonaktifkan/diaktifkan, status akun login-nya ikut berubah,
-- sehingga kedua kolom status selalu sama.
create or replace function public.trg_samakan_status_akun()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.profil_pengguna
     set status = new.status_anggota
   where id = new.id_pengguna
     and status is distinct from new.status_anggota;
  return new;
end;
$$;

create trigger samakan_status_akun
  after insert or update of status_anggota on public.anggota
  for each row execute function public.trg_samakan_status_akun();

-- >>>>>>>>>> 20261114000003_view.sql <<<<<<<<<<

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

-- >>>>>>>>>> 20261114000004_rls.sql <<<<<<<<<<

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

-- >>>>>>>>>> 20261114000005_fungsi_sirkulasi.sql <<<<<<<<<<

-- =====================================================================
-- SIMPUS - Migrasi 5: fungsi transaksi sirkulasi
--
-- Satu-satunya jalan untuk mencatat peminjaman, pengembalian, perpanjangan.
-- Setiap fungsi:
--   * "security definer"  -> berjalan dengan hak pemilik, tetapi di baris pertama
--                            memeriksa bahwa pemanggil adalah PETUGAS (AB-01)
--   * atomik               -> semua berhasil atau semua dibatalkan
--   * mengunci baris       -> SELECT ... FOR UPDATE, agar dua petugas tidak bisa
--                            meminjamkan eksemplar yang sama pada saat bersamaan
--   * pesan penolakan dalam Bahasa Indonesia
-- =====================================================================

-- ---------- Pemeriksaan bersama: pemanggil harus petugas ----------
create or replace function public._wajib_petugas(p_kegiatan text)
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.adalah_petugas() then
    raise exception 'Hanya petugas yang dapat %.', p_kegiatan using errcode = '42501';
  end if;
  return auth.uid();
end;
$$;

-- =====================================================================
-- cek_kelayakan_anggota(nomor_induk)
-- Dipakai halaman Peminjaman setelah petugas mengetik NIS/NIP.
-- Mengembalikan data anggota, jumlah pinjaman, dan boleh/tidaknya meminjam (AB-02).
-- =====================================================================
create or replace function public.cek_kelayakan_anggota(p_nomor_induk text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_anggota   record;
  v_aturan    public.aturan_peminjaman%rowtype;
  v_aktif     integer;
  v_terlambat integer;
  v_alasan    text := null;
begin
  perform public._wajib_petugas('memeriksa kelayakan anggota');

  select a.id_anggota, a.nomor_induk, a.jenis_anggota, a.kelas, a.status_anggota,
         p.nama, p.status as status_akun
    into v_anggota
    from public.anggota a
    join public.profil_pengguna p on p.id = a.id_pengguna
   where lower(a.nomor_induk) = lower(btrim(coalesce(p_nomor_induk, '')));

  if not found then
    raise exception 'Anggota dengan nomor induk "%" tidak ditemukan.', btrim(coalesce(p_nomor_induk, ''));
  end if;

  select * into v_aturan from public.aturan_peminjaman where jenis_anggota = v_anggota.jenis_anggota;
  if not found then
    raise exception 'Aturan peminjaman untuk % belum diatur. Lengkapi di menu Pengaturan.', v_anggota.jenis_anggota;
  end if;

  select count(*) filter (where d.status = 'dipinjam'),
         count(*) filter (where d.status = 'dipinjam' and d.tanggal_jatuh_tempo < public.hari_ini_wib())
    into v_aktif, v_terlambat
    from public.detail_peminjaman d
    join public.peminjaman pj on pj.id_peminjaman = d.id_peminjaman
   where pj.id_anggota = v_anggota.id_anggota;

  if v_anggota.status_anggota <> 'aktif' or v_anggota.status_akun <> 'aktif' then
    v_alasan := 'Anggota berstatus nonaktif.';
  elsif v_terlambat > 0 then
    v_alasan := format('Anggota masih memiliki %s pinjaman yang melewati jatuh tempo. Kembalikan terlebih dahulu.', v_terlambat);
  elsif v_aktif >= v_aturan.maks_pinjam then
    v_alasan := format('Jumlah pinjaman aktif sudah mencapai batas (%s dari %s buku).', v_aktif, v_aturan.maks_pinjam);
  end if;

  return jsonb_build_object(
    'id_anggota',         v_anggota.id_anggota,
    'nomor_induk',        v_anggota.nomor_induk,
    'nama',               v_anggota.nama,
    'jenis_anggota',      v_anggota.jenis_anggota,
    'kelas',              v_anggota.kelas,
    'status_anggota',     v_anggota.status_anggota,
    'pinjaman_aktif',     v_aktif,
    'maks_pinjam',        v_aturan.maks_pinjam,
    'sisa_kuota',         greatest(v_aturan.maks_pinjam - v_aktif, 0),
    'pinjaman_terlambat', v_terlambat,
    'lama_pinjam_hari',   v_aturan.lama_pinjam_hari,
    'jatuh_tempo_jika_pinjam_hari_ini', public.hari_ini_wib() + v_aturan.lama_pinjam_hari,
    'boleh_meminjam',     v_alasan is null,
    'alasan',             v_alasan
  );
end;
$$;

-- =====================================================================
-- catat_peminjaman(nomor_induk_anggota, daftar_nomor_induk_eksemplar[])
-- AB-01, AB-02, AB-03, AB-04
-- =====================================================================
create or replace function public.catat_peminjaman(
  p_nomor_induk_anggota          text,
  p_daftar_nomor_induk_eksemplar text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_petugas      uuid;
  v_anggota      record;
  v_aturan       public.aturan_peminjaman%rowtype;
  v_daftar       text[];
  v_jumlah       integer;
  v_aktif        integer;
  v_terlambat    integer;
  v_no           text;
  v_eks          record;
  v_id_eksemplar integer[] := '{}';
  v_hari_ini     date := public.hari_ini_wib();
  v_jatuh_tempo  date;
  v_id_pinjam    integer;
begin
  -- AB-01: hanya petugas
  v_petugas := public._wajib_petugas('mencatat peminjaman');

  -- Rapikan daftar nomor induk eksemplar
  select array_agg(lower(btrim(x)) order by ord)
    into v_daftar
    from unnest(coalesce(p_daftar_nomor_induk_eksemplar, '{}')) with ordinality as t(x, ord)
   where btrim(coalesce(x, '')) <> '';
  v_jumlah := coalesce(array_length(v_daftar, 1), 0);

  if v_jumlah = 0 then
    raise exception 'Belum ada buku yang dimasukkan. Masukkan minimal satu nomor induk eksemplar.';
  end if;
  if (select count(distinct x) from unnest(v_daftar) as x) <> v_jumlah then
    raise exception 'Ada nomor induk eksemplar yang dimasukkan lebih dari sekali.';
  end if;

  -- Kunci baris anggota: mencegah dua transaksi bersamaan melewati batas pinjam
  select a.id_anggota, a.nomor_induk, a.jenis_anggota, a.status_anggota, p.nama, p.status as status_akun
    into v_anggota
    from public.anggota a
    join public.profil_pengguna p on p.id = a.id_pengguna
   where lower(a.nomor_induk) = lower(btrim(coalesce(p_nomor_induk_anggota, '')))
     for update of a;

  if not found then
    raise exception 'Anggota dengan nomor induk "%" tidak ditemukan.', btrim(coalesce(p_nomor_induk_anggota, ''));
  end if;

  -- AB-02 (a): akun aktif
  if v_anggota.status_anggota <> 'aktif' or v_anggota.status_akun <> 'aktif' then
    raise exception 'Peminjaman ditolak: anggota % (%) berstatus nonaktif.', v_anggota.nama, v_anggota.nomor_induk;
  end if;

  select * into v_aturan from public.aturan_peminjaman where jenis_anggota = v_anggota.jenis_anggota;
  if not found then
    raise exception 'Aturan peminjaman untuk % belum diatur. Lengkapi di menu Pengaturan.', v_anggota.jenis_anggota;
  end if;

  select count(*) filter (where d.status = 'dipinjam'),
         count(*) filter (where d.status = 'dipinjam' and d.tanggal_jatuh_tempo < v_hari_ini)
    into v_aktif, v_terlambat
    from public.detail_peminjaman d
    join public.peminjaman pj on pj.id_peminjaman = d.id_peminjaman
   where pj.id_anggota = v_anggota.id_anggota;

  -- AB-02 (b): tidak punya pinjaman lewat jatuh tempo
  if v_terlambat > 0 then
    raise exception 'Peminjaman ditolak: % masih memiliki % pinjaman yang melewati jatuh tempo. Kembalikan terlebih dahulu.',
      v_anggota.nama, v_terlambat;
  end if;

  -- AB-02 (c): pinjaman aktif + buku baru tidak melebihi batas
  if v_aktif + v_jumlah > v_aturan.maks_pinjam then
    raise exception 'Peminjaman ditolak: melebihi batas pinjam. Pinjaman aktif % buku, akan meminjam % buku, batas untuk % adalah % buku.',
      v_aktif, v_jumlah, v_anggota.jenis_anggota, v_aturan.maks_pinjam;
  end if;

  -- AB-03: kunci dan periksa setiap eksemplar (urutan tetap agar tidak saling mengunci)
  for v_no in select x from unnest(v_daftar) as x order by x loop
    select e.id_eksemplar, e.nomor_induk, e.status, b.judul, b.dapat_dipinjam
      into v_eks
      from public.eksemplar e
      join public.buku b on b.id_buku = e.id_buku
     where lower(e.nomor_induk) = v_no
       for update of e;

    if not found then
      raise exception 'Eksemplar dengan nomor induk "%" tidak ditemukan.', upper(v_no);
    end if;
    if not v_eks.dapat_dipinjam then
      raise exception 'Eksemplar % ("%") tidak dapat dipinjam karena bukunya hanya untuk dibaca di tempat.',
        v_eks.nomor_induk, v_eks.judul;
    end if;
    if v_eks.status <> 'tersedia' then
      raise exception 'Eksemplar % ("%") tidak tersedia. Status saat ini: %.',
        v_eks.nomor_induk, v_eks.judul, v_eks.status;
    end if;
    v_id_eksemplar := v_id_eksemplar || v_eks.id_eksemplar;
  end loop;

  -- AB-04: jatuh tempo dihitung sekarang dan DISIMPAN
  v_jatuh_tempo := v_hari_ini + v_aturan.lama_pinjam_hari;

  insert into public.peminjaman (id_anggota, id_petugas)
  values (v_anggota.id_anggota, v_petugas)
  returning id_peminjaman into v_id_pinjam;

  insert into public.detail_peminjaman (id_peminjaman, id_eksemplar, tanggal_jatuh_tempo)
  select v_id_pinjam, x, v_jatuh_tempo from unnest(v_id_eksemplar) as x;

  update public.eksemplar set status = 'dipinjam' where id_eksemplar = any (v_id_eksemplar);

  return jsonb_build_object(
    'id_peminjaman',       v_id_pinjam,
    'nama_anggota',        v_anggota.nama,
    'nomor_induk_anggota', v_anggota.nomor_induk,
    'jumlah_buku',         v_jumlah,
    'tanggal_jatuh_tempo', v_jatuh_tempo,
    'pesan',               format('Peminjaman %s buku untuk %s berhasil dicatat.', v_jumlah, v_anggota.nama)
  );
end;
$$;

-- =====================================================================
-- cari_pinjaman_aktif(nomor_induk_eksemplar)
-- Dipakai halaman Pengembalian: menampilkan data pinjaman beserta pratinjau
-- hari terlambat, denda, dan boleh/tidaknya diperpanjang. Tidak mengubah data.
-- =====================================================================
create or replace function public.cari_pinjaman_aktif(p_nomor_induk_eksemplar text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_no        text := lower(btrim(coalesce(p_nomor_induk_eksemplar, '')));
  v           record;
  v_aturan    public.aturan_peminjaman%rowtype;
  v_hari_ini  date := public.hari_ini_wib();
  v_terlambat integer;
  v_alasan    text := null;
begin
  perform public._wajib_petugas('melihat data pinjaman');

  if not exists (select 1 from public.eksemplar where lower(nomor_induk) = v_no) then
    raise exception 'Eksemplar dengan nomor induk "%" tidak ditemukan.', btrim(coalesce(p_nomor_induk_eksemplar, ''));
  end if;

  select d.id_detail, d.id_peminjaman, d.tanggal_jatuh_tempo, d.jumlah_perpanjangan,
         pj.tanggal_pinjam, a.nomor_induk as nomor_induk_anggota, a.jenis_anggota, a.kelas,
         pa.nama as nama_anggota, e.nomor_induk as nomor_induk_eksemplar, b.judul
    into v
    from public.detail_peminjaman d
    join public.eksemplar e        on e.id_eksemplar = d.id_eksemplar
    join public.buku b             on b.id_buku = e.id_buku
    join public.peminjaman pj      on pj.id_peminjaman = d.id_peminjaman
    join public.anggota a          on a.id_anggota = pj.id_anggota
    join public.profil_pengguna pa on pa.id = a.id_pengguna
   where lower(e.nomor_induk) = v_no and d.status = 'dipinjam';

  if not found then
    raise exception 'Eksemplar "%" tidak sedang dipinjam.', btrim(p_nomor_induk_eksemplar);
  end if;

  select * into v_aturan from public.aturan_peminjaman where jenis_anggota = v.jenis_anggota;
  v_terlambat := greatest(v_hari_ini - v.tanggal_jatuh_tempo, 0);

  if v_terlambat > 0 then
    v_alasan := format('Pinjaman sudah terlambat %s hari.', v_terlambat);
  elsif v.jumlah_perpanjangan >= v_aturan.maks_perpanjangan then
    v_alasan := format('Batas perpanjangan sudah tercapai (%s dari %s kali).', v.jumlah_perpanjangan, v_aturan.maks_perpanjangan);
  end if;

  return jsonb_build_object(
    'id_detail',             v.id_detail,
    'id_peminjaman',         v.id_peminjaman,
    'nama_anggota',          v.nama_anggota,
    'nomor_induk_anggota',   v.nomor_induk_anggota,
    'jenis_anggota',         v.jenis_anggota,
    'kelas',                 v.kelas,
    'judul',                 v.judul,
    'nomor_induk_eksemplar', v.nomor_induk_eksemplar,
    'tanggal_pinjam',        v.tanggal_pinjam,
    'tanggal_jatuh_tempo',   v.tanggal_jatuh_tempo,
    'jumlah_perpanjangan',   v.jumlah_perpanjangan,
    'maks_perpanjangan',     v_aturan.maks_perpanjangan,
    'hari_terlambat',        v_terlambat,
    'denda',                 v_terlambat * v_aturan.denda_per_hari,
    'boleh_diperpanjang',    v_alasan is null,
    'alasan_tidak_bisa_diperpanjang', v_alasan,
    'jatuh_tempo_jika_diperpanjang',  v_hari_ini + v_aturan.lama_pinjam_hari
  );
end;
$$;

-- =====================================================================
-- catat_pengembalian(nomor_induk_eksemplar, kondisi, status_denda, catatan)
-- AB-01, AB-06, AB-07, AB-08
-- =====================================================================
create or replace function public.catat_pengembalian(
  p_nomor_induk_eksemplar text,
  p_kondisi               public.kondisi_kembali,
  p_status_denda          public.status_denda default null,
  p_catatan               text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_petugas      uuid;
  v_no           text := lower(btrim(coalesce(p_nomor_induk_eksemplar, '')));
  v_eks          record;
  v_detail       record;
  v_denda_harian numeric(10,2);
  v_hari_ini     date := public.hari_ini_wib();
  v_terlambat    integer;
  v_denda        numeric(10,2);
  v_status_denda public.status_denda;
  v_catatan      text := nullif(btrim(coalesce(p_catatan, '')), '');
begin
  -- AB-01: hanya petugas
  v_petugas := public._wajib_petugas('mencatat pengembalian');

  if p_kondisi is null then
    raise exception 'Pilih kondisi buku saat kembali: baik, rusak, atau hilang.';
  end if;

  -- Kunci baris eksemplar
  select e.id_eksemplar, e.nomor_induk, b.judul
    into v_eks
    from public.eksemplar e
    join public.buku b on b.id_buku = e.id_buku
   where lower(e.nomor_induk) = v_no
     for update of e;
  if not found then
    raise exception 'Eksemplar dengan nomor induk "%" tidak ditemukan.', btrim(coalesce(p_nomor_induk_eksemplar, ''));
  end if;

  -- Cari pinjaman aktif untuk eksemplar ini
  select d.id_detail, d.tanggal_jatuh_tempo, a.jenis_anggota, pa.nama as nama_anggota
    into v_detail
    from public.detail_peminjaman d
    join public.peminjaman pj      on pj.id_peminjaman = d.id_peminjaman
    join public.anggota a          on a.id_anggota = pj.id_anggota
    join public.profil_pengguna pa on pa.id = a.id_pengguna
   where d.id_eksemplar = v_eks.id_eksemplar and d.status = 'dipinjam'
     for update of d;
  if not found then
    raise exception 'Eksemplar % ("%") tidak sedang dipinjam.', v_eks.nomor_induk, v_eks.judul;
  end if;

  -- AB-06: hari terlambat = tanggal kembali - jatuh tempo (hari kalender, minimal 0)
  v_terlambat := greatest(v_hari_ini - v_detail.tanggal_jatuh_tempo, 0);

  -- AB-07: denda = hari terlambat x denda per hari (boleh 0)
  select denda_per_hari into v_denda_harian
    from public.aturan_peminjaman where jenis_anggota = v_detail.jenis_anggota;
  v_denda := v_terlambat * coalesce(v_denda_harian, 0);

  if v_denda = 0 then
    v_status_denda := 'tidak_ada';
  else
    v_status_denda := coalesce(p_status_denda, 'belum_lunas');
    if v_status_denda = 'tidak_ada' then
      raise exception 'Ada denda sebesar Rp%. Pilih status denda: belum lunas atau lunas.', replace(to_char(v_denda, 'FM999,999,990'), ',', '.');
    end if;
  end if;

  update public.detail_peminjaman
     set tanggal_kembali    = now(),
         id_petugas_kembali = v_petugas,
         kondisi_kembali    = p_kondisi,
         hari_terlambat     = v_terlambat,
         denda              = v_denda,
         status_denda       = v_status_denda,
         status             = case when p_kondisi = 'hilang' then 'hilang' else 'dikembalikan' end::public.status_pinjaman,
         catatan_kembali    = v_catatan
   where id_detail = v_detail.id_detail;

  -- AB-08: status rusak/hilang hanya terjadi karena PILIHAN PETUGAS di sini
  update public.eksemplar
     set status = case p_kondisi
                    when 'baik'  then 'tersedia'
                    when 'rusak' then 'rusak'
                    else 'hilang'
                  end::public.status_eksemplar,
         keterangan = case when p_kondisi <> 'baik' and v_catatan is not null then v_catatan else keterangan end
   where id_eksemplar = v_eks.id_eksemplar;

  return jsonb_build_object(
    'id_detail',             v_detail.id_detail,
    'nama_anggota',          v_detail.nama_anggota,
    'judul',                 v_eks.judul,
    'nomor_induk_eksemplar', v_eks.nomor_induk,
    'kondisi',               p_kondisi,
    'hari_terlambat',        v_terlambat,
    'denda',                 v_denda,
    'status_denda',          v_status_denda,
    'pesan',                 format('Pengembalian "%s" oleh %s berhasil dicatat.', v_eks.judul, v_detail.nama_anggota)
  );
end;
$$;

-- =====================================================================
-- catat_perpanjangan(nomor_induk_eksemplar)
-- AB-01, AB-05
-- =====================================================================
create or replace function public.catat_perpanjangan(p_nomor_induk_eksemplar text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_no         text := lower(btrim(coalesce(p_nomor_induk_eksemplar, '')));
  v_eks        record;
  v_detail     record;
  v_aturan     public.aturan_peminjaman%rowtype;
  v_hari_ini   date := public.hari_ini_wib();
  v_tempo_baru date;
begin
  -- AB-01: hanya petugas
  perform public._wajib_petugas('mencatat perpanjangan');

  select e.id_eksemplar, e.nomor_induk, b.judul
    into v_eks
    from public.eksemplar e
    join public.buku b on b.id_buku = e.id_buku
   where lower(e.nomor_induk) = v_no
     for update of e;
  if not found then
    raise exception 'Eksemplar dengan nomor induk "%" tidak ditemukan.', btrim(coalesce(p_nomor_induk_eksemplar, ''));
  end if;

  select d.id_detail, d.tanggal_jatuh_tempo, d.jumlah_perpanjangan, a.jenis_anggota, pa.nama as nama_anggota
    into v_detail
    from public.detail_peminjaman d
    join public.peminjaman pj      on pj.id_peminjaman = d.id_peminjaman
    join public.anggota a          on a.id_anggota = pj.id_anggota
    join public.profil_pengguna pa on pa.id = a.id_pengguna
   where d.id_eksemplar = v_eks.id_eksemplar and d.status = 'dipinjam'
     for update of d;
  if not found then
    raise exception 'Eksemplar % ("%") tidak sedang dipinjam.', v_eks.nomor_induk, v_eks.judul;
  end if;

  -- AB-05 (a): belum terlambat
  if v_detail.tanggal_jatuh_tempo < v_hari_ini then
    raise exception 'Perpanjangan ditolak: pinjaman sudah terlambat % hari. Buku harus dikembalikan.',
      v_hari_ini - v_detail.tanggal_jatuh_tempo;
  end if;

  select * into v_aturan from public.aturan_peminjaman where jenis_anggota = v_detail.jenis_anggota;
  if not found then
    raise exception 'Aturan peminjaman untuk % belum diatur. Lengkapi di menu Pengaturan.', v_detail.jenis_anggota;
  end if;

  -- AB-05 (b): belum mencapai batas perpanjangan
  if v_detail.jumlah_perpanjangan >= v_aturan.maks_perpanjangan then
    raise exception 'Perpanjangan ditolak: batas perpanjangan sudah tercapai (% dari % kali).',
      v_detail.jumlah_perpanjangan, v_aturan.maks_perpanjangan;
  end if;

  -- AB-05 (c): jatuh tempo baru = tanggal perpanjangan + lama pinjam
  v_tempo_baru := v_hari_ini + v_aturan.lama_pinjam_hari;

  update public.detail_peminjaman
     set tanggal_jatuh_tempo = v_tempo_baru,
         jumlah_perpanjangan = jumlah_perpanjangan + 1
   where id_detail = v_detail.id_detail;

  return jsonb_build_object(
    'id_detail',             v_detail.id_detail,
    'nama_anggota',          v_detail.nama_anggota,
    'judul',                 v_eks.judul,
    'nomor_induk_eksemplar', v_eks.nomor_induk,
    'jatuh_tempo_lama',      v_detail.tanggal_jatuh_tempo,
    'jatuh_tempo_baru',      v_tempo_baru,
    'jumlah_perpanjangan',   v_detail.jumlah_perpanjangan + 1,
    'pesan',                 format('Pinjaman "%s" diperpanjang sampai %s.', v_eks.judul, to_char(v_tempo_baru, 'DD/MM/YYYY'))
  );
end;
$$;

-- ---------- Hak memanggil fungsi ----------
-- Cabut dari semua, lalu beri hanya ke pengguna login. Di dalam fungsi tetap
-- diperiksa bahwa pemanggil adalah petugas, jadi anggota yang mencoba akan ditolak.
revoke all on function
  public._wajib_petugas(text),
  public.cek_kelayakan_anggota(text),
  public.catat_peminjaman(text, text[]),
  public.cari_pinjaman_aktif(text),
  public.catat_pengembalian(text, public.kondisi_kembali, public.status_denda, text),
  public.catat_perpanjangan(text)
from public, anon, authenticated;

grant execute on function
  public.cek_kelayakan_anggota(text),
  public.catat_peminjaman(text, text[]),
  public.cari_pinjaman_aktif(text),
  public.catat_pengembalian(text, public.kondisi_kembali, public.status_denda, text),
  public.catat_perpanjangan(text)
to authenticated, service_role;

-- >>>>>>>>>> 20261114000006_denda_dan_blokir_login.sql <<<<<<<<<<

-- =====================================================================
-- SIMPUS - Migrasi 6
--   (a) Keputusan sekolah: denda keterlambatan Rp1.000 per hari
--   (b) Fungsi tandai_denda_lunas: petugas menandai denda yang sudah dibayar
--   (c) Akun anggota nonaktif diblokir login langsung dari database (AB-10)
-- =====================================================================

-- ---------- (a) Denda Rp1.000 per hari ----------
-- Berlaku untuk siswa dan guru. Tetap bisa diubah petugas di menu Pengaturan.
update public.aturan_peminjaman set denda_per_hari = 1000;

-- ---------- (b) Menandai denda lunas ----------
-- Hanya mencatat bahwa denda sudah dibayar di meja petugas.
-- (Tidak ada pembayaran online; itu di luar cakupan.)
create or replace function public.tandai_denda_lunas(p_id_detail integer)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v record;
begin
  perform public._wajib_petugas('menandai denda lunas');

  select d.id_detail, d.denda, d.status_denda, d.status, pa.nama as nama_anggota, b.judul
    into v
    from public.detail_peminjaman d
    join public.peminjaman pj      on pj.id_peminjaman = d.id_peminjaman
    join public.anggota a          on a.id_anggota = pj.id_anggota
    join public.profil_pengguna pa on pa.id = a.id_pengguna
    join public.eksemplar e        on e.id_eksemplar = d.id_eksemplar
    join public.buku b             on b.id_buku = e.id_buku
   where d.id_detail = p_id_detail
     for update of d;

  if not found then
    raise exception 'Data pinjaman tidak ditemukan.';
  end if;
  if v.status_denda = 'lunas' then
    raise exception 'Denda untuk "%" sudah berstatus lunas.', v.judul;
  end if;
  if v.status_denda <> 'belum_lunas' then
    raise exception 'Pinjaman "%" tidak memiliki denda.', v.judul;
  end if;

  update public.detail_peminjaman set status_denda = 'lunas' where id_detail = p_id_detail;

  return jsonb_build_object(
    'id_detail',    v.id_detail,
    'nama_anggota', v.nama_anggota,
    'judul',        v.judul,
    'denda',        v.denda,
    'status_denda', 'lunas',
    'pesan',        format('Denda %s untuk "%s" ditandai lunas.', v.nama_anggota, v.judul)
  );
end;
$$;

revoke all on function public.tandai_denda_lunas(integer) from public, anon, authenticated;
grant execute on function public.tandai_denda_lunas(integer) to authenticated, service_role;

-- ---------- (c) Akun nonaktif tidak bisa login ----------
-- Trigger yang sudah ada (menyamakan status akun dengan status anggota) diperluas:
-- saat anggota dinonaktifkan, akun login-nya di Supabase Auth ikut diblokir;
-- saat diaktifkan kembali, blokirnya dicabut.
create or replace function public.trg_samakan_status_akun()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.profil_pengguna
     set status = new.status_anggota
   where id = new.id_pengguna
     and status is distinct from new.status_anggota;

  update auth.users
     set banned_until = case when new.status_anggota = 'nonaktif'
                             then timestamptz '2999-12-31 00:00:00+00'
                        end
   where id = new.id_pengguna;

  return new;
end;
$$;

-- Fungsi trigger tidak untuk dipanggil langsung
revoke all on function public.trg_samakan_status_akun() from public, anon, authenticated;

-- Terapkan ke anggota yang sudah nonaktif sebelum migrasi ini
update auth.users
   set banned_until = timestamptz '2999-12-31 00:00:00+00'
 where id in (select id_pengguna from public.anggota where status_anggota = 'nonaktif');

-- >>>>>>>>>> 20261114000007_view_anggota_dan_sampul.sql <<<<<<<<<<

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

-- >>>>>>>>>> 20261114000008_nama_petugas_di_pinjaman.sql <<<<<<<<<<

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

commit;

select 'Struktur database SIMPUS berhasil dipasang' as hasil;
