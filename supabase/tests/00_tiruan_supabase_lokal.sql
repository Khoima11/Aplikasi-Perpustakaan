-- =====================================================================
-- HANYA UNTUK PENGUJIAN DI POSTGRESQL BIASA (BUKAN SUPABASE).
-- JANGAN dijalankan di project Supabase: di sana semua ini sudah tersedia.
--
-- File ini membuat tiruan sederhana dari hal-hal bawaan Supabase yang dipakai
-- migrasi SIMPUS: role anon/authenticated/service_role, schema auth,
-- tabel auth.users & auth.identities, fungsi auth.uid(), dan pgcrypto.
-- =====================================================================

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

create table if not exists auth.users (
  instance_id          uuid,
  id                   uuid primary key,
  aud                  varchar(255),
  role                 varchar(255),
  email                varchar(255) unique,
  encrypted_password   varchar(255),
  email_confirmed_at   timestamptz,
  raw_app_meta_data    jsonb,
  raw_user_meta_data   jsonb,
  created_at           timestamptz,
  updated_at           timestamptz,
  confirmation_token   varchar(255),
  recovery_token       varchar(255),
  email_change_token_new varchar(255),
  email_change         varchar(255),
  banned_until         timestamptz
);

create table if not exists auth.identities (
  id               uuid primary key default gen_random_uuid(),
  provider_id      text not null,
  user_id          uuid not null references auth.users (id) on delete cascade,
  identity_data    jsonb not null,
  provider         text not null,
  last_sign_in_at  timestamptz,
  created_at       timestamptz,
  updated_at       timestamptz,
  unique (provider_id, provider)
);

-- Sama seperti di Supabase: membaca id pengguna dari klaim JWT permintaan
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid;
$$;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- Supabase memberi izin bawaan yang longgar pada schema public; ditiru di sini
-- supaya terbukti migrasi SIMPUS benar-benar mencabutnya.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

-- Tiruan Supabase Storage (hanya tabel yang disentuh migrasi SIMPUS)
create schema if not exists storage;
create table if not exists storage.buckets (
  id                  text primary key,
  name                text not null,
  public              boolean default false,
  file_size_limit     bigint,
  allowed_mime_types  text[]
);
create table if not exists storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text references storage.buckets (id),
  name       text,
  owner      uuid
);
alter table storage.objects enable row level security;
