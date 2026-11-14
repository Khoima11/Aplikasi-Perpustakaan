// =====================================================================
// SIMPUS - Edge Function "kelola-akun"
//
// Mengurus hal-hal yang membutuhkan kunci rahasia (service role) sehingga
// TIDAK BOLEH dilakukan dari aplikasi di browser:
//   cek              : memeriksa bahwa fungsi terpasang dengan benar (tidak mengubah data)
//   buat_anggota     : membuat 1 anggota + akun login
//   impor_anggota    : membuat banyak anggota sekaligus (dari Excel)
//   reset_sandi      : mengembalikan kata sandi ke nomor induk + wajib ganti
//   ubah_status      : menonaktifkan / mengaktifkan kembali anggota
//   ubah_nomor_induk : memperbaiki NIS/NIP yang salah ketik
//
// Keamanan: setiap permintaan diperiksa di sini. Pemanggil harus sudah login
// DAN berperan petugas aktif. Selain itu ditolak.
// Kunci service role dibaca dari variabel lingkungan yang disediakan Supabase,
// tidak pernah dikirim ke browser.
// =====================================================================

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

const DOMAIN_EMAIL = 'simpus.local'
const MAKS_IMPOR_PER_PERMINTAAN = 200
const PANJANG_MIN_NOMOR_INDUK = 6 // Supabase Auth mewajibkan kata sandi minimal 6 karakter

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type Hasil = { ok: boolean; pesan: string; data?: unknown }

