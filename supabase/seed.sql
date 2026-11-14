-- =====================================================================
-- SIMPUS - DATA CONTOH (seed) untuk uji coba
--
-- SEMUA NAMA DAN NOMOR DI SINI KARANGAN, bukan data siswa/guru asli.
-- Jalankan SEKALI setelah semua file migrasi. Tanggal pinjaman dibuat relatif
-- terhadap hari ini, sehingga selalu ada pinjaman yang terlambat.
--
-- Akun contoh (kata sandi awal = username, wajib diganti saat login pertama):
--   Petugas : PTG001
--   Siswa   : 240001, 240002, 240003, 230004, 230005, 220006, 220007 (nonaktif)
--   Guru    : 198501012010011001, 199003152015032002, 197811202005011003
-- =====================================================================

begin;

do $$
begin
  if exists (select 1 from public.profil_pengguna) then
    raise exception 'Seed dibatalkan: tabel profil_pengguna sudah berisi data. Seed hanya untuk database yang masih kosong.';
  end if;
end $$;

-- ---------- Fungsi bantu sementara (dihapus lagi di akhir file) ----------

-- Membuat akun login (Supabase Auth) + profil. Kata sandi awal = username.
create function public._seed_pengguna(p_username text, p_nama text, p_role public.peran_pengguna)
returns uuid
language plpgsql
as $$
declare
  v_id    uuid := gen_random_uuid();
  v_email text := lower(p_username) || '@simpus.local';
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
    extensions.crypt(p_username, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
    '', '', '', ''
  );

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (
    gen_random_uuid(), v_id, v_id::text,
    jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
    'email', now(), now(), now()
  );

  insert into public.profil_pengguna (id, nama, username, role, status, wajib_ganti_password)
  values (v_id, p_nama, p_username, p_role, 'aktif', true);

  return v_id;
end;
$$;

create function public._seed_anggota(
  p_nomor_induk text, p_nama text, p_jenis public.jenis_anggota,
  p_kelas text, p_jk public.jenis_kelamin, p_no_hp text
) returns void
language plpgsql
as $$
begin
  insert into public.anggota (id_pengguna, nomor_induk, jenis_anggota, kelas, jenis_kelamin, no_hp)
  values (public._seed_pengguna(p_nomor_induk, p_nama, 'anggota'), p_nomor_induk, p_jenis, p_kelas, p_jk, p_no_hp);
end;
$$;

-- Mencatat pinjaman "p_hari_lalu" hari yang lalu dengan lama pinjam "p_lama" hari
create function public._seed_pinjam(p_nomor_induk_anggota text, p_eksemplar text[], p_hari_lalu int, p_lama int)
returns void
language plpgsql
as $$
declare
  v_id int;
begin
  insert into public.peminjaman (id_anggota, id_petugas, tanggal_pinjam)
  values (
    (select id_anggota from public.anggota where nomor_induk = p_nomor_induk_anggota),
    (select id from public.profil_pengguna where username = 'PTG001'),
    now() - make_interval(days => p_hari_lalu)
  ) returning id_peminjaman into v_id;

  insert into public.detail_peminjaman (id_peminjaman, id_eksemplar, tanggal_jatuh_tempo)
  select v_id, e.id_eksemplar, public.hari_ini_wib() - p_hari_lalu + p_lama
    from public.eksemplar e where e.nomor_induk = any (p_eksemplar);

  update public.eksemplar set status = 'dipinjam' where nomor_induk = any (p_eksemplar);
end;
$$;

-- Mencatat pengembalian "p_hari_lalu" hari yang lalu
create function public._seed_kembali(p_eksemplar text, p_hari_lalu int, p_kondisi public.kondisi_kembali, p_catatan text default null)
returns void
language plpgsql
as $$
begin
  update public.detail_peminjaman d
     set tanggal_kembali    = now() - make_interval(days => p_hari_lalu),
         id_petugas_kembali = (select id from public.profil_pengguna where username = 'PTG001'),
         kondisi_kembali    = p_kondisi,
         hari_terlambat     = greatest((public.hari_ini_wib() - p_hari_lalu) - d.tanggal_jatuh_tempo, 0),
         status             = case when p_kondisi = 'hilang' then 'hilang' else 'dikembalikan' end::public.status_pinjaman,
         catatan_kembali    = p_catatan
   where d.status = 'dipinjam'
     and d.id_eksemplar = (select id_eksemplar from public.eksemplar where nomor_induk = p_eksemplar);

  update public.eksemplar
     set status = case p_kondisi when 'baik' then 'tersedia' when 'rusak' then 'rusak' else 'hilang' end::public.status_eksemplar,
         keterangan = coalesce(p_catatan, keterangan)
   where nomor_induk = p_eksemplar;
