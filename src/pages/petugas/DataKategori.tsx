import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { pesanGalat } from '../../lib/galat'
import { BarisInfo, JudulHalaman, KartuRingkas, Konfirmasi, Pemberitahuan, kelas, type Pesan } from '../../components/ui'

interface Kategori {
  id_kategori: number
  nama_kategori: string
  keterangan: string | null
  jumlah_judul: number
}

const formKosong = { id: null as number | null, nama: '', keterangan: '' }

export default function DataKategori() {
  const [daftar, setDaftar] = useState<Kategori[]>([])
  const [memuat, setMemuat] = useState(true)
  const [cari, setCari] = useState('')
  const [kataKunci, setKataKunci] = useState('')
  const [form, setForm] = useState(formKosong)
  const [sibuk, setSibuk] = useState(false)
  const [pesan, setPesan] = useState<Pesan | null>(null)
  const [akanDihapus, setAkanDihapus] = useState<Kategori | null>(null)

  const muat = useCallback(async () => {
    const { data, error } = await supabase
      .from('kategori')
      .select('id_kategori, nama_kategori, keterangan, buku(count)')
      .order('nama_kategori')
    if (error) {
      setPesan({ jenis: 'galat', teks: pesanGalat(error) })
    } else {
      setDaftar(
        (data ?? []).map((k) => ({
          id_kategori: k.id_kategori,
          nama_kategori: k.nama_kategori,
          keterangan: k.keterangan,
          jumlah_judul: (k.buku as { count: number }[] | null)?.[0]?.count ?? 0,
        })),
      )
    }
    setMemuat(false)
  }, [])

  useEffect(() => {
    void muat()
  }, [muat])

  const tampil = useMemo(() => {
    const k = kataKunci.trim().toLowerCase()
    if (!k) return daftar
    return daftar.filter(
      (x) => x.nama_kategori.toLowerCase().includes(k) || (x.keterangan ?? '').toLowerCase().includes(k),
    )
  }, [daftar, kataKunci])

  const totalJudul = daftar.reduce((jumlah, k) => jumlah + k.jumlah_judul, 0)

  async function simpan(e: FormEvent) {
    e.preventDefault()
    const nama = form.nama.trim()
    if (!nama) return setPesan({ jenis: 'galat', teks: 'Nama kategori wajib diisi.' })
    setSibuk(true)
    const isi = { nama_kategori: nama, keterangan: form.keterangan.trim() || null }
    const { error } = form.id
      ? await supabase.from('kategori').update(isi).eq('id_kategori', form.id)
      : await supabase.from('kategori').insert(isi)
    setSibuk(false)
    if (error) {
      return setPesan({ jenis: 'galat', teks: pesanGalat(error, { unik: `Kategori "${nama}" sudah ada.` }) })
    }
    setPesan({ jenis: 'sukses', teks: form.id ? `Kategori "${nama}" diperbarui.` : `Kategori "${nama}" ditambahkan.` })
    setForm(formKosong)
    void muat()
  }

  async function hapus() {
    if (!akanDihapus) return
    setSibuk(true)
    const { error } = await supabase.from('kategori').delete().eq('id_kategori', akanDihapus.id_kategori)
    setSibuk(false)
    if (error) {
      setPesan({
        jenis: 'galat',
        teks: pesanGalat(error, {
          dipakai: `Kategori "${akanDihapus.nama_kategori}" masih dipakai oleh buku, jadi tidak bisa dihapus. Pindahkan dulu bukunya ke kategori lain.`,
        }),
      })
    } else {
      setPesan({ jenis: 'sukses', teks: `Kategori "${akanDihapus.nama_kategori}" dihapus.` })
      if (form.id === akanDihapus.id_kategori) setForm(formKosong)
      void muat()
    }
    setAkanDihapus(null)
  }

  return (
    <div>
      <JudulHalaman>Data Kategori</JudulHalaman>

      <div className="grid gap-4 sm:grid-cols-2">
        <KartuRingkas label="Total Kategori" nilai={daftar.length} />
        <KartuRingkas label="Total Judul Buku" nilai={totalJudul} />
      </div>

      <div className="mt-4">
        <Pemberitahuan pesan={pesan} onTutup={() => setPesan(null)} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_22rem]">
        <section className={`${kelas.kartu} p-4`}>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              setKataKunci(cari)
            }}
          >
            <input
              className={kelas.input}
              placeholder="Cari kategori..."
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              aria-label="Cari kategori"
            />
            <button className={kelas.tombol} type="submit">Cari</button>
          </form>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className={kelas.th}>No.</th>
                  <th className={kelas.th}>Nama Kategori</th>
                  <th className={kelas.th}>Keterangan</th>
                  <th className={kelas.th}>Jumlah Judul</th>
                  <th className={kelas.th}>Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {memuat ? (
                  <BarisInfo kolom={5}>Memuat data...</BarisInfo>
                ) : tampil.length === 0 ? (
                  <BarisInfo kolom={5}>{kataKunci ? 'Tidak ada kategori yang cocok.' : 'Belum ada kategori.'}</BarisInfo>
                ) : (
                  tampil.map((k, i) => (
                    <tr key={k.id_kategori} className={form.id === k.id_kategori ? 'bg-utama-50' : ''}>
                      <td className={kelas.td}>{i + 1}</td>
                      <td className={`${kelas.td} font-medium`}>{k.nama_kategori}</td>
                      <td className={`${kelas.td} text-slate-600`}>{k.keterangan || '-'}</td>
                      <td className={kelas.td}>{k.jumlah_judul}</td>
                      <td className={kelas.td}>
                        <div className="flex gap-1.5">
                          <button
                            className={kelas.tombolKecil}
                            onClick={() => setForm({ id: k.id_kategori, nama: k.nama_kategori, keterangan: k.keterangan ?? '' })}
                          >
                            Edit
                          </button>
                          <button className={kelas.tombolKecil} onClick={() => setAkanDihapus(k)}>Hapus</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className={`${kelas.kartu} self-start p-4`}>
          <h2 className="text-lg font-semibold">{form.id ? 'Ubah Kategori' : 'Tambah Kategori'}</h2>
          <form onSubmit={simpan} className="mt-3 space-y-3">
            <div>
              <label className={kelas.label} htmlFor="nama-kategori">Nama Kategori</label>
              <input
                id="nama-kategori"
                className={kelas.input}
                maxLength={50}
                value={form.nama}
                onChange={(e) => setForm({ ...form, nama: e.target.value })}
              />
            </div>
            <div>
              <label className={kelas.label} htmlFor="ket-kategori">Keterangan</label>
              <input
                id="ket-kategori"
                className={kelas.input}
                value={form.keterangan}
                onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <button className={kelas.tombolUtama} type="submit" disabled={sibuk}>
                {sibuk ? 'Menyimpan...' : 'Simpan'}
              </button>
              <button className={kelas.tombol} type="button" onClick={() => setForm(formKosong)}>Batal</button>
            </div>
          </form>
        </section>
      </div>

      {akanDihapus && (
        <Konfirmasi
          judul="Hapus kategori?"
          labelYa="Hapus"
          bahaya
          sibuk={sibuk}
          onYa={() => void hapus()}
          onBatal={() => setAkanDihapus(null)}
        >
          Kategori <b>{akanDihapus.nama_kategori}</b> akan dihapus.
          {akanDihapus.jumlah_judul > 0 && (
            <p className="mt-2 text-orange-700">
              Kategori ini masih dipakai {akanDihapus.jumlah_judul} judul buku, sehingga penghapusan akan ditolak.
            </p>
          )}
        </Konfirmasi>
      )}
    </div>
  )
}
