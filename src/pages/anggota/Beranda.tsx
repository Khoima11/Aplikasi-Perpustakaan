import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/KonteksAuth'
import { supabase } from '../../lib/supabase'
import { HARI_PERINGATAN_JATUH_TEMPO } from '../../lib/config'
import { pesanGalat } from '../../lib/galat'
import { formatTanggal } from '../../lib/tanggal'
import { JudulBagian, KOLOM_KATALOG, KOLOM_PINJAMAN_SAYA, KartuPinjamanAktif, KeadaanKosong, KolomCari, SampulBuku, type BukuKatalog, type PinjamanSaya } from '../../components/anggota'

/** Menyusun kalimat peringatan seperti di wireframe: per tanggal jatuh tempo dan per lama terlambat */
function susunPeringatan(pinjaman: PinjamanSaya[]): string[] {
  const terlambat = new Map<number, number>() // hari terlambat -> jumlah buku
  const segera = new Map<string, number>() // tanggal jatuh tempo -> jumlah buku
  for (const p of pinjaman) {
    const s = p.hari_lewat_jatuh_tempo
    if (s === null) continue
    if (s > 0) terlambat.set(s, (terlambat.get(s) ?? 0) + 1)
    else if (-s <= HARI_PERINGATAN_JATUH_TEMPO) segera.set(p.tanggal_jatuh_tempo, (segera.get(p.tanggal_jatuh_tempo) ?? 0) + 1)
  }
  const baris: string[] = []
  for (const [hari, jumlah] of [...terlambat].sort((a, b) => b[0] - a[0])) baris.push(`${jumlah} buku terlambat ${hari} hari`)
  for (const [tanggal, jumlah] of [...segera].sort((a, b) => a[0].localeCompare(b[0]))) baris.push(`${jumlah} buku jatuh tempo pada ${formatTanggal(tanggal)}`)
  return baris
}

export default function Beranda() {
  const { profil } = useAuth()
  const navigate = useNavigate()
  const [cari, setCari] = useState('')
  const [pinjaman, setPinjaman] = useState<PinjamanSaya[] | null>(null)
  const [bukuBaru, setBukuBaru] = useState<BukuKatalog[] | null>(null)
  const [galat, setGalat] = useState('')

  useEffect(() => {
    let batal = false
    void Promise.all([
      supabase.from('v_pinjaman').select(KOLOM_PINJAMAN_SAYA).eq('status', 'dipinjam').order('tanggal_jatuh_tempo'),
      supabase.from('v_ketersediaan_buku').select(KOLOM_KATALOG).order('tanggal_input', { ascending: false }).limit(6),
    ]).then(([a, b]) => {
      if (batal) return
      if (a.error || b.error) setGalat(pesanGalat(a.error ?? b.error))
      setPinjaman((a.data ?? []) as PinjamanSaya[])
      setBukuBaru((b.data ?? []) as BukuKatalog[])
    })
    return () => {
      batal = true
    }
  }, [])

  function kirimCari(e: FormEvent) {
    e.preventDefault()
    navigate(`/anggota/katalog${cari.trim() ? `?cari=${encodeURIComponent(cari.trim())}` : ''}`)
  }

  const peringatan = susunPeringatan(pinjaman ?? [])
  const adaTerlambat = (pinjaman ?? []).some((p) => (p.hari_lewat_jatuh_tempo ?? 0) > 0)

  const sapaan = (() => {
    const jam = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', hour12: false }).format(new Date()))
    return jam < 11 ? 'Selamat pagi' : jam < 15 ? 'Selamat siang' : jam < 18 ? 'Selamat sore' : 'Selamat malam'
  })()

  return (
    <div className="space-y-7">
      {/* Sapaan dan pencarian */}
      <section className="relative overflow-hidden rounded-3xl bg-utama-600 px-5 pt-5 pb-6 text-white shadow-kartu md:px-8 md:py-8">
        <div aria-hidden="true" className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/10" />
        <div aria-hidden="true" className="absolute -bottom-16 left-1/3 h-40 w-40 rounded-full bg-utama-800/25" />
        <p className="relative text-sm text-utama-100">{sapaan},</p>
        <p className="relative text-xl font-semibold md:text-2xl">Halo, {profil?.nama}</p>
        <p className="relative mt-1 text-sm text-white/80">Mau baca apa hari ini?</p>
        <form onSubmit={kirimCari} role="search" className="relative mt-4 md:max-w-xl">
          <KolomCari placeholder="Cari judul atau pengarang..." value={cari} onChange={(e) => setCari(e.target.value)} aria-label="Cari buku" />
        </form>
      </section>

      {galat && <p role="alert" className="rounded-xl bg-orange-50 px-3 py-2 text-sm text-orange-900">{galat}</p>}

      {peringatan.length > 0 && (
        <section role="alert" className="flex gap-3 rounded-2xl border border-orange-200 bg-orange-50 p-4 text-orange-900">
          <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100 text-lg font-bold text-orange-700">!</span>
          <div>
            <h2 className="font-semibold">Peringatan</h2>
            <ul className="mt-0.5 space-y-0.5 text-sm">
              {peringatan.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            <p className="mt-1.5 text-xs">
              {adaTerlambat
                ? 'Segera kembalikan buku yang terlambat ke meja petugas perpustakaan.'
                : 'Kembalikan atau perpanjang di meja petugas sebelum jatuh tempo.'}
            </p>
          </div>
        </section>
      )}

      <section>
        <JudulBagian ke={pinjaman && pinjaman.length > 0 ? '/anggota/pinjaman' : undefined}>Pinjaman Aktif</JudulBagian>
        {pinjaman === null ? (
          <p className="text-sm text-slate-500">Memuat...</p>
        ) : pinjaman.length === 0 ? (
          <KeadaanKosong>Kamu sedang tidak meminjam buku.</KeadaanKosong>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {pinjaman.map((p) => (
              <KartuPinjamanAktif key={p.id_detail} p={p} />
            ))}
          </div>
        )}
      </section>

      <section>
        <JudulBagian ke="/anggota/katalog">Buku Baru</JudulBagian>
        {bukuBaru === null ? (
          <p className="text-sm text-slate-500">Memuat...</p>
        ) : bukuBaru.length === 0 ? (
          <KeadaanKosong>Belum ada data buku.</KeadaanKosong>
        ) : (
          <div className="tanpa-scrollbar -mx-4 flex snap-x scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-6 md:overflow-visible md:px-0">
            {bukuBaru.map((b) => (
              <Link key={b.id_buku} to={`/anggota/buku/${b.id_buku}`} className="block w-32 shrink-0 snap-start active:opacity-80 md:w-auto">
                <SampulBuku sampul={b.sampul} judul={b.judul} ukuran="sedang" className="aspect-[2/3] w-full" />
                <div className="mt-2 line-clamp-2 text-sm font-medium leading-snug text-utama-900">{b.judul}</div>
                <div className="truncate text-xs text-slate-500">{b.pengarang ?? '-'}</div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
