-- =====================================================================
-- SIMPUS - SKRIP UJI ATURAN BISNIS AB-01 s.d. AB-10 (+ uji keamanan RLS)
--
-- Cara pakai: tempel SELURUH isi file ini di Supabase > SQL Editor > Run.
-- Hasilnya berupa tabel: setiap baris satu uji, kolom "hasil" berisi LULUS/GAGAL.
-- Jika muncul peringatan RLS untuk tabel "hasil_uji", pilih "Run without RLS"
-- (itu hanya tabel sementara penampung hasil uji).
-- Baris terakhir adalah RINGKASAN.
--
-- AMAN DIJALANKAN KAPAN SAJA: skrip membuat data uji sendiri (berawalan "UJI-"),
-- lalu MEMBATALKAN semua perubahannya di akhir. Data asli tidak berubah.
--
-- Cara kerja: setiap uji dijalankan "sebagai" pengguna tertentu (anon / anggota /
-- petugas) persis seperti saat diakses dari aplikasi, lalu hasilnya diperiksa.
-- =====================================================================

drop table if exists hasil_uji;
create temp table hasil_uji (no serial, kode text, uji text, hasil text, keterangan text);

-- Menjalankan p_sql sebagai pengguna p_uid. Hasil: 'OK:<nilai>' atau 'DITOLAK:<pesan>'
create or replace function pg_temp.sebagai(p_uid uuid, p_sql text)
returns text
language plpgsql
as $$
declare
  v_asal  text := current_user;
  v_hasil text;
begin
  begin
    perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), true);
    perform set_config('request.jwt.claims',
      case when p_uid is null then '{"role":"anon"}'
           else json_build_object('sub', p_uid, 'role', 'authenticated')::text end, true);
    if p_uid is null then
      set local role anon;
    else
      set local role authenticated;
    end if;
    execute p_sql into v_hasil;
    execute format('set local role %I', v_asal);
    return 'OK:' || coalesce(v_hasil, '');
  exception when others then
    -- kegagalan membatalkan perubahan pernyataan itu dan mengembalikan role semula
    return 'DITOLAK:' || sqlerrm;
  end;
end;
$$;

create or replace function pg_temp.cek(p_kode text, p_uji text, p_lulus boolean, p_keterangan text default '')
returns jsonb
language sql
as $$
  select jsonb_build_array(jsonb_build_object(
    'kode', p_kode, 'uji', p_uji,
    'hasil', case when coalesce(p_lulus, false) then 'LULUS' else 'GAGAL' end,
    'keterangan', coalesce(p_keterangan, '')));
$$;

do $uji$
declare
  h          jsonb := '[]'::jsonb;      -- kumpulan hasil uji (tetap ada walau data dibatalkan)
  r          text;
  t          date;                      -- hari ini (WIB)
  u_petugas  uuid := gen_random_uuid();
  u_s1       uuid := gen_random_uuid(); -- siswa 1
  u_s2       uuid := gen_random_uuid(); -- siswa 2
  u_s3       uuid := gen_random_uuid(); -- siswa nonaktif
  u_g1       uuid := gen_random_uuid(); -- guru
  v_kat      int;
  v_b1       int;
  v_b2       int;
  d          record;
  v_n        int;
  v_tempo    date;
  v_teks     text;
