// =====================================================================
// FORMAT IMPOR ANGGOTA DARI EXCEL
// Satu-satunya tempat yang mengatur kolom file impor. Jika sekolah meminta
// kolom baru, ubah daftar KOLOM_IMPOR di bawah (dan Edge Function kelola-akun
// bila kolom itu perlu disimpan).
// =====================================================================

export type KunciKolom = 'nomor_induk' | 'nama' | 'jenis_anggota' | 'kelas' | 'jenis_kelamin' | 'no_hp'

interface DefinisiKolom {
  kunci: KunciKolom
  /** judul kolom di baris pertama file Excel */
  judul: string
  wajib: boolean
  keterangan: string
  contoh: [string, string] // contoh untuk siswa dan guru
  /** nama lain yang juga dikenali sebagai judul kolom ini */
  alias: string[]
  lebar: number
}

export const KOLOM_IMPOR: DefinisiKolom[] = [
  { kunci: 'nomor_induk', judul: 'nomor_induk', wajib: true, keterangan: 'NIS (siswa) atau NIP (guru), minimal 6 karakter, tanpa spasi', contoh: ['250001', '250901'], alias: ['nis', 'nip', 'nis_nip', 'nis/nip', 'no_induk'], lebar: 22 },
  { kunci: 'nama', judul: 'nama', wajib: true, keterangan: 'Nama lengkap', contoh: ['Budi Santoso', 'Siti Aminah, S.Pd.'], alias: ['nama_lengkap'], lebar: 32 },
  { kunci: 'jenis_anggota', judul: 'jenis_anggota', wajib: true, keterangan: 'Isi "siswa" atau "guru"', contoh: ['siswa', 'guru'], alias: ['jenis'], lebar: 16 },
  { kunci: 'kelas', judul: 'kelas', wajib: false, keterangan: 'Wajib untuk siswa, kosongkan untuk guru', contoh: ['7A', ''], alias: [], lebar: 10 },
  { kunci: 'jenis_kelamin', judul: 'jenis_kelamin', wajib: false, keterangan: 'Isi "L" atau "P" (boleh kosong)', contoh: ['L', 'P'], alias: ['jk', 'l/p', 'kelamin'], lebar: 16 },
  { kunci: 'no_hp', judul: 'no_hp', wajib: false, keterangan: 'Nomor HP (boleh kosong)', contoh: ['081234567890', ''], alias: ['hp', 'nomor_hp', 'telepon', 'no_telepon'], lebar: 18 },
]

export interface BarisImpor {
  /** nomor baris di file Excel (baris judul = 1) */
  baris: number
  data: Record<KunciKolom, string>
  /** null jika lolos pemeriksaan awal */
  galat: string | null
}

const PANJANG_MIN_NOMOR_INDUK = 6
const rapikanJudul = (s: unknown) =>
  String(s ?? '').trim().toLowerCase().replace(/[.\s-]+/g, '_').replace(/^_+|_+$/g, '')

function nilaiSel(nilai: unknown, kunci: KunciKolom): { teks: string; galat?: string } {
  if (nilai === null || nilai === undefined) return { teks: '' }
  if (typeof nilai === 'number') {
    if (kunci === 'nomor_induk') {
      // Angka sangat panjang (misalnya NIP 18 digit) sudah rusak di Excel bila selnya berformat angka
      if (!Number.isSafeInteger(nilai)) {
        return { teks: String(nilai), galat: 'Nomor induk terlalu panjang untuk sel berformat angka. Ubah format selnya menjadi Teks lalu ketik ulang.' }
      }
      return { teks: String(nilai) }
    }
    if (kunci === 'no_hp') {
      const s = String(Math.trunc(nilai))
      return { teks: s.startsWith('62') || s.startsWith('0') ? s : `0${s}` } // angka nol di depan hilang pada sel angka
    }
    return { teks: String(nilai) }
  }
  if (nilai instanceof Date) return { teks: '', galat: `Kolom ${kunci} berisi tanggal. Ubah format selnya menjadi Teks.` }
  return { teks: String(nilai).trim() }
}

