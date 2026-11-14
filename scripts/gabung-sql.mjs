// Menggabungkan semua file migrasi menjadi satu file agar mudah ditempel
// di Supabase > SQL Editor. Jalankan: npm run gabung-sql
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const folder = 'supabase/migrations'
const berkas = readdirSync(folder).filter((f) => f.endsWith('.sql')).sort()

let isi = `-- =====================================================================
-- SIMPUS - STRUKTUR DATABASE LENGKAP (gabungan ${berkas.length} file migrasi)
--
-- FILE INI DIBUAT OTOMATIS oleh "npm run gabung-sql". JANGAN DIEDIT LANGSUNG.
-- Sumber aslinya ada di folder supabase/migrations.
--
-- Cara pakai (hanya untuk project Supabase yang masih BARU/KOSONG):
--   Supabase > SQL Editor > New query > tempel seluruh isi file ini > Run
-- =====================================================================

begin;
`
for (const f of berkas) {
  isi += `\n-- >>>>>>>>>> ${f} <<<<<<<<<<\n\n` + readFileSync(join(folder, f), 'utf8').trimEnd() + '\n'
}
isi += '\ncommit;\n\nselect \'Struktur database SIMPUS berhasil dipasang\' as hasil;\n'

writeFileSync('supabase/pasang_struktur_database.sql', isi)
console.log(`supabase/pasang_struktur_database.sql dibuat dari ${berkas.length} file migrasi`)
