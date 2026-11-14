import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/KonteksAuth'
import { supabase } from '../../lib/supabase'
import { HARI_PERINGATAN_JATUH_TEMPO } from '../../lib/config'
import { pesanGalat } from '../../lib/galat'
import { formatTanggal } from '../../lib/tanggal'
import { KOLOM_KATALOG, KOLOM_PINJAMAN_SAYA, KartuPinjamanAktif, KeadaanKosong, SampulBuku, type BukuKatalog, type PinjamanSaya } from '../../components/anggota'

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

  return (
    <div className="space-y-5">
      <p className="text-lg">Halo, <b>{profil?.nama}</b></p>

      <form onSubmit={kirimCari} role="search">
        <input
          type="search"
          enterKeyHint="search"
          className="h-12 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-utama-600 focus:ring-2 focus:ring-utama-100"
          placeholder="Cari judul atau pengarang..."
          value={cari}
          onChange={(e) => setCari(e.target.value)}
          aria-label="Cari buku"
        />
      </form>

      {galat && <p role="alert" className="rounded-lg bg-orange-50 px-3 py-2 text-sm text-orange-900">{galat}</p>}

      {peringatan.length > 0 && (
        <section role="alert" className="rounded-xl border-2 border-dashed border-orange-300 bg-orange-50 p-4 text-orange-900">
          <h2 className="font-bold">Peringatan</h2>
          <ul className="mt-1 space-y-0.5 text-sm">
            {peringatan.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs">
            {adaTerlambat
              ? 'Segera kembalikan buku yang terlambat ke meja petugas perpustakaan.'
              : 'Kembalikan atau perpanjang di meja petugas sebelum jatuh tempo.'}
          </p>
        </section>
      )}

      <section>
        <h2 className="mb-2 font-bold text-slate-800">Pinjaman Aktif</h2>
        {pinjaman === null ? (
          <p className="text-sm text-slate-500">Memuat...</p>
        ) : pinjaman.length === 0 ? (
          <KeadaanKosong>Kamu sedang tidak meminjam buku.</KeadaanKosong>
        ) : (
          <div className="space-y-3">
            {pinjaman.map((p) => (
              <KartuPinjamanAktif key={p.id_detail} p={p} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-bold text-slate-800">Buku Baru</h2>
        {bukuBaru === null ? (
          <p className="text-sm text-slate-500">Memuat...</p>
        ) : bukuBaru.length === 0 ? (
          <KeadaanKosong>Belum ada data buku.</KeadaanKosong>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {bukuBaru.map((b) => (
              <Link key={b.id_buku} to={`/anggota/buku/${b.id_buku}`} className="block active:opacity-70">
                <SampulBuku sampul={b.sampul} judul={b.judul} className="aspect-[2/3] w-full text-2xl" />
                <div className="mt-1 line-clamp-2 text-center text-xs italic text-slate-700">{b.judul}</div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
