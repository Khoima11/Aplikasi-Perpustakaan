import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { atauMengandung } from '../../lib/cari'
import { pesanGalat } from '../../lib/galat'
import { KOLOM_KATALOG, KeadaanKosong, KolomCari, SampulBuku, ketersediaan, type BukuKatalog } from '../../components/anggota'
import { Lencana, kelas } from '../../components/ui'

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

  return (
    <div>
      <h1 className="mb-3 text-xl font-semibold text-utama-900 md:text-2xl">Katalog Buku</h1>
      <form role="search" onSubmit={(e) => e.preventDefault()} className="md:max-w-xl">
        <KolomCari placeholder="Cari judul atau pengarang..." value={ketikan} onChange={(e) => setKetikan(e.target.value)} aria-label="Cari buku" />
      </form>

      <div className={`mt-4 ${kelas.barisTab}`} role="group" aria-label="Saring kategori">
        <button className={kelas.tab(!kategori)} onClick={() => pilihKategori('')} aria-pressed={!kategori}>Semua</button>
        {daftarKategori.map((k) => (
          <button
            key={k.id_kategori}
            className={kelas.tab(kategori === String(k.id_kategori))}
            onClick={() => pilihKategori(String(k.id_kategori))}
            aria-pressed={kategori === String(k.id_kategori)}
          >
            {k.nama_kategori}
          </button>
        ))}
      </div>

      {galat && <p role="alert" className="mt-3 rounded-xl bg-orange-50 px-3 py-2 text-sm text-orange-900">{galat}</p>}

      <p className="mt-4 text-sm text-slate-500" role="status">
        {memuat ? 'Mencari...' : `${total} judul buku`}
      </p>

      {!memuat && buku.length === 0 && (
        <div className="mt-2">
          <KeadaanKosong>{kata || kategori ? 'Tidak ada buku yang cocok. Coba kata kunci lain.' : 'Belum ada data buku.'}</KeadaanKosong>
        </div>
      )}

      <div className="mt-3 grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 sm:gap-x-4 md:grid-cols-5 lg:grid-cols-6">
        {buku.map((b) => {
          const k = ketersediaan(b)
          return (
            <Link key={b.id_buku} to={`/anggota/buku/${b.id_buku}`} className="group flex flex-col active:opacity-80">
              <SampulBuku sampul={b.sampul} judul={b.judul} ukuran="sedang" className="aspect-[2/3] w-full transition group-hover:-translate-y-0.5" />
              <div className="mt-2 line-clamp-2 text-[13px] font-semibold leading-snug text-utama-900 sm:text-sm">{b.judul}</div>
              <div className="truncate text-xs text-slate-500">{b.pengarang ?? '-'}</div>
              <div className="mt-1.5 flex flex-col items-start gap-1 text-xs text-slate-600">
                <Lencana warna={k.warna}>{k.teks}</Lencana>
                {b.lokasi_rak && <span>Rak {b.lokasi_rak}</span>}
              </div>
            </Link>
          )
        })}
      </div>

      {!memuat && buku.length < total && (
        <button onClick={() => void muatLagi()} disabled={memuatLagi} className={`${kelas.tombol} mt-6 w-full`}>
          {memuatLagi ? 'Memuat...' : `Muat lebih banyak (${total - buku.length} lagi)`}
        </button>
      )}
    </div>
  )
}
