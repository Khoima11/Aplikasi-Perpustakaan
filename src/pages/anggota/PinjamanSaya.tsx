import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatRupiah } from '../../lib/format'
import { pesanGalat } from '../../lib/galat'
import { formatTanggal } from '../../lib/tanggal'
import { KOLOM_PINJAMAN_SAYA, KartuPinjamanAktif, KeadaanKosong, SampulBuku, type PinjamanSaya as Pinjaman } from '../../components/anggota'
import { Lencana, kelas } from '../../components/ui'

type Tab = 'aktif' | 'riwayat'

export default function PinjamanSaya() {
  const [tab, setTab] = useState<Tab>('aktif')
  const [aktif, setAktif] = useState<Pinjaman[] | null>(null)
  const [riwayat, setRiwayat] = useState<Pinjaman[] | null>(null)
  const [galat, setGalat] = useState('')

  useEffect(() => {
    let batal = false
    void Promise.all([
      supabase.from('v_pinjaman').select(KOLOM_PINJAMAN_SAYA).eq('status', 'dipinjam').order('tanggal_jatuh_tempo'),
      supabase.from('v_pinjaman').select(KOLOM_PINJAMAN_SAYA).neq('status', 'dipinjam').order('tanggal_kembali', { ascending: false }).limit(100),
    ]).then(([a, r]) => {
      if (batal) return
      if (a.error || r.error) setGalat(pesanGalat(a.error ?? r.error))
      setAktif((a.data ?? []) as Pinjaman[])
      setRiwayat((r.data ?? []) as Pinjaman[])
    })
    return () => {
      batal = true
    }
  }, [])

  const kelasTab = (t: Tab) => kelas.tab(tab === t)

  return (
    <div>
      <h1 className="text-xl font-semibold text-utama-900 md:text-2xl">Pinjaman Saya</h1>

      <div className={`mt-3 ${kelas.barisTab}`} role="tablist">
        <button role="tab" aria-selected={tab === 'aktif'} className={kelasTab('aktif')} onClick={() => setTab('aktif')}>
          Aktif{aktif ? ` (${aktif.length})` : ''}
        </button>
        <button role="tab" aria-selected={tab === 'riwayat'} className={kelasTab('riwayat')} onClick={() => setTab('riwayat')}>
          Riwayat
        </button>
      </div>

      {galat && <p role="alert" className="mt-3 rounded-xl bg-orange-50 px-3 py-2 text-sm text-orange-900">{galat}</p>}

      <div className="mt-4 grid gap-3 md:grid-cols-2" role="tabpanel">
        {tab === 'aktif' &&
          (aktif === null ? (
            <p className="text-sm text-slate-500">Memuat...</p>
          ) : aktif.length === 0 ? (
            <KeadaanKosong>Kamu sedang tidak meminjam buku.</KeadaanKosong>
          ) : (
            <>
              {aktif.map((p) => (
                <KartuPinjamanAktif key={p.id_detail} p={p} tampilTanggalPinjam />
              ))}
              <p className="text-xs text-slate-500 md:col-span-2">Pengembalian dan perpanjangan dilakukan di meja petugas perpustakaan.</p>
            </>
          ))}

        {tab === 'riwayat' &&
          (riwayat === null ? (
            <p className="text-sm text-slate-500">Memuat...</p>
          ) : riwayat.length === 0 ? (
            <KeadaanKosong>Belum ada riwayat pinjaman.</KeadaanKosong>
          ) : (
            riwayat.map((p) => (
              <Link key={p.id_detail} to={`/anggota/buku/${p.id_buku}`} className="flex gap-4 rounded-2xl border border-utama-100/70 bg-white p-3 shadow-kartu transition active:scale-[0.99]">
                <SampulBuku sampul={p.sampul} judul={p.judul} className="h-28 w-[4.7rem]" />
                <div className="min-w-0 flex-1 text-sm text-slate-700">
                  <div className="line-clamp-2 text-base font-semibold leading-snug text-utama-900">{p.judul}</div>
                  <div className="truncate text-slate-500">{p.pengarang ?? '-'}</div>
                  <div className="mt-1">Pinjam: {formatTanggal(p.tanggal_pinjam)}</div>
                  <div>{p.status === 'hilang' ? 'Dicatat hilang' : 'Kembali'}: {formatTanggal(p.tanggal_kembali)}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {p.status === 'hilang' ? (
                      <Lencana warna="merah">Hilang</Lencana>
                    ) : p.hari_terlambat > 0 ? (
                      <Lencana warna="oranye">Terlambat {p.hari_terlambat} hari</Lencana>
                    ) : (
                      <Lencana warna="hijau">Tepat waktu</Lencana>
                    )}
                    {p.kondisi_kembali === 'rusak' && <Lencana warna="oranye">Kembali rusak</Lencana>}
                    {Number(p.denda) > 0 && (
                      <Lencana warna={p.status_denda === 'lunas' ? 'abu' : 'oranye'}>
                        Denda {formatRupiah(p.denda)} ({p.status_denda === 'lunas' ? 'lunas' : 'belum lunas'})
                      </Lencana>
                    )}
                  </div>
                </div>
              </Link>
            ))
          ))}
      </div>
    </div>
  )
}
