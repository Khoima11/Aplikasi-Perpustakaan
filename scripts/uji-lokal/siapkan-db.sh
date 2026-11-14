#!/bin/bash
# Membuat ulang database uji LOKAL "simpus_uji": tiruan Supabase + semua migrasi + seed.
# Hanya untuk pengembang. Butuh PostgreSQL lokal yang berjalan dan hak menjalankan "su postgres".
set -e
cd "$(dirname "$0")/../.."
chmod -R a+rX supabase
jalankan() { su postgres -c "psql -X -q -v ON_ERROR_STOP=1 $1"; }
jalankan "-c 'drop database if exists simpus_uji'"
jalankan "-c 'create database simpus_uji'"
jalankan "-d simpus_uji -f supabase/tests/00_tiruan_supabase_lokal.sql"
for f in supabase/migrations/*.sql; do jalankan "-d simpus_uji -f $f"; done
jalankan "-d simpus_uji -f supabase/seed.sql" > /dev/null
echo "Database uji lokal siap (migrasi + seed)."
