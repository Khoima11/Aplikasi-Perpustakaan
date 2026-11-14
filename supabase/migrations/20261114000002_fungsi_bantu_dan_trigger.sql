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