end;
$$;

-- ---------- 1 petugas ----------
select public._seed_pengguna('PTG001', 'Petugas Perpustakaan', 'petugas');

-- ---------- 10 anggota (7 siswa, 3 guru) ----------
select public._seed_anggota('240001', 'Andi Pratama',     'siswa', '7A', 'L', '081200000001');
select public._seed_anggota('240002', 'Bunga Lestari',    'siswa', '7A', 'P', '081200000002');
select public._seed_anggota('240003', 'Cahyo Nugroho',    'siswa', '7B', 'L', '081200000003');
select public._seed_anggota('230004', 'Dewi Anggraini',   'siswa', '8A', 'P', '081200000004');
select public._seed_anggota('230005', 'Eko Saputra',      'siswa', '8B', 'L', '081200000005');
select public._seed_anggota('220006', 'Fitri Handayani',  'siswa', '9A', 'P', '081200000006');
select public._seed_anggota('220007', 'Gilang Ramadhan',  'siswa', '9B', 'L', '081200000007');
select public._seed_anggota('198501012010011001', 'Hendra Wijaya, S.Pd.',     'guru', null, 'L', '081300000001');
select public._seed_anggota('199003152015032002', 'Indah Permatasari, S.Pd.', 'guru', null, 'P', '081300000002');
select public._seed_anggota('197811202005011003', 'Joko Susilo, M.Pd.',       'guru', null, 'L', '081300000003');

-- ---------- 6 kategori ----------
insert into public.kategori (nama_kategori, keterangan) values
  ('Buku Pelajaran',    'Buku teks pelajaran sesuai kurikulum'),
  ('Fiksi',             'Novel, cerpen, dan dongeng'),
  ('Nonfiksi',          'Biografi, sejarah, dan pengembangan diri'),
  ('Agama',             'Buku keagamaan'),
  ('Sains & Teknologi', 'Ilmu pengetahuan alam dan teknologi'),
  ('Referensi',         'Kamus, ensiklopedia, atlas - hanya dibaca di tempat');

-- ---------- 30 buku ----------
-- Kolom terakhir (urut) dipakai untuk mengatur tanggal_input: makin besar makin baru.
insert into public.buku (id_kategori, isbn, judul, pengarang, penerbit, tahun_terbit, lokasi_rak, sinopsis, dapat_dipinjam, tanggal_input)
select k.id_kategori, v.isbn, v.judul, v.pengarang, v.penerbit, v.tahun, v.rak, v.sinopsis, v.dapat,
       now() - make_interval(days => (31 - v.urut) * 3)
