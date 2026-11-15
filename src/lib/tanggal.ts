// Semua perhitungan tanggal memakai zona waktu Asia/Jakarta (WIB).
export const ZONA_WAKTU = 'Asia/Jakarta'

/** Tanggal hari ini di WIB dalam format YYYY-MM-DD */
export function hariIniWIB(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_WAKTU,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

/** Ubah tanggal (YYYY-MM-DD atau timestamp) menjadi DD/MM/YYYY menurut WIB */
export function formatTanggal(nilai: string | Date | null | undefined): string {
  if (!nilai) return '-'
  const d = typeof nilai === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(nilai)
    ? new Date(`${nilai}T00:00:00+07:00`)
    : new Date(nilai)
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: ZONA_WAKTU,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
}

/** Jam:menit menurut WIB */
export function formatJam(nilai: string | Date | null | undefined): string {
  if (!nilai) return '-'
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: ZONA_WAKTU,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(nilai))
}

/** Selisih hari kalender: tanggalB - tanggalA (keduanya YYYY-MM-DD) */
export function selisihHari(tanggalA: string, tanggalB: string): number {
  const a = Date.UTC(+tanggalA.slice(0, 4), +tanggalA.slice(5, 7) - 1, +tanggalA.slice(8, 10))
  const b = Date.UTC(+tanggalB.slice(0, 4), +tanggalB.slice(5, 7) - 1, +tanggalB.slice(8, 10))
  return Math.round((b - a) / 86_400_000)
}

/** Menggeser tanggal YYYY-MM-DD sebanyak n hari (boleh negatif) */
export function geserTanggal(tanggal: string, n: number): string {
  const d = new Date(Date.UTC(+tanggal.slice(0, 4), +tanggal.slice(5, 7) - 1, +tanggal.slice(8, 10) + n))
  return d.toISOString().slice(0, 10)
}

/** Tanggal 1 pada bulan dari tanggal yang diberikan */
export function awalBulan(tanggal: string): string {
  return `${tanggal.slice(0, 8)}01`
}

/** Awal hari (pukul 00.00 WIB) dari sebuah tanggal, untuk menyaring kolom waktu */
export function awalHariWIB(tanggal: string): string {
  return `${tanggal}T00:00:00+07:00`
}

/** Tanggal (YYYY-MM-DD) menurut WIB dari sebuah waktu */
export function tanggalWIB(waktu: string | Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_WAKTU, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(waktu))
}

/** Tanggal dan jam lengkap menurut WIB, misalnya 15/11/2026 14.05 */
export function formatWaktu(nilai: string | Date | null | undefined): string {
  if (!nilai) return '-'
  return `${formatTanggal(nilai)} ${formatJam(nilai)}`
}