function periksaBaris(d: Record<KunciKolom, string>): string | null {
  if (!d.nomor_induk) return 'Nomor induk kosong.'
  if (!/^[A-Za-z0-9._-]+$/.test(d.nomor_induk)) return 'Nomor induk hanya boleh huruf, angka, titik, dan tanda hubung (tanpa spasi).'
  if (d.nomor_induk.length < PANJANG_MIN_NOMOR_INDUK) return `Nomor induk minimal ${PANJANG_MIN_NOMOR_INDUK} karakter.`
  if (d.nomor_induk.length > 20) return 'Nomor induk maksimal 20 karakter.'
  if (!d.nama) return 'Nama kosong.'
  if (d.nama.length > 100) return 'Nama maksimal 100 karakter.'
  const jenis = d.jenis_anggota.toLowerCase()
  if (jenis !== 'siswa' && jenis !== 'guru') return 'Jenis anggota harus "siswa" atau "guru".'
  if (jenis === 'siswa' && !d.kelas) return 'Kelas wajib diisi untuk siswa.'
  if (d.kelas.length > 10) return 'Kelas maksimal 10 karakter.'
  if (d.jenis_kelamin && !/^(l|p|laki.*|perempuan)$/i.test(d.jenis_kelamin)) return 'Jenis kelamin harus "L" atau "P".'
  if (d.no_hp && !/^[0-9+]{6,15}$/.test(d.no_hp)) return 'Nomor HP hanya angka, 6 sampai 15 digit.'
  return null
}

/** Membaca file .xlsx dan memeriksa setiap barisnya (belum mengirim apa pun ke server) */
export async function bacaFileAnggota(berkas: File): Promise<BarisImpor[]> {
  if (!/\.xlsx$/i.test(berkas.name)) {
    throw new Error('File harus berformat Excel .xlsx. Jika file Anda .xls atau .csv, buka di Excel lalu "Save As" menjadi .xlsx.')
  }
  const { readSheet } = await import('read-excel-file/browser')
  let lembar: unknown[][]
  try {
    lembar = (await readSheet(berkas)) as unknown[][]
  } catch {
    throw new Error('File tidak bisa dibaca. Pastikan file Excel (.xlsx) tidak rusak dan tidak diberi kata sandi.')
  }
  if (lembar.length === 0) throw new Error('File kosong.')

  // Cocokkan judul kolom di baris pertama
  const judul = lembar[0].map(rapikanJudul)
  const posisi = {} as Record<KunciKolom, number>
  for (const k of KOLOM_IMPOR) {
    posisi[k.kunci] = judul.findIndex((j) => j === k.judul || k.alias.includes(j))
  }
  const hilang = KOLOM_IMPOR.filter((k) => k.wajib && posisi[k.kunci] < 0).map((k) => k.judul)
  if (hilang.length > 0) {
    throw new Error(`Kolom wajib tidak ditemukan di baris pertama: ${hilang.join(', ')}. Gunakan template yang disediakan.`)
  }

  const hasil: BarisImpor[] = []
  const sudahAda = new Map<string, number>()
  lembar.slice(1).forEach((sel, i) => {
    const data = {} as Record<KunciKolom, string>
    let galat: string | null = null
    for (const k of KOLOM_IMPOR) {
      const n = nilaiSel(posisi[k.kunci] >= 0 ? sel[posisi[k.kunci]] : null, k.kunci)
      data[k.kunci] = n.teks
      if (n.galat && !galat) galat = n.galat
    }
    if (Object.values(data).every((v) => v === '')) return // lewati baris kosong

    const baris = i + 2
    galat = galat ?? periksaBaris(data)
    const kunci = data.nomor_induk.toLowerCase()
    if (!galat && sudahAda.has(kunci)) galat = `Nomor induk sama dengan baris ${sudahAda.get(kunci)}.`
    if (kunci && !sudahAda.has(kunci)) sudahAda.set(kunci, baris)
    hasil.push({ baris, data, galat })
  })

  if (hasil.length === 0) throw new Error('Tidak ada baris data di bawah judul kolom.')
  return hasil
}

/** Mengunduh template Excel kosong (hanya baris judul kolom) */
export async function unduhTemplate(): Promise<void> {
  const { default: tulisXlsx } = await import('write-excel-file/browser')
  const judul = KOLOM_IMPOR.map((k) => ({ value: k.judul, fontWeight: 'bold' as const }))
  await tulisXlsx([judul], { columns: KOLOM_IMPOR.map((k) => ({ width: k.lebar })) }).toFile('template-anggota-simpus.xlsx')
}
