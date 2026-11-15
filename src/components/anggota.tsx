// Komponen tampilan untuk halaman anggota (tampilan HP)
import type { InputHTMLAttributes, ReactNode } from 'react'
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

// Warna sampul pengganti (untuk buku yang belum punya gambar), dipilih tetap per judul
const WARNA_SAMPUL = [
  ['#875424', '#b97b34'],
  ['#2f5d50', '#4f8a78'],
  ['#6c431f', '#a0662a'],
  ['#5b4a7a', '#8a75ad'],
  ['#3d5a5b', '#6b9091'],
  ['#2d4f6c', '#4f7ea3'],
  ['#57371c', '#875424'],
  ['#4b5d2a', '#7a924a'],
]

function warnaUntuk(judul: string): string[] {
  let h = 0
  for (const c of judul) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return WARNA_SAMPUL[h % WARNA_SAMPUL.length]
}

/**
 * Gambar sampul buku. Jika belum ada gambar, tampil sampul pengganti
 * berwarna dengan judul tertulis di atasnya.
 * `ukuran` mengatur besar huruf judul: kecil (daftar), sedang (kisi katalog), besar (detail).
 */
export function SampulBuku({
  sampul,
  judul,
  className = 'h-24 w-16',
  ukuran = 'kecil',
}: {
  sampul: string | null
  judul: string
  className?: string
  ukuran?: 'kecil' | 'sedang' | 'besar'
}) {
  const url = urlSampul(sampul)
  if (url) {
    return <img src={url} alt="" loading="lazy" className={`${className} shrink-0 rounded-lg bg-utama-50 object-cover shadow-sampul`} />
  }
  const [gelap, terang] = warnaUntuk(judul)
  const huruf = ukuran === 'besar' ? 'text-lg' : ukuran === 'sedang' ? 'text-[11px] sm:text-sm' : 'text-[7px]'
  return (
    <div
      aria-hidden="true"
      className={`${className} relative flex shrink-0 flex-col overflow-hidden rounded-lg shadow-sampul`}
      style={{ background: `linear-gradient(150deg, ${terang}, ${gelap})` }}
    >
      <span className="absolute inset-y-0 left-0 w-[7%] bg-black/20" />
      <span className="absolute inset-y-0 left-[7%] w-px bg-white/25" />
      <span className="absolute -right-6 -bottom-6 h-1/2 w-2/3 rounded-full bg-white/10" />
      <span
        className={`relative mt-[18%] ml-[14%] mr-[8%] line-clamp-4 font-semibold leading-tight text-white/95 ${huruf}`}
        style={{ textShadow: '0 1px 2px rgb(0 0 0 / 0.25)' }}
      >
        {judul}
      </span>
      <span className="relative mt-auto mb-[12%] ml-[14%] h-0.5 w-1/3 rounded-full bg-white/50" />
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
  const terlambat = (p.hari_lewat_jatuh_tempo ?? -99) > 0
  return (
    <Link
      to={`/anggota/buku/${p.id_buku}`}
      className={`flex gap-4 rounded-2xl border bg-white p-3 shadow-kartu transition active:scale-[0.99] ${
        terlambat ? 'border-orange-200' : 'border-utama-100/70'
      }`}
    >
      <SampulBuku sampul={p.sampul} judul={p.judul} className="h-28 w-[4.7rem]" />
      <div className="min-w-0 flex-1 py-0.5">
        <div className="line-clamp-2 font-semibold leading-snug text-utama-900">{p.judul}</div>
        <div className="truncate text-sm text-slate-500">{p.pengarang ?? '-'}</div>
        {tampilTanggalPinjam && <div className="mt-1.5 text-sm text-slate-600">Pinjam: {formatTanggal(p.tanggal_pinjam)}</div>}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-700">
          <span>Jatuh tempo: {formatTanggal(p.tanggal_jatuh_tempo)}</span>
          <LencanaJatuhTempo selisih={p.hari_lewat_jatuh_tempo} />
        </div>
      </div>
    </Link>
  )
}

export function KeadaanKosong({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-utama-200 bg-white/60 px-4 py-8 text-center text-sm text-slate-500">{children}</p>
}

/** Judul bagian dengan tautan "Lihat semua" opsional di kanan (seperti "More" di referensi) */
export function JudulBagian({ children, ke, teksTautan = 'Lihat semua' }: { children: ReactNode; ke?: string; teksTautan?: string }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 className="text-lg font-semibold text-utama-900">{children}</h2>
      {ke && (
        <Link to={ke} className="flex min-h-11 items-center text-sm font-medium text-utama-600">
          {teksTautan} ›
        </Link>
      )}
    </div>
  )
}

/** Kolom pencarian berbentuk pil dengan ikon kaca pembesar */
export function KolomCari(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-utama-400" aria-hidden="true">
        <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zm10 3-5-5" />
      </svg>
      <input
        type="search"
        enterKeyHint="search"
        {...props}
        className="h-12 w-full rounded-full border border-utama-100 bg-white pr-4 pl-12 shadow-kartu outline-none transition placeholder:text-slate-400 focus:border-utama-400 focus:ring-4 focus:ring-utama-100"
      />
    </div>
  )
}