begin
  begin
    t := public.hari_ini_wib();

    -- ================= PERSIAPAN DATA UJI (dibatalkan di akhir) =================
    insert into auth.users (id, aud, role, email)
    select x, 'authenticated', 'authenticated', 'uji-' || x || '@uji.local'
      from unnest(array[u_petugas, u_s1, u_s2, u_s3, u_g1]) as x;

    insert into public.profil_pengguna (id, nama, username, role) values
      (u_petugas, 'UJI Petugas', 'UJI-PTG', 'petugas'),
      (u_s1, 'UJI Siswa Satu',     'UJI-S1', 'anggota'),
      (u_s2, 'UJI Siswa Dua',      'UJI-S2', 'anggota'),
      (u_s3, 'UJI Siswa Nonaktif', 'UJI-S3', 'anggota'),
      (u_g1, 'UJI Guru Satu',      'UJI-G1', 'anggota');

    insert into public.anggota (id_pengguna, nomor_induk, jenis_anggota, kelas, status_anggota) values
      (u_s1, 'UJI-S1', 'siswa', '7A', 'aktif'),
      (u_s2, 'UJI-S2', 'siswa', '7B', 'aktif'),
      (u_s3, 'UJI-S3', 'siswa', '9A', 'nonaktif'),
      (u_g1, 'UJI-G1', 'guru',  null, 'aktif');

    insert into public.kategori (nama_kategori) values ('UJI Kategori') returning id_kategori into v_kat;
    insert into public.buku (id_kategori, judul, dapat_dipinjam) values (v_kat, 'UJI Buku Biasa', true)
      returning id_buku into v_b1;
    insert into public.buku (id_kategori, judul, dapat_dipinjam) values (v_kat, 'UJI Buku Referensi', false)
      returning id_buku into v_b2;
    insert into public.eksemplar (id_buku, nomor_induk)
      select v_b1, 'UJI-E' || g from generate_series(1, 8) g;
    insert into public.eksemplar (id_buku, nomor_induk) values (v_b2, 'UJI-R1');
    insert into public.eksemplar (id_buku, nomor_induk, status) values (v_b1, 'UJI-X1', 'rusak');

    -- Aturan dibuat pasti agar uji tidak bergantung pada pengaturan saat ini
    update public.aturan_peminjaman set maks_pinjam = 2, lama_pinjam_hari = 7,  maks_perpanjangan = 1, denda_per_hari = 0 where jenis_anggota = 'siswa';
    update public.aturan_peminjaman set maks_pinjam = 5, lama_pinjam_hari = 14, maks_perpanjangan = 1, denda_per_hari = 0 where jenis_anggota = 'guru';

    -- ================= AB-01: hanya petugas yang mencatat transaksi =================
    r := pg_temp.sebagai(null, $q$select public.catat_peminjaman('UJI-S1', array['UJI-E1'])$q$);
    h := h || pg_temp.cek('AB-01', 'Tanpa login memanggil catat_peminjaman -> ditolak', r like 'DITOLAK:%', r);

    r := pg_temp.sebagai(u_s1, $q$select public.catat_peminjaman('UJI-S1', array['UJI-E1'])$q$);
    h := h || pg_temp.cek('AB-01', 'Anggota memanggil catat_peminjaman -> ditolak', r like 'DITOLAK:Hanya petugas%', r);

    r := pg_temp.sebagai(u_s1, $q$select public.catat_pengembalian('UJI-E1', 'baik')$q$);
    h := h || pg_temp.cek('AB-01', 'Anggota memanggil catat_pengembalian -> ditolak', r like 'DITOLAK:Hanya petugas%', r);

    r := pg_temp.sebagai(u_s1, $q$select public.catat_perpanjangan('UJI-E1')$q$);
    h := h || pg_temp.cek('AB-01', 'Anggota memanggil catat_perpanjangan -> ditolak', r like 'DITOLAK:Hanya petugas%', r);

    r := pg_temp.sebagai(u_s1, format($q$insert into public.peminjaman (id_anggota, id_petugas) select id_anggota, %L from public.anggota where nomor_induk = 'UJI-S1'$q$, u_s1));
    h := h || pg_temp.cek('AB-01', 'Anggota menulis langsung ke tabel peminjaman -> ditolak', r like 'DITOLAK:%', r);

    r := pg_temp.sebagai(u_petugas, $q$update public.detail_peminjaman set tanggal_jatuh_tempo = tanggal_jatuh_tempo + 30$q$);
    h := h || pg_temp.cek('AB-01', 'Petugas pun tidak bisa mengubah tabel detail_peminjaman langsung (harus lewat fungsi)', r like 'DITOLAK:%', r);

    r := pg_temp.sebagai(u_petugas, $q$select public.catat_peminjaman('UJI-S1', array['UJI-E1'])$q$);
    h := h || pg_temp.cek('AB-01', 'Petugas memanggil catat_peminjaman -> berhasil', r like 'OK:%', r);

    -- ================= AB-04: jatuh tempo dihitung per jenis anggota dan disimpan =================
    select dp.tanggal_jatuh_tempo, e.status into d
      from public.detail_peminjaman dp join public.eksemplar e using (id_eksemplar)
     where e.nomor_induk = 'UJI-E1' and dp.status = 'dipinjam';
    h := h || pg_temp.cek('AB-04', 'Siswa: jatuh tempo tersimpan = hari ini + 7 hari', d.tanggal_jatuh_tempo = t + 7,
                          format('hari ini %s, jatuh tempo %s', t, d.tanggal_jatuh_tempo));
    h := h || pg_temp.cek('AB-04', 'Status eksemplar otomatis menjadi "dipinjam"', d.status = 'dipinjam', d.status::text);

    r := pg_temp.sebagai(u_petugas, $q$select public.catat_peminjaman('UJI-G1', array['UJI-E5'])$q$);
    select dp.tanggal_jatuh_tempo into v_tempo
      from public.detail_peminjaman dp join public.eksemplar e using (id_eksemplar)
     where e.nomor_induk = 'UJI-E5' and dp.status = 'dipinjam';
    h := h || pg_temp.cek('AB-04', 'Guru: jatuh tempo tersimpan = hari ini + 14 hari', v_tempo = t + 14,
                          format('hari ini %s, jatuh tempo %s', t, v_tempo));

    -- ================= AB-02: syarat anggota boleh meminjam =================
    r := pg_temp.sebagai(u_petugas, $q$select public.catat_peminjaman('UJI-S3', array['UJI-E2'])$q$);
    h := h || pg_temp.cek('AB-02', 'Anggota nonaktif -> ditolak', r like 'DITOLAK:%nonaktif%', r);

    r := pg_temp.sebagai(u_petugas, $q$select public.catat_peminjaman('UJI-S1', array['UJI-E2', 'UJI-E3'])$q$);
    h := h || pg_temp.cek('AB-02', 'Siswa punya 1 pinjaman, meminjam 2 lagi (batas 2) -> ditolak', r like 'DITOLAK:%melebihi batas%', r);

    r := pg_temp.sebagai(u_petugas, $q$select public.catat_peminjaman('UJI-S1', array['UJI-E2'])$q$);
    h := h || pg_temp.cek('AB-02', 'Siswa punya 1 pinjaman, meminjam 1 lagi (tepat di batas) -> berhasil', r like 'OK:%', r);

    r := pg_temp.sebagai(u_petugas, $q$select public.catat_peminjaman('UJI-S1', array['UJI-E3'])$q$);
    h := h || pg_temp.cek('AB-02', 'Siswa sudah 2 pinjaman, meminjam lagi -> ditolak', r like 'DITOLAK:%melebihi batas%', r);

    r := pg_temp.sebagai(u_petugas, $q$select public.catat_peminjaman('UJI-S2', array['UJI-E4'])$q$);
    -- simulasi: pinjaman UJI-E4 sudah lewat jatuh tempo 3 hari
    update public.detail_peminjaman set tanggal_jatuh_tempo = t - 3
     where status = 'dipinjam' and id_eksemplar = (select id_eksemplar from public.eksemplar where nomor_induk = 'UJI-E4');
    r := pg_temp.sebagai(u_petugas, $q$select public.catat_peminjaman('UJI-S2', array['UJI-E3'])$q$);
    h := h || pg_temp.cek('AB-02', 'Anggota punya pinjaman lewat jatuh tempo -> ditolak', r like 'DITOLAK:%melewati jatuh tempo%', r);

    r := pg_temp.sebagai(u_petugas, $q$select public.cek_kelayakan_anggota('UJI-S2') ->> 'boleh_meminjam'$q$);
    h := h || pg_temp.cek('AB-02', 'cek_kelayakan_anggota: anggota yang terlambat -> tidak boleh meminjam', r = 'OK:false', r);
    r := pg_temp.sebagai(u_petugas, $q$select public.cek_kelayakan_anggota('UJI-G1') ->> 'boleh_meminjam'$q$);
    h := h || pg_temp.cek('AB-02', 'cek_kelayakan_anggota: guru aktif tanpa masalah -> boleh meminjam', r = 'OK:true', r);

    -- ================= AB-03: syarat eksemplar boleh dipinjam =================
    r := pg_temp.sebagai(u_petugas, $q$select public.catat_peminjaman('UJI-G1', array['UJI-E1'])$q$);
    h := h || pg_temp.cek('AB-03', 'Eksemplar yang sedang dipinjam -> ditolak', r like 'DITOLAK:%tidak tersedia%', r);

    r := pg_temp.sebagai(u_petugas, $q$select public.catat_peminjaman('UJI-G1', array['UJI-R1'])$q$);
    h := h || pg_temp.cek('AB-03', 'Buku referensi (dapat_dipinjam = false) -> ditolak', r like 'DITOLAK:%dibaca di tempat%', r);

    r := pg_temp.sebagai(u_petugas, $q$select public.catat_peminjaman('UJI-G1', array['UJI-X1'])$q$);
    h := h || pg_temp.cek('AB-03', 'Eksemplar berstatus rusak -> ditolak', r like 'DITOLAK:%tidak tersedia%rusak%', r);

    r := pg_temp.sebagai(u_petugas, $q$select public.catat_peminjaman('UJI-G1', array['UJI-TIDAK-ADA'])$q$);
    h := h || pg_temp.cek('AB-03', 'Nomor induk eksemplar tidak dikenal -> ditolak', r like 'DITOLAK:%tidak ditemukan%', r);

    r := pg_temp.sebagai(u_petugas, $q$select public.catat_peminjaman('UJI-G1', array['UJI-E6', 'UJI-E6'])$q$);
    h := h || pg_temp.cek('AB-03', 'Nomor induk yang sama dimasukkan dua kali -> ditolak', r like 'DITOLAK:%lebih dari sekali%', r);

    r := pg_temp.sebagai(u_petugas, $q$select public.catat_peminjaman('UJI-G1', array['UJI-E6', 'UJI-R1'])$q$);
    select count(*) into v_n from public.eksemplar where nomor_induk = 'UJI-E6' and status = 'tersedia';
    h := h || pg_temp.cek('AB-03', 'Atomik: 1 dari 2 buku tidak sah -> seluruh transaksi batal, buku lain tetap tersedia',
                          r like 'DITOLAK:%' and v_n = 1, r);

    r := pg_temp.sebagai(u_petugas, $q$update public.eksemplar set status = 'dipinjam' where nomor_induk = 'UJI-E6'$q$);
    h := h || pg_temp.cek('AB-03', 'Petugas mengubah status menjadi "dipinjam" secara manual -> ditolak', r like 'DITOLAK:%', r);

    r := pg_temp.sebagai(u_petugas, $q$update public.eksemplar set status = 'tersedia' where nomor_induk = 'UJI-E1'$q$);
    h := h || pg_temp.cek('AB-03', 'Petugas mengubah eksemplar yang sedang dipinjam menjadi "tersedia" secara manual -> ditolak', r like 'DITOLAK:%', r);

    -- ================= AB-05: perpanjangan =================
    -- simulasi: UJI-E1 dipinjam 5 hari lalu, jatuh tempo 2 hari lagi
    update public.detail_peminjaman set tanggal_jatuh_tempo = t + 2
     where status = 'dipinjam' and id_eksemplar = (select id_eksemplar from public.eksemplar where nomor_induk = 'UJI-E1');

    r := pg_temp.sebagai(u_petugas, $q$select public.catat_perpanjangan('UJI-E1')$q$);
    select dp.tanggal_jatuh_tempo, dp.jumlah_perpanjangan into d
      from public.detail_peminjaman dp join public.eksemplar e using (id_eksemplar)
     where e.nomor_induk = 'UJI-E1' and dp.status = 'dipinjam';
    h := h || pg_temp.cek('AB-05', 'Perpanjangan pertama (belum terlambat) -> berhasil', r like 'OK:%', r);
    h := h || pg_temp.cek('AB-05', 'Jatuh tempo baru = tanggal perpanjangan + 7 hari (bukan jatuh tempo lama + 7)',
                          d.tanggal_jatuh_tempo = t + 7 and d.jumlah_perpanjangan = 1,
                          format('jatuh tempo lama %s, baru %s, jumlah perpanjangan %s', t + 2, d.tanggal_jatuh_tempo, d.jumlah_perpanjangan));

    r := pg_temp.sebagai(u_petugas, $q$select public.catat_perpanjangan('UJI-E1')$q$);
    h := h || pg_temp.cek('AB-05', 'Perpanjangan kedua (batas 1 kali) -> ditolak', r like 'DITOLAK:%batas perpanjangan%', r);

    r := pg_temp.sebagai(u_petugas, $q$select public.catat_perpanjangan('UJI-E4')$q$);
    h := h || pg_temp.cek('AB-05', 'Perpanjangan pinjaman yang sudah terlambat -> ditolak', r like 'DITOLAK:%terlambat%', r);

    r := pg_temp.sebagai(u_petugas, $q$select public.catat_perpanjangan('UJI-E6')$q$);
    h := h || pg_temp.cek('AB-05', 'Perpanjangan eksemplar yang tidak sedang dipinjam -> ditolak', r like 'DITOLAK:%tidak sedang dipinjam%', r);

    -- ================= AB-06 & AB-07: hari terlambat dan denda =================
    r := pg_temp.sebagai(u_petugas, $q$select public.catat_pengembalian('UJI-E2', 'baik')$q$);
    select dp.hari_terlambat, dp.denda, dp.status_denda, dp.status, e.status as status_eks into d
      from public.detail_peminjaman dp join public.eksemplar e using (id_eksemplar)
     where e.nomor_induk = 'UJI-E2' order by dp.id_detail desc limit 1;
    h := h || pg_temp.cek('AB-06', 'Kembali tepat waktu -> hari terlambat 0, eksemplar kembali "tersedia"',
                          r like 'OK:%' and d.hari_terlambat = 0 and d.status = 'dikembalikan' and d.status_eks = 'tersedia', r);

    -- petugas menetapkan denda siswa Rp500/hari lewat menu Pengaturan
    r := pg_temp.sebagai(u_petugas, $q$with x as (update public.aturan_peminjaman set denda_per_hari = 500 where jenis_anggota = 'siswa' returning 1) select count(*) from x$q$);
    h := h || pg_temp.cek('AB-07', 'Petugas mengubah denda per hari di pengaturan -> berhasil', r = 'OK:1', r);

    r := pg_temp.sebagai(u_petugas, $q$select public.catat_pengembalian('UJI-E4', 'baik', 'lunas')$q$);
    select dp.hari_terlambat, dp.denda, dp.status_denda into d
      from public.detail_peminjaman dp join public.eksemplar e using (id_eksemplar)
     where e.nomor_induk = 'UJI-E4' order by dp.id_detail desc limit 1;
    h := h || pg_temp.cek('AB-06', 'Kembali 3 hari setelah jatuh tempo -> hari terlambat = 3', d.hari_terlambat = 3,
                          format('hari terlambat tercatat %s', d.hari_terlambat));
    h := h || pg_temp.cek('AB-07', 'Denda = 3 hari x Rp500 = Rp1.500, status denda "lunas" sesuai pilihan petugas',
                          d.denda = 1500 and d.status_denda = 'lunas', format('denda %s, status %s', d.denda, d.status_denda));

    r := pg_temp.sebagai(u_petugas, $q$select public.catat_pengembalian('UJI-E1', 'baik')$q$);
    select dp.hari_terlambat, dp.denda, dp.status_denda into d
      from public.detail_peminjaman dp join public.eksemplar e using (id_eksemplar)
     where e.nomor_induk = 'UJI-E1' order by dp.id_detail desc limit 1;
    h := h || pg_temp.cek('AB-06', 'Kembali 7 hari SEBELUM jatuh tempo -> hari terlambat tetap 0 (tidak negatif), denda 0',
                          d.hari_terlambat = 0 and d.denda = 0 and d.status_denda = 'tidak_ada',
                          format('hari %s, denda %s, status %s', d.hari_terlambat, d.denda, d.status_denda));

    -- guru: denda per hari = 0
    update public.detail_peminjaman set tanggal_jatuh_tempo = t - 10
     where status = 'dipinjam' and id_eksemplar = (select id_eksemplar from public.eksemplar where nomor_induk = 'UJI-E5');
    r := pg_temp.sebagai(u_petugas, $q$select public.catat_pengembalian('UJI-E5', 'baik', 'belum_lunas')$q$);
    select dp.hari_terlambat, dp.denda, dp.status_denda into d
      from public.detail_peminjaman dp join public.eksemplar e using (id_eksemplar)
     where e.nomor_induk = 'UJI-E5' order by dp.id_detail desc limit 1;
    h := h || pg_temp.cek('AB-07', 'Denda per hari Rp0: terlambat 10 hari -> denda Rp0, status denda "tidak_ada"',
                          d.hari_terlambat = 10 and d.denda = 0 and d.status_denda = 'tidak_ada',
                          format('hari %s, denda %s, status %s', d.hari_terlambat, d.denda, d.status_denda));

    r := pg_temp.sebagai(u_petugas, $q$select public.catat_pengembalian('UJI-E5', 'baik')$q$);
    h := h || pg_temp.cek('AB-06', 'Mengembalikan eksemplar yang sama dua kali -> ditolak', r like 'DITOLAK:%tidak sedang dipinjam%', r);

    r := pg_temp.sebagai(u_petugas, $q$select public.catat_peminjaman('UJI-S2', array['UJI-E3'])$q$);
    update public.detail_peminjaman set tanggal_jatuh_tempo = t - 2
     where status = 'dipinjam' and id_eksemplar = (select id_eksemplar from public.eksemplar where nomor_induk = 'UJI-E3');
    r := pg_temp.sebagai(u_petugas, $q$select public.catat_pengembalian('UJI-E3', 'baik', 'tidak_ada')$q$);
    h := h || pg_temp.cek('AB-07', 'Ada denda tetapi status denda diisi "tidak_ada" -> ditolak', r like 'DITOLAK:%denda%', r);
    r := pg_temp.sebagai(u_petugas, $q$select public.catat_pengembalian('UJI-E3', 'baik')$q$);
    select dp.denda, dp.status_denda into d
      from public.detail_peminjaman dp join public.eksemplar e using (id_eksemplar)
     where e.nomor_induk = 'UJI-E3' order by dp.id_detail desc limit 1;
    h := h || pg_temp.cek('AB-07', 'Ada denda, status tidak diisi -> otomatis "belum_lunas" (2 hari x Rp500 = Rp1.000)',
                          d.denda = 1000 and d.status_denda = 'belum_lunas', format('denda %s, status %s', d.denda, d.status_denda));

    -- menandai denda lunas (denda dibayar belakangan di meja petugas)
    select dp.id_detail into v_n
      from public.detail_peminjaman dp join public.eksemplar e using (id_eksemplar)
     where e.nomor_induk = 'UJI-E3' order by dp.id_detail desc limit 1;
    r := pg_temp.sebagai(u_s2, format('select public.tandai_denda_lunas(%s)', v_n));
    h := h || pg_temp.cek('AB-07', 'Anggota menandai dendanya sendiri lunas -> ditolak', r like 'DITOLAK:Hanya petugas%', r);
    r := pg_temp.sebagai(u_petugas, format('select public.tandai_denda_lunas(%s) ->> ''status_denda''', v_n));
    h := h || pg_temp.cek('AB-07', 'Petugas menandai denda "belum_lunas" menjadi lunas -> berhasil', r = 'OK:lunas', r);
    r := pg_temp.sebagai(u_petugas, format('select public.tandai_denda_lunas(%s)', v_n));
    h := h || pg_temp.cek('AB-07', 'Menandai lunas denda yang sudah lunas -> ditolak', r like 'DITOLAK:%sudah berstatus lunas%', r);
    select dp.id_detail into v_n
      from public.detail_peminjaman dp join public.eksemplar e using (id_eksemplar)
     where e.nomor_induk = 'UJI-E2' order by dp.id_detail desc limit 1;
    r := pg_temp.sebagai(u_petugas, format('select public.tandai_denda_lunas(%s)', v_n));
    h := h || pg_temp.cek('AB-07', 'Menandai lunas pinjaman yang tidak punya denda -> ditolak', r like 'DITOLAK:%tidak memiliki denda%', r);

    -- ================= AB-08: sistem tidak pernah otomatis mengubah menjadi "hilang" =================
    r := pg_temp.sebagai(u_petugas, $q$select public.catat_peminjaman('UJI-S2', array['UJI-E7'])$q$);
    update public.detail_peminjaman set tanggal_jatuh_tempo = t - 400
     where status = 'dipinjam' and id_eksemplar = (select id_eksemplar from public.eksemplar where nomor_induk = 'UJI-E7');

    r := pg_temp.sebagai(u_petugas, $q$select hari_terlambat from public.v_keterlambatan where nomor_induk_eksemplar = 'UJI-E7'$q$);
    h := h || pg_temp.cek('AB-08', 'Pinjaman terlambat 400 hari muncul di daftar keterlambatan (status terlambat dihitung, tidak disimpan)', r = 'OK:400', r);

    select e.status as status_eks, dp.status into d
      from public.detail_peminjaman dp join public.eksemplar e using (id_eksemplar)
     where e.nomor_induk = 'UJI-E7' order by dp.id_detail desc limit 1;
    h := h || pg_temp.cek('AB-08', 'Walau terlambat 400 hari, eksemplar TETAP "dipinjam" (tidak otomatis hilang)',
                          d.status_eks = 'dipinjam' and d.status = 'dipinjam', format('eksemplar %s, pinjaman %s', d.status_eks, d.status));

    select count(*) into v_n
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prosrc ilike '%hilang%' and p.proname <> 'catat_pengembalian';
    h := h || pg_temp.cek('AB-08', 'Tidak ada fungsi/trigger lain yang menulis status "hilang" selain catat_pengembalian (pilihan petugas)',
                          v_n = 0, format('%s fungsi lain', v_n));

    r := pg_temp.sebagai(u_petugas, $q$select public.catat_pengembalian('UJI-E7', 'hilang', null, 'Dilaporkan hilang oleh anggota')$q$);
    select e.status as status_eks, dp.status into d
      from public.detail_peminjaman dp join public.eksemplar e using (id_eksemplar)
     where e.nomor_induk = 'UJI-E7' order by dp.id_detail desc limit 1;
    h := h || pg_temp.cek('AB-08', 'Petugas memilih kondisi "hilang" saat pengembalian -> eksemplar menjadi "hilang"',
                          r like 'OK:%' and d.status_eks = 'hilang' and d.status = 'hilang', r);

    r := pg_temp.sebagai(u_petugas, $q$select public.catat_peminjaman('UJI-G1', array['UJI-E6'])$q$);
    r := pg_temp.sebagai(u_petugas, $q$select public.catat_pengembalian('UJI-E6', 'rusak', null, 'Halaman sobek')$q$);
    select status as status_eks, keterangan into d from public.eksemplar where nomor_induk = 'UJI-E6';
    h := h || pg_temp.cek('AB-08', 'Petugas memilih kondisi "rusak" -> eksemplar menjadi "rusak" dan catatan tersimpan',
                          d.status_eks = 'rusak' and d.keterangan = 'Halaman sobek', format('%s / %s', d.status_eks, d.keterangan));

    r := pg_temp.sebagai(u_petugas, $q$with x as (update public.eksemplar set status = 'hilang' where nomor_induk = 'UJI-E8' returning 1) select count(*) from x$q$);
    h := h || pg_temp.cek('AB-08', 'Petugas menandai eksemplar di rak sebagai "hilang" -> boleh', r = 'OK:1', r);

    r := pg_temp.sebagai(u_s2, $q$with x as (update public.eksemplar set status = 'hilang' where nomor_induk = 'UJI-E2' returning 1) select count(*) from x$q$);
    select count(*) into v_n from public.eksemplar where nomor_induk = 'UJI-E2' and status = 'tersedia';
    h := h || pg_temp.cek('AB-08', 'Anggota mencoba mengubah status eksemplar -> tidak ada yang berubah', r = 'OK:0' and v_n = 1, r);

    -- ================= AB-09: perubahan aturan hanya untuk transaksi baru =================
    r := pg_temp.sebagai(u_petugas, $q$select public.catat_peminjaman('UJI-G1', array['UJI-E2'])$q$);
    r := pg_temp.sebagai(u_petugas, $q$with x as (update public.aturan_peminjaman set lama_pinjam_hari = 21 where jenis_anggota = 'guru' returning 1) select count(*) from x$q$);
    select dp.tanggal_jatuh_tempo into v_tempo
      from public.detail_peminjaman dp join public.eksemplar e using (id_eksemplar)
     where e.nomor_induk = 'UJI-E2' and dp.status = 'dipinjam';
    h := h || pg_temp.cek('AB-09', 'Lama pinjam guru diubah 14 -> 21 hari: jatuh tempo pinjaman LAMA tidak berubah',
                          r = 'OK:1' and v_tempo = t + 14, format('jatuh tempo pinjaman lama tetap %s', v_tempo));

    r := pg_temp.sebagai(u_petugas, $q$select public.catat_peminjaman('UJI-G1', array['UJI-E3'])$q$);
    select dp.tanggal_jatuh_tempo into v_tempo
      from public.detail_peminjaman dp join public.eksemplar e using (id_eksemplar)
     where e.nomor_induk = 'UJI-E3' and dp.status = 'dipinjam';
    h := h || pg_temp.cek('AB-09', 'Pinjaman BARU setelah aturan diubah memakai 21 hari', v_tempo = t + 21,
                          format('jatuh tempo pinjaman baru %s', v_tempo));

    r := pg_temp.sebagai(u_s2, $q$with x as (update public.aturan_peminjaman set maks_pinjam = 99 returning 1) select count(*) from x$q$);
    select count(*) into v_n from public.aturan_peminjaman where maks_pinjam = 99;
    h := h || pg_temp.cek('AB-09', 'Anggota mencoba mengubah aturan peminjaman -> tidak ada yang berubah', r = 'OK:0' and v_n = 0, r);

    -- ================= AB-10: anggota tidak dihapus, hanya dinonaktifkan =================
    r := pg_temp.sebagai(u_petugas, $q$delete from public.anggota where nomor_induk = 'UJI-S1'$q$);
    h := h || pg_temp.cek('AB-10', 'Petugas menghapus anggota dari aplikasi -> ditolak', r like 'DITOLAK:%', r);

    begin
      delete from public.anggota where nomor_induk = 'UJI-S1';
      r := 'OK:terhapus';
    exception when others then
      r := 'DITOLAK:' || sqlerrm;
    end;
    h := h || pg_temp.cek('AB-10', 'Bahkan pemilik database menghapus anggota -> ditolak oleh trigger', r like 'DITOLAK:%tidak boleh dihapus%', r);

    -- menonaktifkan (di aplikasi dilakukan Edge Function; di sini langsung oleh pemilik database)
    update public.anggota set status_anggota = 'nonaktif' where nomor_induk = 'UJI-S1';
    select status::text into r from public.profil_pengguna where id = u_s1;
    h := h || pg_temp.cek('AB-10', 'Anggota dinonaktifkan -> status akun login otomatis ikut "nonaktif"', r = 'nonaktif', r);
    select (banned_until is not null)::text into r from auth.users where id = u_s1;
    h := h || pg_temp.cek('AB-10', 'Anggota dinonaktifkan -> akun diblokir login di Supabase Auth', r = 'true', 'diblokir: ' || r);

    r := pg_temp.sebagai(u_petugas, $q$select count(*) from public.v_pinjaman where nomor_induk_anggota = 'UJI-S1'$q$);
    h := h || pg_temp.cek('AB-10', 'Riwayat pinjaman anggota nonaktif tetap tersimpan (2 pinjaman)', r = 'OK:2', r);

    r := pg_temp.sebagai(u_petugas, $q$select public.catat_peminjaman('UJI-S1', array['UJI-E1'])$q$);
    h := h || pg_temp.cek('AB-10', 'Anggota nonaktif tidak bisa meminjam -> ditolak', r like 'DITOLAK:%nonaktif%', r);

    r := pg_temp.sebagai(u_s1, $q$select (select count(*) from public.buku) + (select count(*) from public.v_pinjaman) + (select count(*) from public.eksemplar)$q$);
    h := h || pg_temp.cek('AB-10', 'Akun nonaktif yang masih memegang sesi lama tidak bisa membaca data apa pun', r = 'OK:0', r);

    update public.anggota set status_anggota = 'aktif' where nomor_induk = 'UJI-S1';
    select p.status::text || ', diblokir: ' || (u.banned_until is not null)::text into r
      from public.profil_pengguna p join auth.users u on u.id = p.id where p.id = u_s1;
    h := h || pg_temp.cek('AB-10', 'Anggota diaktifkan kembali -> akun aktif lagi dan blokir login dicabut', r = 'aktif, diblokir: false', r);

    -- ================= KEAMANAN: RLS dan hak akses =================
    select count(*) into v_n from pg_tables where schemaname = 'public' and not rowsecurity;
    h := h || pg_temp.cek('RLS', 'RLS aktif di semua tabel schema public', v_n = 0, format('%s tabel tanpa RLS', v_n));

    r := pg_temp.sebagai(null, $q$select count(*) from public.buku$q$);
    h := h || pg_temp.cek('RLS', 'Tanpa login membaca katalog -> ditolak', r like 'DITOLAK:%', r);

    r := pg_temp.sebagai(u_s2, $q$select count(*) from public.v_ketersediaan_buku where judul like 'UJI %'$q$);
    h := h || pg_temp.cek('RLS', 'Anggota bisa membaca katalog dan ketersediaan', r = 'OK:2', r);

    r := pg_temp.sebagai(u_s2, $q$select tersedia || '/' || total_eksemplar from public.v_ketersediaan_buku where judul = 'UJI Buku Biasa'$q$);
    select count(*) filter (where status = 'tersedia') || '/' || count(*) into v_teks from public.eksemplar where id_buku = v_b1;
    h := h || pg_temp.cek('RLS', 'View ketersediaan menghitung tersedia/total dengan benar', r = 'OK:' || v_teks, r);

    select count(*) into v_n from public.v_pinjaman where nomor_induk_anggota = 'UJI-S2';
    r := pg_temp.sebagai(u_s2, $q$select count(*) || ' milik sendiri, ' || count(*) filter (where nomor_induk_anggota <> 'UJI-S2') || ' milik orang lain' from public.v_pinjaman$q$);
    h := h || pg_temp.cek('RLS', 'Anggota hanya melihat pinjamannya sendiri', r = format('OK:%s milik sendiri, 0 milik orang lain', v_n), r);

    r := pg_temp.sebagai(u_s2, $q$select count(*) from public.profil_pengguna$q$);
    h := h || pg_temp.cek('RLS', 'Anggota hanya melihat profilnya sendiri (1 baris)', r = 'OK:1', r);

    r := pg_temp.sebagai(u_s2, $q$select count(*) from public.anggota$q$);
    h := h || pg_temp.cek('RLS', 'Anggota tidak bisa melihat data anggota lain', r = 'OK:1', r);

    r := pg_temp.sebagai(u_s2, format($q$insert into public.buku (id_kategori, judul) values (%s, 'UJI Buku Susupan')$q$, v_kat));
    h := h || pg_temp.cek('RLS', 'Anggota menambah buku -> ditolak', r like 'DITOLAK:%', r);

    r := pg_temp.sebagai(u_s2, $q$update public.profil_pengguna set role = 'petugas'$q$);
    h := h || pg_temp.cek('RLS', 'Anggota mengubah perannya sendiri menjadi petugas -> ditolak', r like 'DITOLAK:%', r);

    r := pg_temp.sebagai(u_s2, $q$select public.cek_kelayakan_anggota('UJI-G1')$q$);
    h := h || pg_temp.cek('RLS', 'Anggota memanggil cek_kelayakan_anggota milik orang lain -> ditolak', r like 'DITOLAK:Hanya petugas%', r);

    r := pg_temp.sebagai(u_petugas, $q$with x as (insert into public.kategori (nama_kategori) values ('UJI Kategori Baru') returning 1) select count(*) from x$q$);
    h := h || pg_temp.cek('RLS', 'Petugas menambah kategori -> berhasil', r = 'OK:1', r);

    r := pg_temp.sebagai(u_petugas, $q$delete from public.kategori where nama_kategori = 'UJI Kategori'$q$);
    h := h || pg_temp.cek('RLS', 'Petugas menghapus kategori yang masih punya buku -> ditolak', r like 'DITOLAK:%', r);

    r := pg_temp.sebagai(u_petugas, $q$select count(*) from public.v_keterlambatan$q$);
    h := h || pg_temp.cek('RLS', 'Petugas bisa membuka daftar keterlambatan', r like 'OK:%', r);

    -- Batalkan semua perubahan data uji
    raise exception 'SELESAI_UJI';
  exception when others then
    if sqlerrm <> 'SELESAI_UJI' then
      h := h || pg_temp.cek('ERROR', 'Skrip uji berhenti karena error tak terduga', false, sqlerrm);
    end if;
  end;

  insert into hasil_uji (kode, uji, hasil, keterangan)
  select x ->> 'kode', x ->> 'uji', x ->> 'hasil', x ->> 'keterangan'
    from jsonb_array_elements(h) with ordinality as t(x, ord)
   order by ord;
end;
$uji$;

-- Hasil akhir (baris terakhir = ringkasan)
select no, kode, uji, hasil, keterangan from hasil_uji
union all
select 9999, 'RINGKASAN',
       format('%s uji dijalankan: %s LULUS, %s GAGAL', count(*), count(*) filter (where hasil = 'LULUS'), count(*) filter (where hasil = 'GAGAL')),
       case when count(*) filter (where hasil = 'GAGAL') = 0 and count(*) > 0 then 'LULUS SEMUA' else 'ADA YANG GAGAL' end,
       'Data uji sudah dibatalkan, data asli tidak berubah'
from hasil_uji
order by no;
