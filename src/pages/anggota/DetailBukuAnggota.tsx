import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { pesanGalat } from '../../lib/galat'
import { KeadaanKosong, SampulBuku, type BukuKatalog } from '../../components/anggota'
import { Lencana, type WarnaLencana } from '../../components/ui'

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
    <button onClick={kembali} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm text-slate-700 active:bg-slate-50">
      ‹ Kembali
    </button>
  )

  if (keadaan === 'memuat') return <p className="text-sm text-slate-500">Memuat...</p>
  if (keadaan !== 'ada' || !buku) {
    return (
      <div className="space-y-3">
        {tombolKembali}
        {keadaan === 'galat' ? (
          <p role="alert" className="rounded-lg bg-orange-50 px-3 py-2 text-sm text-orange-900">{galat}</p>
        ) : (
          <KeadaanKosong>Buku tidak ditemukan.</KeadaanKosong>
        )}
      </div>
    )
  }

  const tersedia = keteranganTersedia(buku)
  const baris: [string, React.ReactNode][] = [
    ['Penerbit', buku.penerbit ?? '-'],
    ['Tahun', buku.tahun_terbit ?? '-'],
    ['Kategori', buku.nama_kategori],
    ['Lokasi Rak', buku.lokasi_rak ?? '-'],
    ['Ketersediaan', <Lencana warna={tersedia.warna}>{tersedia.teks}</Lencana>],
  ]

  return (
    <div>
      {tombolKembali}
      <div className="mt-4 flex justify-center">
        <SampulBuku sampul={buku.sampul} judul={buku.judul} className="aspect-[2/3] w-40 text-5xl" />
      </div>

      <h1 className="mt-4 text-xl font-bold leading-snug text-slate-800">{buku.judul}</h1>
      <p className="italic text-slate-500">{buku.pengarang ?? '-'}</p>
      {!buku.dapat_dipinjam && (
        <div className="mt-2"><Lencana warna="biru">Hanya dibaca di tempat</Lencana></div>
      )}

      <table className="mt-4 w-full border border-slate-200 text-sm">
        <tbody className="divide-y divide-slate-200">
          {baris.map(([label, nilai]) => (
            <tr key={label}>
              <th className="w-2/5 border-r border-slate-200 bg-slate-50 px-3 py-2.5 text-left font-medium text-slate-600">{label}</th>
              <td className="px-3 py-2.5">{nilai}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="mt-5 font-bold text-slate-800">Sinopsis</h2>
      <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-700">{buku.sinopsis || 'Belum ada sinopsis.'}</p>

      <p className="mt-5 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-700">
        {buku.dapat_dipinjam
          ? 'Peminjaman dilakukan langsung di meja petugas perpustakaan.'
          : 'Buku ini hanya dapat dibaca di ruang perpustakaan dan tidak dapat dipinjam.'}
      </p>
    </div>
  )
}
