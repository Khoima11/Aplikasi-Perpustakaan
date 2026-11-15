// Komponen tampilan kecil yang dipakai di banyak halaman
import { useEffect, type ReactNode } from 'react'

export const kelas = {
  input:
    'h-11 w-full rounded-xl border border-utama-100 bg-white px-3.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-utama-400 focus:ring-4 focus:ring-utama-100 disabled:bg-utama-50 disabled:text-slate-500',
  area:
    'w-full rounded-xl border border-utama-100 bg-white px-3.5 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-utama-400 focus:ring-4 focus:ring-utama-100',
  label: 'mb-1.5 block text-sm font-medium text-slate-700',
  tombolUtama:
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-utama-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-utama-700 active:scale-[0.98] disabled:opacity-60',
  tombol:
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-utama-200 bg-white px-5 text-sm font-medium text-utama-800 transition hover:bg-utama-50 active:scale-[0.98] disabled:opacity-60',
  tombolBahaya:
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-orange-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700 active:scale-[0.98] disabled:opacity-60',
  tombolKecil:
    'inline-flex min-h-9 items-center justify-center whitespace-nowrap rounded-full border border-utama-200 bg-white px-3 text-xs font-medium text-utama-800 transition hover:bg-utama-50 disabled:cursor-not-allowed disabled:opacity-50',
  kartu: 'rounded-2xl border border-utama-100/70 bg-white shadow-kartu',
  th: 'whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-utama-800',
  td: 'px-3 py-3 align-middle text-sm',
  /** tab berbentuk pil (dipakai Data Anggota, Laporan, Pinjaman Saya) */
  tab: (aktif: boolean) =>
    `min-h-11 shrink-0 whitespace-nowrap rounded-full px-5 text-sm font-medium transition ${
      aktif ? 'bg-utama-600 text-white shadow-sm' : 'bg-white text-slate-600 ring-1 ring-utama-100 hover:bg-utama-50'
    }`,
  barisTab: 'tanpa-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1',
}

export type WarnaLencana = 'hijau' | 'oranye' | 'biru' | 'abu' | 'merah'
const warnaLencana: Record<WarnaLencana, string> = {
  hijau: 'bg-green-100 text-green-800',
  oranye: 'bg-orange-100 text-orange-800',
  biru: 'bg-utama-100 text-utama-800',
  abu: 'bg-slate-100 text-slate-700',
  merah: 'bg-red-100 text-red-800',
}

export function Lencana({ warna = 'abu', children }: { warna?: WarnaLencana; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${warnaLencana[warna]}`}>
      {children}
    </span>
  )
}

export interface Pesan {
  jenis: 'sukses' | 'galat' | 'info'
  teks: string
}

export function Pemberitahuan({ pesan, onTutup }: { pesan: Pesan | null; onTutup?: () => void }) {
  if (!pesan) return null
  const gaya =
    pesan.jenis === 'sukses'
      ? 'border-green-200 bg-green-50 text-green-800'
      : pesan.jenis === 'galat'
        ? 'border-orange-200 bg-orange-50 text-orange-900'
        : 'border-utama-100 bg-utama-50 text-utama-800'
  return (
    <div role={pesan.jenis === 'galat' ? 'alert' : 'status'} className={`flex items-start gap-3 rounded-xl border px-3 py-2 text-sm ${gaya}`}>
      <span className="flex-1 whitespace-pre-line">{pesan.teks}</span>
      {onTutup && (
        <button onClick={onTutup} aria-label="Tutup pesan" className="-mr-1 rounded px-1.5 text-base leading-none opacity-70 hover:opacity-100">
          ×
        </button>
      )}
    </div>
  )
}

export function KartuRingkas({ label, nilai, warna }: { label: string; nilai: ReactNode; warna?: 'oranye' | 'hijau' }) {
  const warnaNilai = warna === 'oranye' ? 'text-orange-600' : warna === 'hijau' ? 'text-green-700' : 'text-utama-900'
  return (
    <div className={`${kelas.kartu} relative overflow-hidden p-4 text-center print:p-2 print:shadow-none`}>
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-utama-400 print:hidden" />
      <div className="text-sm text-slate-500 print:text-xs">{label}</div>
      <div className={`mt-1 text-3xl font-bold print:mt-0 print:text-xl ${warnaNilai}`}>{nilai}</div>
    </div>
  )
}

export function Modal({
  judul,
  onTutup,
  children,
  lebar = 'max-w-lg',
}: {
  judul: string
  onTutup: () => void
  children: ReactNode
  lebar?: string
}) {
  useEffect(() => {
    const tekan = (e: KeyboardEvent) => e.key === 'Escape' && onTutup()
    window.addEventListener('keydown', tekan)
    return () => window.removeEventListener('keydown', tekan)
  }, [onTutup])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-utama-900/40 p-4 backdrop-blur-[2px] sm:items-center" role="dialog" aria-modal="true" aria-label={judul}>
      <div className={`w-full ${lebar} rounded-2xl bg-white shadow-2xl`}>
        <div className="flex items-center justify-between border-b border-utama-100 px-5 py-3.5">
          <h2 className="text-lg font-semibold text-slate-800">{judul}</h2>
          <button onClick={onTutup} aria-label="Tutup" className="flex h-10 w-10 items-center justify-center rounded-full text-xl text-slate-500 hover:bg-utama-50">
            ×
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

export function Konfirmasi({
  judul,
  children,
  labelYa,
  bahaya = false,
  sibuk = false,
  onYa,
  onBatal,
}: {
  judul: string
  children: ReactNode
  labelYa: string
  bahaya?: boolean
  sibuk?: boolean
  onYa: () => void
  onBatal: () => void
}) {
  return (
    <Modal judul={judul} onTutup={onBatal} lebar="max-w-md">
      <div className="text-sm text-slate-700">{children}</div>
      <div className="mt-5 flex justify-end gap-2">
        <button className={kelas.tombol} onClick={onBatal} disabled={sibuk}>Batal</button>
        <button className={bahaya ? kelas.tombolBahaya : kelas.tombolUtama} onClick={onYa} disabled={sibuk}>
          {sibuk ? 'Memproses...' : labelYa}
        </button>
      </div>
    </Modal>
  )
}

export function Paginasi({ halaman, totalHalaman, onUbah }: { halaman: number; totalHalaman: number; onUbah: (h: number) => void }) {
  if (totalHalaman <= 1) return null
  return (
    <div className="mt-3 flex items-center justify-end gap-2 text-sm">
      <button className={kelas.tombolKecil} disabled={halaman <= 1} onClick={() => onUbah(halaman - 1)} aria-label="Halaman sebelumnya">‹ Sebelumnya</button>
      <span className="px-1 text-slate-600">Halaman {halaman} dari {totalHalaman}</span>
      <button className={kelas.tombolKecil} disabled={halaman >= totalHalaman} onClick={() => onUbah(halaman + 1)} aria-label="Halaman berikutnya">Berikutnya ›</button>
    </div>
  )
}

/** Baris tabel untuk keadaan memuat / kosong */
export function BarisInfo({ kolom, children }: { kolom: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={kolom} className="px-3 py-8 text-center text-sm text-slate-500">{children}</td>
    </tr>
  )
}

export function JudulHalaman({ children, aksi }: { children: ReactNode; aksi?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold text-utama-900">{children}</h1>
      {aksi}
    </div>
  )
}