function jawab(hasil: Hasil, status = 200): Response {
  return new Response(JSON.stringify(hasil), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

const teks = (v: unknown): string => (v === null || v === undefined ? '' : String(v).trim())
const emailDari = (nomorInduk: string) => `${nomorInduk.toLowerCase()}@${DOMAIN_EMAIL}`
// Agar tanda % dan _ tidak dianggap pola pencarian
const amanIlike = (s: string) => s.replace(/[\\%_]/g, '\\$&')

// ---------- Pemeriksaan data anggota ----------
type DataAnggota = {
  nomor_induk: string
  nama: string
  jenis_anggota: 'siswa' | 'guru'
  kelas: string | null
  jenis_kelamin: 'L' | 'P' | null
  no_hp: string | null
}

function periksaNomorInduk(nilai: unknown): { ok: true; nomor: string } | { ok: false; pesan: string } {
  const nomor = teks(nilai)
  if (!nomor) return { ok: false, pesan: 'Nomor induk (NIS/NIP) wajib diisi.' }
  if (!/^[A-Za-z0-9._-]+$/.test(nomor)) {
    return { ok: false, pesan: 'Nomor induk hanya boleh berisi huruf, angka, titik, dan tanda hubung (tanpa spasi).' }
  }
  if (nomor.length < PANJANG_MIN_NOMOR_INDUK) {
    return { ok: false, pesan: `Nomor induk minimal ${PANJANG_MIN_NOMOR_INDUK} karakter karena dipakai sebagai kata sandi awal.` }
  }
  if (nomor.length > 20) return { ok: false, pesan: 'Nomor induk maksimal 20 karakter.' }
  return { ok: true, nomor }
}

function periksaData(masukan: Record<string, unknown>): { ok: true; data: DataAnggota } | { ok: false; pesan: string } {
  const n = periksaNomorInduk(masukan.nomor_induk)
  if (!n.ok) return n

  const nama = teks(masukan.nama)
  if (!nama) return { ok: false, pesan: 'Nama wajib diisi.' }
  if (nama.length > 100) return { ok: false, pesan: 'Nama maksimal 100 karakter.' }

  const jenis = teks(masukan.jenis_anggota).toLowerCase()
  if (jenis !== 'siswa' && jenis !== 'guru') {
    return { ok: false, pesan: 'Jenis anggota harus "siswa" atau "guru".' }
  }

  let kelas: string | null = teks(masukan.kelas) || null
  if (jenis === 'guru') kelas = null
  if (jenis === 'siswa' && !kelas) return { ok: false, pesan: 'Kelas wajib diisi untuk siswa.' }
  if (kelas && kelas.length > 10) return { ok: false, pesan: 'Kelas maksimal 10 karakter.' }

  let jk: 'L' | 'P' | null = null
  const jkTeks = teks(masukan.jenis_kelamin).toUpperCase()
  if (jkTeks) {
    if (jkTeks === 'L' || jkTeks.startsWith('LAKI')) jk = 'L'
    else if (jkTeks === 'P' || jkTeks.startsWith('PEREMPUAN')) jk = 'P'
    else return { ok: false, pesan: 'Jenis kelamin harus "L" atau "P" (boleh dikosongkan).' }
  }

  const noHp = teks(masukan.no_hp) || null
  if (noHp && !/^[0-9+]{6,15}$/.test(noHp)) {
    return { ok: false, pesan: 'Nomor HP hanya angka, 6 sampai 15 digit (boleh dikosongkan).' }
  }

  return { ok: true, data: { nomor_induk: n.nomor, nama, jenis_anggota: jenis, kelas, jenis_kelamin: jk, no_hp: noHp } }
}

async function nomorIndukSudahDipakai(admin: SupabaseClient, nomor: string): Promise<boolean> {
  const pola = amanIlike(nomor)
  const [a, p] = await Promise.all([
    admin.from('anggota').select('id_anggota').ilike('nomor_induk', pola).limit(1),
    admin.from('profil_pengguna').select('id').ilike('username', pola).limit(1),
  ])
  return (a.data?.length ?? 0) > 0 || (p.data?.length ?? 0) > 0
}

// ---------- Membuat satu anggota + akun ----------
async function buatSatu(admin: SupabaseClient, masukan: Record<string, unknown>): Promise<Hasil> {
  const v = periksaData(masukan)
  if (!v.ok) return { ok: false, pesan: v.pesan }
  const d = v.data

  if (await nomorIndukSudahDipakai(admin, d.nomor_induk)) {
    return { ok: false, pesan: `Nomor induk ${d.nomor_induk} sudah terdaftar.` }
  }

  // 1. Akun login. Kata sandi awal = nomor induk.
  const { data: akun, error: galatAkun } = await admin.auth.admin.createUser({
    email: emailDari(d.nomor_induk),
    password: d.nomor_induk,
    email_confirm: true,
  })
  if (galatAkun || !akun?.user) {
    const sudahAda = /already|registered|exists/i.test(galatAkun?.message ?? '')
    return {
      ok: false,
      pesan: sudahAda
        ? `Nomor induk ${d.nomor_induk} sudah punya akun login.`
        : `Gagal membuat akun login: ${galatAkun?.message ?? 'tidak diketahui'}`,
    }
  }
  const idPengguna = akun.user.id

  // 2. Profil pengguna (wajib ganti kata sandi saat login pertama)
  const { error: galatProfil } = await admin.from('profil_pengguna').insert({
    id: idPengguna,
    nama: d.nama,
    username: d.nomor_induk,
    role: 'anggota',
    status: 'aktif',
    wajib_ganti_password: true,
  })
  if (galatProfil) {
    await admin.auth.admin.deleteUser(idPengguna)
    return { ok: false, pesan: `Gagal menyimpan profil: ${galatProfil.message}` }
  }

  // 3. Data anggota
  const { data: anggota, error: galatAnggota } = await admin
    .from('anggota')
    .insert({
      id_pengguna: idPengguna,
      nomor_induk: d.nomor_induk,
      jenis_anggota: d.jenis_anggota,
      kelas: d.kelas,
      jenis_kelamin: d.jenis_kelamin,
      no_hp: d.no_hp,
    })
    .select('id_anggota')
    .single()
  if (galatAnggota) {
    // batalkan langkah 1 dan 2 (menghapus akun ikut menghapus profilnya)
    await admin.auth.admin.deleteUser(idPengguna)
    return { ok: false, pesan: `Gagal menyimpan data anggota: ${galatAnggota.message}` }
  }

  return {
    ok: true,
    pesan: `Anggota ${d.nama} (${d.nomor_induk}) berhasil dibuat. Kata sandi awal sama dengan nomor induk.`,
    data: { id_anggota: anggota.id_anggota, nomor_induk: d.nomor_induk },
  }
}

// ---------- Impor banyak anggota ----------
async function imporBanyak(admin: SupabaseClient, daftar: unknown): Promise<Hasil> {
  if (!Array.isArray(daftar) || daftar.length === 0) {
    return { ok: false, pesan: 'Tidak ada data yang dikirim.' }
  }
  if (daftar.length > MAKS_IMPOR_PER_PERMINTAAN) {
    return { ok: false, pesan: `Maksimal ${MAKS_IMPOR_PER_PERMINTAAN} baris per permintaan.` }
  }

  const rincian: { baris: number; nomor_induk: string; ok: boolean; pesan: string }[] = []
  const sudahDiproses = new Set<string>()
  let berhasil = 0

  for (let i = 0; i < daftar.length; i++) {
    const baris = (daftar[i] ?? {}) as Record<string, unknown>
    const nomor = teks(baris.nomor_induk)
    let hasil: Hasil
    if (nomor && sudahDiproses.has(nomor.toLowerCase())) {
      hasil = { ok: false, pesan: `Nomor induk ${nomor} muncul lebih dari sekali di file.` }
    } else {
      hasil = await buatSatu(admin, baris)
      if (nomor) sudahDiproses.add(nomor.toLowerCase())
    }
    if (hasil.ok) berhasil++
    rincian.push({ baris: i + 1, nomor_induk: nomor, ok: hasil.ok, pesan: hasil.ok ? 'Berhasil' : hasil.pesan })
  }

  return {
    ok: true,
    pesan: `${berhasil} anggota berhasil dibuat, ${daftar.length - berhasil} gagal.`,
    data: { berhasil, gagal: daftar.length - berhasil, rincian },
  }
}

async function ambilAnggota(admin: SupabaseClient, idAnggota: unknown) {
  const id = Number(idAnggota)
  if (!Number.isInteger(id) || id <= 0) return null
  const { data } = await admin
    .from('anggota')
    .select('id_anggota, id_pengguna, nomor_induk, status_anggota, profil_pengguna(nama)')
    .eq('id_anggota', id)
    .maybeSingle()
  if (!data) return null
  const profil = data.profil_pengguna as unknown as { nama: string } | { nama: string }[] | null
  const nama = Array.isArray(profil) ? profil[0]?.nama : profil?.nama
  return { ...data, nama: nama ?? data.nomor_induk }
}

// ---------- Reset kata sandi ----------
async function resetSandi(admin: SupabaseClient, idAnggota: unknown): Promise<Hasil> {
  const a = await ambilAnggota(admin, idAnggota)
  if (!a) return { ok: false, pesan: 'Anggota tidak ditemukan.' }

  const { error } = await admin.auth.admin.updateUserById(a.id_pengguna, { password: a.nomor_induk })
  if (error) return { ok: false, pesan: `Gagal mengatur ulang kata sandi: ${error.message}` }

  const { error: galatProfil } = await admin
    .from('profil_pengguna')
    .update({ wajib_ganti_password: true })
    .eq('id', a.id_pengguna)
  if (galatProfil) return { ok: false, pesan: `Kata sandi diatur ulang, tetapi gagal menandai wajib ganti: ${galatProfil.message}` }

  return {
    ok: true,
    pesan: `Kata sandi ${a.nama} dikembalikan ke nomor induknya (${a.nomor_induk}) dan wajib diganti saat login berikutnya.`,
  }
}

// ---------- Nonaktifkan / aktifkan ----------
async function ubahStatus(admin: SupabaseClient, idAnggota: unknown, status: unknown): Promise<Hasil> {
  if (status !== 'aktif' && status !== 'nonaktif') {
    return { ok: false, pesan: 'Status harus "aktif" atau "nonaktif".' }
  }
  const a = await ambilAnggota(admin, idAnggota)
  if (!a) return { ok: false, pesan: 'Anggota tidak ditemukan.' }

  // Trigger di database ikut mengubah status akun dan memblokir/membuka login.
  const { error } = await admin.from('anggota').update({ status_anggota: status }).eq('id_anggota', a.id_anggota)
  if (error) return { ok: false, pesan: `Gagal mengubah status: ${error.message}` }

  let tambahan = ''
  if (status === 'nonaktif') {
    const { count } = await admin
      .from('v_pinjaman')
      .select('id_detail', { count: 'exact', head: true })
      .eq('id_anggota', a.id_anggota)
      .eq('status', 'dipinjam')
    if ((count ?? 0) > 0) tambahan = ` Perhatian: masih ada ${count} buku yang belum dikembalikan.`
  }

  return {
    ok: true,
    pesan:
      status === 'nonaktif'
        ? `${a.nama} dinonaktifkan. Akun tidak bisa login dan tidak bisa meminjam; riwayat tetap tersimpan.${tambahan}`
        : `${a.nama} diaktifkan kembali.`,
  }
}

// ---------- Memperbaiki nomor induk ----------
async function ubahNomorInduk(admin: SupabaseClient, idAnggota: unknown, nomorBaru: unknown): Promise<Hasil> {
  const n = periksaNomorInduk(nomorBaru)
  if (!n.ok) return { ok: false, pesan: n.pesan }
  const a = await ambilAnggota(admin, idAnggota)
  if (!a) return { ok: false, pesan: 'Anggota tidak ditemukan.' }
  if (a.nomor_induk === n.nomor) {
    return { ok: true, pesan: 'Nomor induk tidak berubah.' }
  }
  if (a.nomor_induk.toLowerCase() !== n.nomor.toLowerCase() && (await nomorIndukSudahDipakai(admin, n.nomor))) {
    return { ok: false, pesan: `Nomor induk ${n.nomor} sudah dipakai anggota lain.` }
  }

  const { error: galatAkun } = await admin.auth.admin.updateUserById(a.id_pengguna, {
    email: emailDari(n.nomor),
    email_confirm: true,
  })
  if (galatAkun) return { ok: false, pesan: `Gagal mengubah akun login: ${galatAkun.message}` }

  const { error: g1 } = await admin.from('profil_pengguna').update({ username: n.nomor }).eq('id', a.id_pengguna)
  const { error: g2 } = g1
    ? { error: null }
    : await admin.from('anggota').update({ nomor_induk: n.nomor }).eq('id_anggota', a.id_anggota)
  if (g1 || g2) {
    // kembalikan seperti semula
    await admin.auth.admin.updateUserById(a.id_pengguna, { email: emailDari(a.nomor_induk), email_confirm: true })
    await admin.from('profil_pengguna').update({ username: a.nomor_induk }).eq('id', a.id_pengguna)
    return { ok: false, pesan: `Gagal menyimpan nomor induk baru: ${(g1 ?? g2)?.message}` }
  }

  return {
    ok: true,
    pesan: `Nomor induk ${a.nama} diubah dari ${a.nomor_induk} menjadi ${n.nomor}. Login sekarang memakai nomor baru; kata sandi tidak berubah.`,
  }
}

// ---------- Pintu masuk ----------
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return jawab({ ok: false, pesan: 'Metode tidak didukung.' }, 405)

  try {
    const url = Deno.env.get('SUPABASE_URL')
    const kunciRahasia = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SIMPUS_SECRET_KEY')
    if (!url || !kunciRahasia) {
      return jawab({ ok: false, pesan: 'Edge Function belum lengkap: kunci service role tidak tersedia di server.' }, 500)
    }
    const admin = createClient(url, kunciRahasia, { auth: { persistSession: false, autoRefreshToken: false } })

    // 1. Pemanggil harus login
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (!token) return jawab({ ok: false, pesan: 'Anda belum login.' }, 401)
    const { data: pengguna, error: galatToken } = await admin.auth.getUser(token)
    if (galatToken || !pengguna?.user) {
      return jawab({ ok: false, pesan: 'Sesi login tidak sah atau sudah berakhir. Silakan login ulang.' }, 401)
    }

    // 2. Pemanggil harus petugas aktif
    const { data: profil } = await admin
      .from('profil_pengguna')
      .select('role, status')
      .eq('id', pengguna.user.id)
      .maybeSingle()
    if (!profil || profil.role !== 'petugas' || profil.status !== 'aktif') {
      return jawab({ ok: false, pesan: 'Hanya petugas yang dapat mengelola akun anggota.' }, 403)
    }

    // 3. Jalankan aksi
    const isi = (await req.json().catch(() => ({}))) as Record<string, unknown>
    switch (isi.aksi) {
      case 'cek': {
        const { error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 })
        if (error) return jawab({ ok: false, pesan: `Kunci service role tidak berfungsi: ${error.message}` })
        return jawab({ ok: true, pesan: 'Edge Function kelola-akun terpasang dan berfungsi.' })
      }
      case 'buat_anggota':
        return jawab(await buatSatu(admin, (isi.anggota ?? {}) as Record<string, unknown>))
      case 'impor_anggota':
        return jawab(await imporBanyak(admin, isi.daftar))
      case 'reset_sandi':
        return jawab(await resetSandi(admin, isi.id_anggota))
      case 'ubah_status':
        return jawab(await ubahStatus(admin, isi.id_anggota, isi.status))
      case 'ubah_nomor_induk':
        return jawab(await ubahNomorInduk(admin, isi.id_anggota, isi.nomor_induk))
      default:
        return jawab({ ok: false, pesan: 'Aksi tidak dikenal.' }, 400)
    }
  } catch (e) {
    return jawab({ ok: false, pesan: `Terjadi kesalahan di server: ${e instanceof Error ? e.message : String(e)}` }, 500)
  }
})
