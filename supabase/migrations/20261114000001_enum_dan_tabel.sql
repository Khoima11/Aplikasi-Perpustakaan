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
