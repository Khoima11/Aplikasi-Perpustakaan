// Pemanggil fungsi transaksi di database. Semua pemeriksaan aturan (AB-01..AB-10)
// dilakukan oleh fungsi itu sendiri; di sini hanya meneruskan dan menerjemahkan pesan.
import { supabase } from './supabase'
import { pesanGalat } from './galat'
import type { JenisAnggota, StatusAktif } from './tipe'

export type KondisiKembali = 'baik' | 'rusak' | 'hilang'
export type StatusDenda = 'tidak_ada' | 'belum_lunas' | 'lunas'

export interface Kelayakan {
  id_anggota: number
  nomor_induk: string
  nama: string
  jenis_anggota: JenisAnggota
  kelas: string | null
  status_anggota: StatusAktif
  pinjaman_aktif: number
  maks_pinjam: number
  sisa_kuota: number
  pinjaman_terlambat: number
  lama_pinjam_hari: number
  jatuh_tempo_jika_pinjam_hari_ini: string
  boleh_meminjam: boolean
  alasan: string | null
}

export interface PinjamanAktif {
  id_detail: number
  id_peminjaman: number
  nama_anggota: string
  nomor_induk_anggota: string
  jenis_anggota: JenisAnggota
  kelas: string | null
  judul: string
  nomor_induk_eksemplar: string
  tanggal_pinjam: string
  tanggal_jatuh_tempo: string
  jumlah_perpanjangan: number
  maks_perpanjangan: number
  hari_terlambat: number
  denda: number
  boleh_diperpanjang: boolean
  alasan_tidak_bisa_diperpanjang: string | null
  jatuh_tempo_jika_diperpanjang: string
}

async function panggil<T>(fungsi: string, argumen: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fungsi, argumen)
  if (error) throw new Error(pesanGalat(error))
  return data as T
}

export const cekKelayakanAnggota = (nomorInduk: string) =>
  panggil<Kelayakan>('cek_kelayakan_anggota', { p_nomor_induk: nomorInduk })

export const catatPeminjaman = (nomorIndukAnggota: string, daftarEksemplar: string[]) =>
  panggil<{ id_peminjaman: number; jumlah_buku: number; tanggal_jatuh_tempo: string; pesan: string }>('catat_peminjaman', {
    p_nomor_induk_anggota: nomorIndukAnggota,
    p_daftar_nomor_induk_eksemplar: daftarEksemplar,
  })

export const cariPinjamanAktif = (nomorIndukEksemplar: string) =>
  panggil<PinjamanAktif>('cari_pinjaman_aktif', { p_nomor_induk_eksemplar: nomorIndukEksemplar })

export const catatPengembalian = (
  nomorIndukEksemplar: string,
  kondisi: KondisiKembali,
  statusDenda: StatusDenda | null,
  catatan: string | null,
) =>
  panggil<{ hari_terlambat: number; denda: number; status_denda: StatusDenda; pesan: string }>('catat_pengembalian', {
    p_nomor_induk_eksemplar: nomorIndukEksemplar,
    p_kondisi: kondisi,
    p_status_denda: statusDenda,
    p_catatan: catatan,
  })

export const catatPerpanjangan = (nomorIndukEksemplar: string) =>
  panggil<{ jatuh_tempo_baru: string; jumlah_perpanjangan: number; pesan: string }>('catat_perpanjangan', {
    p_nomor_induk_eksemplar: nomorIndukEksemplar,
  })

export const tandaiDendaLunas = (idDetail: number) =>
  panggil<{ pesan: string }>('tandai_denda_lunas', { p_id_detail: idDetail })

/** Nomor transaksi yang tampil di bukti peminjaman, misalnya PJ-000015 */
export function nomorTransaksi(idPeminjaman: number): string {
  return `PJ-${String(idPeminjaman).padStart(6, '0')}`
}
