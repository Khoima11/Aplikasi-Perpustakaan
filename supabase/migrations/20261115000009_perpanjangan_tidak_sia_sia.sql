-- =====================================================================
-- SIMPUS - Migrasi 9: perpanjangan yang tidak menambah jatuh tempo ditolak
--
-- Keputusan pemilik (pilihan A, 15/11/2026). Rumus AB-05 TETAP:
--   jatuh tempo baru = tanggal perpanjangan + lama pinjam
-- Tambahan: jika hasilnya tidak lebih jauh dari jatuh tempo saat ini
-- (misalnya diperpanjang di hari yang sama dengan hari pinjam), perpanjangan
-- ditolak dan jatah perpanjangan TIDAK terpakai.
--
-- Mengganti dua fungsi dari migrasi 5; selain tambahan di atas, isinya sama.
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
  elsif v_hari_ini + v_aturan.lama_pinjam_hari <= v.tanggal_jatuh_tempo then
    v_alasan := format('Perpanjangan belum diperlukan: jatuh tempo tidak akan bertambah (tetap %s). Perpanjang menjelang jatuh tempo.',
      to_char(v.tanggal_jatuh_tempo, 'DD/MM/YYYY'));
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

  -- Keputusan pemilik (pilihan A, 15/11/2026): perpanjangan yang tidak menambah
  -- jatuh tempo ditolak agar jatah perpanjangan tidak terbuang.
  if v_tempo_baru <= v_detail.tanggal_jatuh_tempo then
    raise exception 'Perpanjangan belum diperlukan: jatuh tempo tidak akan bertambah (tetap %). Perpanjang menjelang jatuh tempo.',
      to_char(v_detail.tanggal_jatuh_tempo, 'DD/MM/YYYY');
  end if;

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

revoke all on function
  public.cari_pinjaman_aktif(text),
  public.catat_perpanjangan(text)
from public, anon, authenticated;

grant execute on function
  public.cari_pinjaman_aktif(text),
  public.catat_perpanjangan(text)
to authenticated, service_role;
