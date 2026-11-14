-- =====================================================================
-- SIMPUS - Membuat akun PETUGAS (untuk pemakaian sungguhan, tanpa data contoh)
--
-- Kapan dipakai: saat database dipasang TANPA seed.sql, atau saat perlu
-- menambah petugas baru. Akun anggota tidak dibuat dari sini, melainkan dari
-- menu Data Anggota di aplikasi.
--
-- Cara pakai: ubah dua nilai di bawah, lalu jalankan di Supabase > SQL Editor.
-- Kata sandi awal = ID petugas (minimal 6 karakter), wajib diganti saat login pertama.
-- =====================================================================

do $$
declare
  v_username text := 'PTG001';                 -- <== ganti: ID petugas untuk login
  v_nama     text := 'Petugas Perpustakaan';   -- <== ganti: nama petugas
  v_id       uuid := gen_random_uuid();
  v_email    text;
begin
  v_username := btrim(v_username);
  v_email    := lower(v_username) || '@simpus.local';

  if length(v_username) < 6 then
    raise exception 'ID petugas minimal 6 karakter karena dipakai sebagai kata sandi awal.';
  end if;
  if v_username !~ '^[A-Za-z0-9._-]+$' then
    raise exception 'ID petugas hanya boleh berisi huruf, angka, titik, dan tanda hubung (tanpa spasi).';
  end if;
  if exists (select 1 from public.profil_pengguna where lower(username) = lower(v_username))
     or exists (select 1 from auth.users where email = v_email) then
    raise exception 'Username "%" sudah dipakai.', v_username;
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
    extensions.crypt(v_username, extensions.gen_salt('bf')), now(),
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
  values (v_id, btrim(v_nama), v_username, 'petugas', 'aktif', true);

  raise notice 'Petugas % berhasil dibuat. Login dengan username dan kata sandi: %', v_nama, v_username;
end $$;

select username, nama, role, status from public.profil_pengguna where role = 'petugas' order by username;
