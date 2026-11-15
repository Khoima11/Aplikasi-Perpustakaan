// Komponen tampilan kecil yang dipakai di banyak halaman
import { useEffect, type ReactNode } from 'react'

export const kelas = {
  input:
    'h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-utama-600 focus:ring-2 focus:ring-utama-100 disabled:bg-slate-100 disabled:text-slate-500',
  area:
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-utama-600 focus:ring-2 focus:ring-utama-100',
  label: 'mb-1 block text-sm font-medium text-slate-700',
  tombolUtama:
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-utama-700 px-4 text-sm font-semibold text-white hover:bg-utama-800 disabled:opacity-60',
  tombol:
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60',
  tombolBahaya:
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60',
  tombolKecil:
    'inline-flex min-h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50',
  kartu: 'rounded-xl border border-slate-200 bg-white',
  th: 'whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600',
  td: 'px-3 py-2.5 align-middle text-sm',
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
    <div role={pesan.jenis === 'galat' ? 'alert' : 'status'} className={`flex items-start gap-3 rounded-lg border px-3 py-2 text-sm ${gaya}`}>
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
  const warnaNilai = warna === 'oranye' ? 'text-orange-600' : warna === 'hijau' ? 'text-green-700' : 'text-slate-800'
  return (
    <div className={`${kelas.kartu} p-4 text-center print:p-2`}>
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
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label={judul}>
      <div className={`w-full ${lebar} rounded-xl bg-white shadow-xl`}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="text-lg font-semibold text-slate-800">{judul}</h2>
          <button onClick={onTutup} aria-label="Tutup" className="flex h-9 w-9 items-center justify-center rounded-lg text-xl text-slate-500 hover:bg-slate-100">
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
      <h1 className="text-2xl font-semibold text-slate-800">{children}</h1>
      {aksi}
    </div>
  )
}
