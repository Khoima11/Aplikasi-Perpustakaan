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
