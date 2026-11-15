import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { atauMengandung } from '../../lib/cari'
import { pesanGalat } from '../../lib/galat'
import { SampulBuku } from '../../components/anggota'
import { BarisInfo, JudulHalaman, Lencana, Paginasi, Pemberitahuan, kelas, type Pesan } from '../../components/ui'

interface BarisBuku {
  id_buku: number
  judul: string
  pengarang: string | null
  nama_kategori: string
  lokasi_rak: string | null
  sampul: string | null
  total_eksemplar: number
  tersedia: number
  dapat_dipinjam: boolean
}

const PER_HALAMAN = 20

export default function DataBuku() {
  const [cari, setCari] = useState('')
  const [kategori, setKategori] = useState('')
  const [saringan, setSaringan] = useState({ kata: '', kategori: '' })
  const [halaman, setHalaman] = useState(1)
  const [daftarKategori, setDaftarKategori] = useState<{ id_kategori: number; nama_kategori: string }[]>([])
  const [baris, setBaris] = useState<BarisBuku[]>([])
  const [total, setTotal] = useState(0)
  const [memuat, setMemuat] = useState(true)
  const [pesan, setPesan] = useState<Pesan | null>(null)

  useEffect(() => {
    void supabase
      .from('kategori')
      .select('id_kategori, nama_kategori')
      .order('nama_kategori')
      .then(({ data }) => setDaftarKategori(data ?? []))
  }, [])

  useEffect(() => {
    let batal = false
    setMemuat(true)
    ;(async () => {
      let q = supabase
        .from('v_ketersediaan_buku')
        .select('id_buku, judul, pengarang, nama_kategori, lokasi_rak, sampul, total_eksemplar, tersedia, dapat_dipinjam', {
          count: 'exact',
        })
      if (saringan.kata.trim()) q = q.or(atauMengandung(['judul', 'pengarang', 'isbn'], saringan.kata))
      if (saringan.kategori) q = q.eq('id_kategori', Number(saringan.kategori))
      const awal = (halaman - 1) * PER_HALAMAN
      const { data, error, count } = await q.order('judul').order('id_buku').range(awal, awal + PER_HALAMAN - 1)
      if (batal) return
      if (error) setPesan({ jenis: 'galat', teks: pesanGalat(error) })
      else {
        setBaris((data ?? []) as BarisBuku[])
        setTotal(count ?? 0)
      }
      setMemuat(false)
    })()
    return () => {
      batal = true
    }
  }, [saringan, halaman])

  function terapkan(e: FormEvent) {
    e.preventDefault()
    setHalaman(1)
    setSaringan({ kata: cari, kategori })
  }

  const totalHalaman = Math.max(1, Math.ceil(total / PER_HALAMAN))

  return (
    <div>
      <JudulHalaman>Data Buku</JudulHalaman>

      <form onSubmit={terapkan} className="flex flex-wrap gap-2">
        <input
          className={`${kelas.input} min-w-48 flex-1`}
          placeholder="Cari judul / pengarang / ISBN..."
          value={cari}
          onChange={(e) => setCari(e.target.value)}
          aria-label="Cari buku"
        />
        <select
          className={`${kelas.input} w-full sm:w-56`}
          value={kategori}
          onChange={(e) => setKategori(e.target.value)}
          aria-label="Saring kategori"
        >
          <option value="">Semua kategori</option>
          {daftarKategori.map((k) => (
            <option key={k.id_kategori} value={k.id_kategori}>{k.nama_kategori}</option>
          ))}
        </select>
        <button className={kelas.tombol} type="submit">Cari</button>
        <Link className={kelas.tombolUtama} to="/petugas/buku/baru">+ Tambah Buku</Link>
      </form>

      <div className="mt-3">
        <Pemberitahuan pesan={pesan} onTutup={() => setPesan(null)} />
      </div>

      <section className={`${kelas.kartu} mt-3 p-4`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-utama-100 bg-utama-50/70">
              <tr>
                <th className={kelas.th}>No.</th>
                <th className={kelas.th}>Judul</th>
                <th className={kelas.th}>Pengarang</th>
                <th className={kelas.th}>Kategori</th>
                <th className={kelas.th}>Lokasi Rak</th>
                <th className={kelas.th}>Eksemplar (Tersedia/Total)</th>
                <th className={kelas.th}>Dapat Dipinjam</th>
                <th className={kelas.th}>Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-utama-100/70">
              {memuat ? (
                <BarisInfo kolom={8}>Memuat data...</BarisInfo>
              ) : baris.length === 0 ? (
                <BarisInfo kolom={8}>
                  {saringan.kata || saringan.kategori ? 'Tidak ada buku yang cocok dengan pencarian.' : 'Belum ada data buku.'}
                </BarisInfo>
              ) : (
                baris.map((b, i) => (
                  <tr key={b.id_buku}>
                    <td className={kelas.td}>{(halaman - 1) * PER_HALAMAN + i + 1}</td>
                    <td className={kelas.td}>
                      <div className="flex items-center gap-3">
                        <SampulBuku sampul={b.sampul} judul={b.judul} className="h-12 w-8" />
                        <span className="font-medium text-utama-900">{b.judul}</span>
                      </div>
                    </td>
                    <td className={kelas.td}>{b.pengarang || '-'}</td>
                    <td className={kelas.td}>{b.nama_kategori}</td>
                    <td className={kelas.td}>{b.lokasi_rak || '-'}</td>
                    <td className={kelas.td}>
                      <Lencana warna={b.total_eksemplar === 0 ? 'abu' : b.tersedia > 0 ? 'hijau' : 'oranye'}>
                        {b.tersedia} / {b.total_eksemplar}
                      </Lencana>
                    </td>
                    <td className={kelas.td}>{b.dapat_dipinjam ? 'Ya' : <Lencana warna="biru">Baca di tempat</Lencana>}</td>
                    <td className={kelas.td}>
                      <Link className={kelas.tombolKecil} to={`/petugas/buku/${b.id_buku}`}>Detail / Edit</Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-2 text-sm text-slate-500">{total} judul buku</div>
        <Paginasi halaman={halaman} totalHalaman={totalHalaman} onUbah={setHalaman} />
      </section>
    </div>
  )
}
