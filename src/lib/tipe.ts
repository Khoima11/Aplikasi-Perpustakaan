// Tipe data yang dipakai bersama di aplikasi (mengikuti tabel database)
export type Peran = 'petugas' | 'anggota'
export type StatusAktif = 'aktif' | 'nonaktif'
export type JenisAnggota = 'siswa' | 'guru'

export interface DataAnggotaSaya {
  id_anggota: number
  nomor_induk: string
  jenis_anggota: JenisAnggota
  kelas: string | null
}

export interface Profil {
  id: string
  nama: string
  username: string
  role: Peran
  status: StatusAktif
  wajib_ganti_password: boolean
  /** terisi hanya untuk peran anggota */
  anggota: DataAnggotaSaya | null
}

export function berandaUntuk(peran: Peran): string {
  return peran === 'petugas' ? '/petugas' : '/anggota'
}
