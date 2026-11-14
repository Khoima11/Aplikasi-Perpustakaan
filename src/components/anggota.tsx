// Komponen tampilan untuk halaman anggota (tampilan HP)
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { HARI_PERINGATAN_JATUH_TEMPO } from '../lib/config'
import { urlSampul } from '../lib/sampul'
import { formatTanggal } from '../lib/tanggal'
import { Lencana, type WarnaLencana } from './ui'

export interface BukuKatalog {
  id_buku: number
  judul: string
  pengarang: string | null
  nama_kategori: string
  lokasi_rak: string | null
  sampul: string | null
  dapat_dipinjam: boolean
  total_eksemplar: number
  tersedia: number
  dipinjam: number
}

export interface PinjamanSaya {
  id_detail: number
  id_buku: number
  judul: string
  pengarang: string | null
  sampul: string | null
  nomor_induk_eksemplar: string
  tanggal_pinjam: string
  tanggal_jatuh_tempo: string
  jumlah_perpanjangan: number
  /** negatif = sisa hari, 0 = jatuh tempo hari ini, positif = hari terlambat */
  hari_lewat_jatuh_tempo: number | null
  tanggal_kembali: string | null
  kondisi_kembali: 'baik' | 'rusak' | 'hilang' | null
  hari_terlambat: number
  denda: number
  status_denda: 'tidak_ada' | 'belum_lunas' | 'lunas'
  status: 'dipinjam' | 'dikembalikan' | 'hilang'
}

export const KOLOM_PINJAMAN_SAYA =
  'id_detail, id_buku, judul, pengarang, sampul, nomor_induk_eksemplar, tanggal_pinjam, tanggal_jatuh_tempo, jumlah_perpanjangan, hari_lewat_jatuh_tempo, tanggal_kembali, kondisi_kembali, hari_terlambat, denda, status_denda, status'

export const KOLOM_KATALOG =
  'id_buku, judul, pengarang, nama_kategori, lokasi_rak, sampul, dapat_dipinjam, total_eksemplar, tersedia, dipinjam'

/** Gambar sampul; jika belum ada, tampil kotak berisi huruf awal judul */
export function SampulBuku({ sampul, judul, className = 'h-24 w-16 text-xl' }: { sampul: string | null; judul: string; className?: string }) {
  const url = urlSampul(sampul)
  return url ? (
    <img src={url} alt="" loading="lazy" className={`${className} shrink-0 rounded-md border border-slate-200 bg-slate-100 object-cover`} />
  ) : (
    <div
      aria-hidden="true"
      className={`${className} flex shrink-0 items-center justify-center rounded-md border border-utama-100 bg-utama-50 font-bold text-utama-600`}
    >
      {judul.trim().charAt(0).toUpperCase() || '?'}
    </div>
  )
}

/** Keterangan ketersediaan: hijau = tersedia, oranye = semua dipinjam */
export function ketersediaan(b: Pick<BukuKatalog, 'dapat_dipinjam' | 'total_eksemplar' | 'tersedia' | 'dipinjam'>): {
  teks: string
  warna: WarnaLencana
} {
  if (!b.dapat_dipinjam) return { teks: 'Baca di tempat', warna: 'biru' }
  if (b.total_eksemplar === 0) return { teks: 'Belum ada eksemplar', warna: 'abu' }
  if (b.tersedia > 0) return { teks: `Tersedia ${b.tersedia}/${b.total_eksemplar}`, warna: 'hijau' }
  if (b.dipinjam > 0) return { teks: 'Semua dipinjam', warna: 'oranye' }
  return { teks: 'Tidak tersedia', warna: 'abu' }
}

/** Penanda sisa hari / terlambat untuk pinjaman aktif */
export function LencanaJatuhTempo({ selisih }: { selisih: number | null }) {
  if (selisih === null) return null
  if (selisih > 0) return <Lencana warna="oranye">Terlambat {selisih} hari</Lencana>
  if (selisih === 0) return <Lencana warna="oranye">Jatuh tempo hari ini</Lencana>
  const sisa = -selisih
  return <Lencana warna={sisa <= HARI_PERINGATAN_JATUH_TEMPO ? 'oranye' : 'hijau'}>{sisa} hari lagi</Lencana>
}

export function KartuPinjamanAktif({ p, tampilTanggalPinjam = false }: { p: PinjamanSaya; tampilTanggalPinjam?: boolean }) {
  return (
    <Link to={`/anggota/buku/${p.id_buku}`} className="flex gap-3 rounded-xl border border-slate-200 p-3 active:bg-slate-50">
      <SampulBuku sampul={p.sampul} judul={p.judul} />
      <div className="min-w-0 flex-1">
        <div className="font-semibold leading-snug text-slate-800">{p.judul}</div>
        <div className="truncate text-sm italic text-slate-500">{p.pengarang ?? '-'}</div>
        {tampilTanggalPinjam && <div className="mt-1 text-sm text-slate-600">Pinjam: {formatTanggal(p.tanggal_pinjam)}</div>}
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-700">
          <span>Jatuh tempo: {formatTanggal(p.tanggal_jatuh_tempo)}</span>
          <LencanaJatuhTempo selisih={p.hari_lewat_jatuh_tempo} />
        </div>
      </div>
    </Link>
  )
}

export function KeadaanKosong({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">{children}</p>
}