from (values
  ( 1, 'Buku Pelajaran', null, 'Matematika SMP/MTs Kelas VII',            'Tim Penyusun', 'Pusat Perbukuan', 2021, 'A-01', 'Buku teks matematika kelas VII: bilangan, aljabar, dan geometri dasar.', true),
  ( 2, 'Buku Pelajaran', null, 'Bahasa Indonesia SMP/MTs Kelas VII',      'Tim Penyusun', 'Pusat Perbukuan', 2021, 'A-01', 'Buku teks Bahasa Indonesia kelas VII.', true),
  ( 3, 'Buku Pelajaran', null, 'Ilmu Pengetahuan Alam SMP/MTs Kelas VIII','Tim Penyusun', 'Pusat Perbukuan', 2021, 'A-02', 'Buku teks IPA kelas VIII.', true),
  ( 4, 'Buku Pelajaran', null, 'Ilmu Pengetahuan Sosial SMP/MTs Kelas VIII','Tim Penyusun','Pusat Perbukuan', 2021, 'A-02', 'Buku teks IPS kelas VIII.', true),
  ( 5, 'Buku Pelajaran', null, 'Bahasa Inggris SMP/MTs Kelas IX',         'Tim Penyusun', 'Pusat Perbukuan', 2022, 'A-03', 'Buku teks Bahasa Inggris kelas IX.', true),
  ( 6, 'Buku Pelajaran', null, 'Pendidikan Pancasila SMP/MTs Kelas IX',   'Tim Penyusun', 'Pusat Perbukuan', 2022, 'A-03', 'Buku teks Pendidikan Pancasila kelas IX.', true),
  ( 7, 'Buku Pelajaran', null, 'Informatika SMP/MTs Kelas VII',           'Tim Penyusun', 'Pusat Perbukuan', 2021, 'A-04', 'Pengantar berpikir komputasional dan teknologi informasi.', true),
  ( 8, 'Fiksi', '9789793062792', 'Laskar Pelangi',        'Andrea Hirata',          'Bentang Pustaka',          2005, 'B-01', 'Kisah sepuluh anak Belitung yang berjuang untuk tetap bersekolah.', true),
  ( 9, 'Fiksi', null,            'Sang Pemimpi',          'Andrea Hirata',          'Bentang Pustaka',          2006, 'B-01', 'Lanjutan Laskar Pelangi tentang mimpi merantau dan bersekolah tinggi.', true),
  (10, 'Fiksi', null,            'Bumi Manusia',          'Pramoedya Ananta Toer',  'Lentera Dipantara',        2005, 'B-02', 'Kisah Minke pada masa kolonial Hindia Belanda.', true),
  (11, 'Fiksi', null,            'Negeri 5 Menara',       'Ahmad Fuadi',            'Gramedia Pustaka Utama',   2009, 'B-02', 'Persahabatan enam santri dengan mimpi besar.', true),
  (12, 'Fiksi', null,            'Hujan',                 'Tere Liye',              'Gramedia Pustaka Utama',   2016, 'B-03', 'Kisah tentang persahabatan, cinta, dan melupakan.', true),
  (13, 'Fiksi', null,            'Bumi',                  'Tere Liye',              'Gramedia Pustaka Utama',   2014, 'B-03', 'Petualangan Raib, Seli, dan Ali di dunia paralel.', true),
  (14, 'Fiksi', null,            'Ronggeng Dukuh Paruk',  'Ahmad Tohari',           'Gramedia Pustaka Utama',   1982, 'B-04', 'Kehidupan seorang ronggeng di dukuh kecil.', true),
  (15, 'Fiksi', null,            'Kumpulan Dongeng Nusantara', 'Tim Penyusun',      'Balai Pustaka',            2018, 'B-04', 'Kumpulan cerita rakyat dari berbagai daerah di Indonesia.', true),
  (16, 'Nonfiksi', null, 'Habibie & Ainun',            'B.J. Habibie',        'THC Mandiri',                2010, 'C-01', 'Kisah hidup B.J. Habibie bersama istrinya.', true),
  (17, 'Nonfiksi', null, 'Sejarah Indonesia Modern',   'M.C. Ricklefs',       'Gadjah Mada University Press', 2005, 'C-01', 'Sejarah Indonesia sejak kedatangan Islam hingga masa modern.', true),
  (18, 'Nonfiksi', null, 'Filosofi Teras',             'Henry Manampiring',   'Penerbit Buku Kompas',       2018, 'C-02', 'Pengantar filsafat Stoa untuk kehidupan sehari-hari.', true),
  (19, 'Nonfiksi', null, 'Kiat Belajar Efektif untuk Pelajar', 'Tim Penyusun', 'Balai Pustaka',             2020, 'C-02', 'Tips mengatur waktu dan cara belajar.', true),
  (20, 'Agama', null, 'Pendidikan Agama Islam dan Budi Pekerti Kelas VII', 'Tim Penyusun', 'Pusat Perbukuan', 2021, 'D-01', 'Buku teks PAI kelas VII.', true),
  (21, 'Agama', null, 'Kisah 25 Nabi dan Rasul',       'Tim Penyusun',        'Balai Pustaka',              2017, 'D-01', 'Kisah teladan para nabi dan rasul.', true),
  (22, 'Agama', null, 'Fiqih Islam',                   'Sulaiman Rasjid',     'Sinar Baru Algensindo',      2012, 'D-02', 'Pembahasan hukum fikih Islam secara lengkap.', true),
  (23, 'Agama', null, 'Sirah Nabawiyah',               'Shafiyyurrahman Al-Mubarakfuri', 'Pustaka Al-Kautsar', 2008, 'D-02', 'Sejarah hidup Nabi Muhammad saw.', true),
  (24, 'Sains & Teknologi', null, 'Mengenal Tata Surya',               'Tim Penyusun', 'Balai Pustaka', 2019, 'E-01', 'Pengenalan planet, bintang, dan benda langit.', true),
  (25, 'Sains & Teknologi', null, 'Tubuh Manusia: Panduan Bergambar',  'Tim Penyusun', 'Balai Pustaka', 2019, 'E-01', 'Penjelasan bergambar tentang sistem organ manusia.', true),
  (26, 'Sains & Teknologi', null, 'Dasar-Dasar Pemrograman untuk Pemula', 'Tim Penyusun', 'Balai Pustaka', 2022, 'E-02', 'Belajar logika pemrograman langkah demi langkah.', true),
  (27, 'Referensi', null, 'Kamus Besar Bahasa Indonesia Edisi Kelima', 'Badan Pengembangan dan Pembinaan Bahasa', 'Balai Pustaka', 2016, 'R-01', 'Kamus resmi bahasa Indonesia.', false),
  (28, 'Referensi', null, 'Kamus Inggris-Indonesia',  'John M. Echols & Hassan Shadily', 'Gramedia Pustaka Utama', 2014, 'R-01', 'Kamus dwibahasa Inggris-Indonesia.', false),
  (29, 'Referensi', null, 'Ensiklopedia Sains untuk Pelajar', 'Tim Penyusun', 'Balai Pustaka', 2015, 'R-02', 'Ensiklopedia bergambar ilmu pengetahuan.', false),
  (30, 'Referensi', null, 'Atlas Indonesia dan Dunia', 'Tim Penyusun', 'Balai Pustaka', 2020, 'R-02', 'Peta wilayah Indonesia dan dunia.', false)
) as v(urut, kategori, isbn, judul, pengarang, penerbit, tahun, rak, sinopsis, dapat)
join public.kategori k on k.nama_kategori = v.kategori
order by v.urut;

