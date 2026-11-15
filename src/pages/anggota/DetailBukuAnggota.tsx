import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { pesanGalat } from '../../lib/galat'
import { KeadaanKosong, SampulBuku, type BukuKatalog } from '../../components/anggota'
import { Lencana, kelas, type WarnaLencana } from '../../components/ui'

interface BukuLengkap extends BukuKatalog {
  penerbit: string | null
  tahun_terbit: number | null
  isbn: string | null
  sinopsis: string | null
}

function keteranganTersedia(b: BukuLengkap): { teks: string; warna: WarnaLencana } {
  if (b.total_eksemplar === 0) return { teks: 'Belum ada eksemplar', warna: 'abu' }
  if (b.tersedia > 0) return { teks: `${b.tersedia} dari ${b.total_eksemplar} eksemplar tersedia`, warna: 'hijau' }
  if (b.dipinjam > 0) return { teks: `Semua dipinjam (0 dari ${b.total_eksemplar})`, warna: 'oranye' }
  return { teks: 'Tidak tersedia', warna: 'abu' }
}

export default function DetailBukuAnggota() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [buku, setBuku] = useState<BukuLengkap | null>(null)
  const [keadaan, setKeadaan] = useState<'memuat' | 'ada' | 'tidak-ada' | 'galat'>('memuat')
  const [galat, setGalat] = useState('')

  useEffect(() => {
    const idBuku = Number(id)
    if (!Number.isInteger(idBuku) || idBuku <= 0) {
      setKeadaan('tidak-ada')
      return
    }
    let batal = false
    setKeadaan('memuat')
    void supabase
      .from('v_ketersediaan_buku')
      .select('id_buku, judul, pengarang, penerbit, tahun_terbit, isbn, nama_kategori, lokasi_rak, sinopsis, sampul, dapat_dipinjam, total_eksemplar, tersedia, dipinjam')
      .eq('id_buku', idBuku)
      .maybeSingle()
      .then(({ data, error }) => {
        if (batal) return
        if (error) {
          setGalat(pesanGalat(error))
          setKeadaan('galat')
        } else if (!data) setKeadaan('tidak-ada')
        else {
          setBuku(data as BukuLengkap)
          setKeadaan('ada')
        }
      })
    return () => {
      batal = true
    }
  }, [id])

  const kembali = () => (window.history.length > 1 ? navigate(-1) : navigate('/anggota/katalog'))
  const tombolKembali = (
    <button onClick={kembali} className={kelas.tombol}>
      ‹ Kembali
    </button>
  )

  if (keadaan === 'memuat') return <p className="text-sm text-slate-500">Memuat...</p>
  if (keadaan !== 'ada' || !buku) {
    return (
      <div className="space-y-3">
        {tombolKembali}
        {keadaan === 'galat' ? (
          <p role="alert" className="rounded-xl bg-orange-50 px-3 py-2 text-sm text-orange-900">{galat}</p>
        ) : (
          <KeadaanKosong>Buku tidak ditemukan.</KeadaanKosong>
        )}
      </div>
    )
  }

  const tersedia = keteranganTersedia(buku)
  const info: [string, ReactNode][] = [
    ['Penerbit', buku.penerbit ?? '-'],
    ['Tahun', buku.tahun_terbit ?? '-'],
    ['Kategori', buku.nama_kategori],
    ['Lokasi Rak', buku.lokasi_rak ?? '-'],
  ]

  return (
    <div>
      {tombolKembali}

      <div className="mt-5 md:grid md:grid-cols-[15rem_1fr] md:gap-10">
        {/* Sampul */}
        <div className="flex gap-4 md:block">
          <SampulBuku sampul={buku.sampul} judul={buku.judul} ukuran="besar" className="aspect-[2/3] w-32 sm:w-40 md:w-full" />
          {/* Judul di samping sampul (HP) */}
          <div className="min-w-0 flex-1 pt-1 md:hidden">
            <h1 className="text-xl font-bold leading-snug text-utama-900">{buku.judul}</h1>
            <p className="mt-0.5 text-slate-500">{buku.pengarang ?? '-'}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Lencana warna={tersedia.warna}>{tersedia.teks}</Lencana>
              {!buku.dapat_dipinjam && <Lencana warna="biru">Hanya dibaca di tempat</Lencana>}
            </div>
          </div>
        </div>

        <div className="mt-6 md:mt-0">
          {/* Judul (komputer) */}
          <div className="hidden md:block">
            <h1 className="text-3xl font-bold leading-tight text-utama-900">{buku.judul}</h1>
            <p className="mt-1 text-lg text-slate-500">{buku.pengarang ?? '-'}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Lencana warna={tersedia.warna}>{tersedia.teks}</Lencana>
              {!buku.dapat_dipinjam && <Lencana warna="biru">Hanya dibaca di tempat</Lencana>}
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-3 md:mt-6 lg:grid-cols-4">
            {info.map(([label, nilai]) => (
              <div key={label} className="rounded-2xl border border-utama-100/70 bg-white px-4 py-3 shadow-kartu">
                <dt className="text-xs text-slate-500">{label}</dt>
                <dd className="mt-0.5 font-medium text-utama-900">{nilai}</dd>
              </div>
            ))}
          </dl>


          <h2 className="mt-6 text-lg font-semibold text-utama-900">Sinopsis</h2>
          <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-slate-700">{buku.sinopsis || 'Belum ada sinopsis.'}</p>

          <p className="mt-6 flex items-start gap-3 rounded-2xl border border-utama-200 bg-utama-50 p-4 text-sm text-utama-900">
            <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-utama-100 font-bold text-utama-700">i</span>
            <span className="pt-1.5">
              {buku.dapat_dipinjam
                ? 'Peminjaman dilakukan langsung di meja petugas perpustakaan.'
                : 'Buku ini hanya dapat dibaca di ruang perpustakaan dan tidak dapat dipinjam.'}
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}
