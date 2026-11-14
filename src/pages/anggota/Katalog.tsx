import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { atauMengandung } from '../../lib/cari'
import { pesanGalat } from '../../lib/galat'
import { KOLOM_KATALOG, KeadaanKosong, SampulBuku, ketersediaan, type BukuKatalog } from '../../components/anggota'
import { Lencana } from '../../components/ui'

const PER_MUAT = 20

export default function Katalog() {
  const [parameter, setParameter] = useSearchParams()
  const kata = parameter.get('cari') ?? ''
  const kategori = parameter.get('kategori') ?? ''
  const [ketikan, setKetikan] = useState(kata)
  const [daftarKategori, setDaftarKategori] = useState<{ id_kategori: number; nama_kategori: string }[]>([])
  const [buku, setBuku] = useState<BukuKatalog[]>([])
  const [total, setTotal] = useState(0)
  const [memuat, setMemuat] = useState(true)
  const [memuatLagi, setMemuatLagi] = useState(false)
  const [galat, setGalat] = useState('')

  useEffect(() => {
    void supabase.from('kategori').select('id_kategori, nama_kategori').order('nama_kategori').then(({ data }) => setDaftarKategori(data ?? []))
  }, [])

  // Pencarian berjalan sendiri sesaat setelah berhenti mengetik
  useEffect(() => {
    if (ketikan === kata) return
    const t = setTimeout(() => {
      const p = new URLSearchParams(parameter)
      if (ketikan.trim()) p.set('cari', ketikan.trim())
      else p.delete('cari')
      setParameter(p, { replace: true })
    }, 400)
    return () => clearTimeout(t)
  }, [ketikan, kata, parameter, setParameter])

  async function ambil(dari: number) {
    let q = supabase.from('v_ketersediaan_buku').select(KOLOM_KATALOG, { count: 'exact' })
    if (kata.trim()) q = q.or(atauMengandung(['judul', 'pengarang'], kata))
    if (kategori) q = q.eq('id_kategori', Number(kategori))
    return q.order('judul').order('id_buku').range(dari, dari + PER_MUAT - 1)
  }

  useEffect(() => {
    let batal = false
    setMemuat(true)
    setGalat('')
    void ambil(0).then(({ data, error, count }) => {
      if (batal) return
      if (error) setGalat(pesanGalat(error))
      setBuku((data ?? []) as BukuKatalog[])
      setTotal(count ?? 0)
      setMemuat(false)
    })
    return () => {
      batal = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kata, kategori])

  async function muatLagi() {
    setMemuatLagi(true)
    const { data, error } = await ambil(buku.length)
    if (error) setGalat(pesanGalat(error))
    else setBuku([...buku, ...((data ?? []) as BukuKatalog[])])
    setMemuatLagi(false)
  }

  function pilihKategori(id: string) {
    const p = new URLSearchParams(parameter)
    if (id) p.set('kategori', id)
    else p.delete('kategori')
    setParameter(p, { replace: true })
  }

  const kelasChip = (aktif: boolean) =>
    `min-h-11 shrink-0 rounded-full border px-4 text-sm ${aktif ? 'border-utama-700 bg-utama-700 font-medium text-white' : 'border-slate-300 bg-white text-slate-700'}`

  return (
    <div>
      <form role="search" onSubmit={(e) => e.preventDefault()}>
        <input
          type="search"
          enterKeyHint="search"
          className="h-12 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-utama-600 focus:ring-2 focus:ring-utama-100"
          placeholder="Cari judul atau pengarang..."
          value={ketikan}
          onChange={(e) => setKetikan(e.target.value)}
          aria-label="Cari buku"
        />
      </form>

      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Saring kategori">
        <button className={kelasChip(!kategori)} onClick={() => pilihKategori('')} aria-pressed={!kategori}>Semua</button>
        {daftarKategori.map((k) => (
          <button
            key={k.id_kategori}
            className={kelasChip(kategori === String(k.id_kategori))}
            onClick={() => pilihKategori(String(k.id_kategori))}
            aria-pressed={kategori === String(k.id_kategori)}
          >
            {k.nama_kategori}
          </button>
        ))}
      </div>

      {galat && <p role="alert" className="mt-3 rounded-lg bg-orange-50 px-3 py-2 text-sm text-orange-900">{galat}</p>}

      <p className="mt-3 text-sm text-slate-500" role="status">
        {memuat ? 'Mencari...' : `${total} judul buku`}
      </p>

      <div className="mt-2 space-y-3">
        {!memuat && buku.length === 0 && (
          <KeadaanKosong>{kata || kategori ? 'Tidak ada buku yang cocok. Coba kata kunci lain.' : 'Belum ada data buku.'}</KeadaanKosong>
        )}
        {buku.map((b) => {
          const k = ketersediaan(b)
          return (
            <Link key={b.id_buku} to={`/anggota/buku/${b.id_buku}`} className="flex gap-3 rounded-xl border border-slate-200 p-3 active:bg-slate-50">
              <SampulBuku sampul={b.sampul} judul={b.judul} />
              <div className="min-w-0 flex-1">
                <div className="font-semibold leading-snug text-slate-800">{b.judul}</div>
                <div className="truncate text-sm italic text-slate-500">{b.pengarang ?? '-'}</div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-700">
                  <Lencana warna={k.warna}>{k.teks}</Lencana>
                  {b.lokasi_rak && <span>Rak {b.lokasi_rak}</span>}
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {!memuat && buku.length < total && (
        <button
          onClick={() => void muatLagi()}
          disabled={memuatLagi}
          className="mt-4 h-12 w-full rounded-xl border border-slate-300 font-medium text-slate-700 active:bg-slate-50 disabled:opacity-60"
        >
          {memuatLagi ? 'Memuat...' : `Muat lebih banyak (${total - buku.length} lagi)`}
        </button>
      )}
    </div>
  )
}