-- ---------- Eksemplar: 1 sampai 3 buku fisik per judul (total 60) ----------
-- Nomor induk: B0001, B0002, ... berurutan sesuai urutan judul di atas.
do $$
declare
  r       record;
  v_no    int := 0;
  v_jml   int;
  i       int;
  v_urut  int := 0;
begin
  for r in select id_buku from public.buku order by tanggal_input, id_buku loop
    v_urut := v_urut + 1;
    v_jml  := case v_urut % 3 when 1 then 3 when 2 then 2 else 1 end;
    for i in 1 .. v_jml loop
      v_no := v_no + 1;
      insert into public.eksemplar (id_buku, nomor_induk, sumber_perolehan, tanggal_masuk)
      values (
        r.id_buku,
        'B' || lpad(v_no::text, 4, '0'),
        case v_no % 3 when 0 then 'Hibah' when 1 then 'Pembelian' else 'Dana BOS' end,
        public.hari_ini_wib() - (31 - v_urut) * 3
      );
    end loop;
  end loop;
end $$;

-- Daftar nomor induk per judul (hasil blok di atas):
--  1 Matematika VII      B0001-B0003 | 11 Negeri 5 Menara   B0022-B0023 | 21 Kisah 25 Nabi   B0042
--  2 B. Indonesia VII    B0004-B0005 | 12 Hujan             B0024       | 22 Fiqih Islam     B0043-B0045
--  3 IPA VIII            B0006       | 13 Bumi              B0025-B0027 | 23 Sirah Nabawiyah B0046-B0047
--  4 IPS VIII            B0007-B0009 | 14 Ronggeng D.P.     B0028-B0029 | 24 Tata Surya      B0048
--  5 B. Inggris IX       B0010-B0011 | 15 Dongeng Nusantara B0030       | 25 Tubuh Manusia   B0049-B0051
--  6 Pend. Pancasila IX  B0012       | 16 Habibie & Ainun   B0031-B0033 | 26 Pemrograman     B0052-B0053
--  7 Informatika VII     B0013-B0015 | 17 Sejarah Indonesia B0034-B0035 | 27 KBBI            B0054
--  8 Laskar Pelangi      B0016-B0017 | 18 Filosofi Teras    B0036       | 28 Kamus Inggris   B0055-B0057
--  9 Sang Pemimpi        B0018       | 19 Kiat Belajar      B0037-B0039 | 29 Ensiklopedia    B0058-B0059
-- 10 Bumi Manusia        B0019-B0021 | 20 PAI VII           B0040-B0041 | 30 Atlas           B0060

