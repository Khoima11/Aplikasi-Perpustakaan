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
