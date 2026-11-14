// Konfigurasi umum aplikasi yang dibaca dari file .env
export const NAMA_SEKOLAH = import.meta.env.VITE_NAMA_SEKOLAH || 'Nama Sekolah'

// Domain email buatan untuk login. Pengguna cukup mengetik NIS/NIP/ID petugas,
// lalu aplikasi mengubahnya menjadi misalnya 12345@simpus.local
export const DOMAIN_EMAIL = 'simpus.local'

export function usernameKeEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${DOMAIN_EMAIL}`
}

// Peringatan "mendekati jatuh tempo" muncul sekian hari sebelum jatuh tempo
export const HARI_PERINGATAN_JATUH_TEMPO = 2
