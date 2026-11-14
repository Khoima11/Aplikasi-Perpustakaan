// Menerjemahkan error dari database menjadi pesan Bahasa Indonesia yang mudah dipahami
interface GalatDb {
  message?: string
  code?: string
  details?: string | null
}

interface Pengganti {
  /** pesan untuk pelanggaran "harus unik" (kode 23505) */
  unik?: string
  /** pesan untuk "masih dipakai data lain" (kode 23503) */
  dipakai?: string
}

export function pesanGalat(galat: unknown, pengganti: Pengganti = {}): string {
  const g = (galat ?? {}) as GalatDb
  const pesan = g.message ?? ''
  switch (g.code) {
    case '23505':
      return pengganti.unik ?? 'Data dengan nilai yang sama sudah ada.'
    case '23503':
      return pengganti.dipakai ?? 'Data ini masih dipakai oleh data lain sehingga tidak bisa dihapus.'
    case '23514':
      return 'Ada isian yang nilainya tidak diperbolehkan. Periksa kembali isian Anda.'
    case '23502':
      return 'Ada isian wajib yang masih kosong.'
    case '22001':
      return 'Ada isian yang terlalu panjang.'
    case '42501':
      // pesan dari fungsi sirkulasi ("Hanya petugas yang dapat ...") sudah jelas
      return /^Hanya petugas/.test(pesan) ? pesan : 'Anda tidak memiliki izin untuk melakukan tindakan ini.'
    case 'P0001': // pesan dari "raise exception" di fungsi/trigger kita, sudah berbahasa Indonesia
      return pesan
    case 'PGRST116':
      return 'Data tidak ditemukan.'
  }
  if (/row-level security/i.test(pesan)) return 'Anda tidak memiliki izin untuk melakukan tindakan ini.'
  if (/failed to fetch|networkerror|load failed/i.test(pesan)) {
    return 'Tidak dapat terhubung ke server. Periksa koneksi internet.'
  }
  if (/jwt|token/i.test(pesan)) return 'Sesi login berakhir. Silakan login ulang.'
  return pesan || 'Terjadi kesalahan. Coba lagi.'
}