-- ---------- Riwayat: pinjaman yang sudah dikembalikan ----------
-- _seed_pinjam (anggota, eksemplar, dipinjam N hari lalu, lama pinjam)
-- _seed_kembali(eksemplar, dikembalikan N hari lalu, kondisi)
select public._seed_pinjam('220007', array['B0016'], 60, 7);              -- Gilang (sekarang nonaktif)
select public._seed_kembali('B0016', 55, 'baik');

select public._seed_pinjam('197811202005011003', array['B0034'], 50, 14); -- Pak Joko, kembali rusak
select public._seed_kembali('B0034', 40, 'rusak', 'Sampul sobek dan beberapa halaman lepas');

select public._seed_pinjam('220006', array['B0022'], 40, 7);              -- Fitri, terlambat 3 hari
select public._seed_kembali('B0022', 30, 'baik');

select public._seed_pinjam('230004', array['B0024'], 30, 7);              -- Dewi, tepat waktu
select public._seed_kembali('B0024', 25, 'baik');

select public._seed_pinjam('240001', array['B0025', 'B0030'], 20, 7);     -- Andi, 2 buku
select public._seed_kembali('B0025', 15, 'baik');
select public._seed_kembali('B0030', 14, 'baik');

-- ---------- Pinjaman aktif yang TERLAMBAT ----------
select public._seed_pinjam('230005', array['B0019'], 45, 7);              -- Eko: terlambat 38 hari (> 30 hari)
select public._seed_pinjam('240003', array['B0048'], 12, 7);              -- Cahyo: terlambat 5 hari
select public._seed_pinjam('199003152015032002', array['B0043'], 20, 14); -- Bu Indah: terlambat 6 hari

-- ---------- Pinjaman aktif yang belum terlambat ----------
select public._seed_pinjam('220006', array['B0036'], 7, 7);               -- Fitri: jatuh tempo HARI INI
select public._seed_pinjam('240002', array['B0017', 'B0026'], 6, 7);      -- Bunga: jatuh tempo besok (batas 2 buku tercapai)
select public._seed_pinjam('240001', array['B0018'], 3, 7);               -- Andi: jatuh tempo 4 hari lagi
select public._seed_pinjam('198501012010011001', array['B0031', 'B0046', 'B0052'], 2, 14); -- Pak Hendra: 3 buku
select public._seed_pinjam('230004', array['B0049'], 0, 7);               -- Dewi: dipinjam hari ini

-- Pak Hendra: 1 buku lagi yang sudah diperpanjang 1 kali (pinjam 16 hari lalu, diperpanjang 4 hari lalu)
select public._seed_pinjam('198501012010011001', array['B0035'], 16, 14);
update public.detail_peminjaman d
   set tanggal_jatuh_tempo = public.hari_ini_wib() - 4 + 14,
       jumlah_perpanjangan = 1
 where d.status = 'dipinjam'
   and d.id_eksemplar = (select id_eksemplar from public.eksemplar where nomor_induk = 'B0035');

-- ---------- Eksemplar yang ditandai petugas ----------
update public.eksemplar set status = 'hilang', keterangan = 'Tidak ditemukan saat pengecekan rak'
 where nomor_induk = 'B0009';
update public.eksemplar set status = 'rusak', keterangan = 'Terkena air, perlu diperbaiki'
 where nomor_induk = 'B0039';

-- ---------- Anggota yang sudah pindah: dinonaktifkan, riwayat tetap ada (AB-10) ----------
update public.anggota set status_anggota = 'nonaktif' where nomor_induk = '220007';

-- ---------- Hapus fungsi bantu sementara ----------
drop function public._seed_kembali(text, int, public.kondisi_kembali, text);
drop function public._seed_pinjam(text, text[], int, int);
drop function public._seed_anggota(text, text, public.jenis_anggota, text, public.jenis_kelamin, text);
drop function public._seed_pengguna(text, text, public.peran_pengguna);

commit;

-- Ringkasan hasil (tampil setelah seed selesai)
select
  (select count(*) from public.profil_pengguna where role = 'petugas')            as petugas,
  (select count(*) from public.anggota)                                           as anggota,
  (select count(*) from public.kategori)                                          as kategori,
  (select count(*) from public.buku)                                              as buku,
  (select count(*) from public.eksemplar)                                         as eksemplar,
  (select count(*) from public.detail_peminjaman where status = 'dipinjam')       as pinjaman_aktif,
  (select count(*) from public.v_keterlambatan)                                   as pinjaman_terlambat;
