import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { pesanGalat } from '../../lib/galat'
import { formatRupiah } from '../../lib/format'
import type { JenisAnggota } from '../../lib/tipe'
import { BarisInfo, JudulHalaman, Pemberitahuan, kelas, type Pesan } from '../../components/ui'

interface Aturan {
  id_aturan: number
  jenis_anggota: JenisAnggota
  maks_pinjam: number
  lama_pinjam_hari: number
  maks_perpanjangan: number
  denda_per_hari: number
}

const namaJenis: Record<JenisAnggota, string> = { siswa: 'Siswa', guru: 'Guru' }

export default function Pengaturan() {
  const [daftar, setDaftar] = useState<Aturan[]>([])
  const [memuat, setMemuat] = useState(true)
  const [jenis, setJenis] = useState<JenisAnggota>('siswa')
  const [form, setForm] = useState({ maks_pinjam: '', lama_pinjam_hari: '', maks_perpanjangan: '', denda_per_hari: '' })
  const [sibuk, setSibuk] = useState(false)
  const [pesan, setPesan] = useState<Pesan | null>(null)

  const isiForm = useCallback((a: Aturan | undefined) => {
    setForm({
      maks_pinjam: a ? String(a.maks_pinjam) : '',
      lama_pinjam_hari: a ? String(a.lama_pinjam_hari) : '',
      maks_perpanjangan: a ? String(a.maks_perpanjangan) : '',
      denda_per_hari: a ? String(Number(a.denda_per_hari)) : '',
    })
  }, [])

  const muat = useCallback(async () => {
    const { data, error } = await supabase
      .from('aturan_peminjaman')
      .select('id_aturan, jenis_anggota, maks_pinjam, lama_pinjam_hari, maks_perpanjangan, denda_per_hari')
      .order('jenis_anggota')
    if (error) setPesan({ jenis: 'galat', teks: pesanGalat(error) })
    setMemuat(false)
    return (data ?? []) as Aturan[]
  }, [])

  useEffect(() => {
    void muat().then((d) => {
      setDaftar(d)
      isiForm(d.find((a) => a.jenis_anggota === 'siswa'))
    })
  }, [muat, isiForm])

  function pilih(j: JenisAnggota) {
    setJenis(j)
    isiForm(daftar.find((a) => a.jenis_anggota === j))
  }

  async function simpan(e: FormEvent) {
    e.preventDefault()
    setPesan(null)
    const angka = {
      maks_pinjam: Number(form.maks_pinjam),
      lama_pinjam_hari: Number(form.lama_pinjam_hari),
      maks_perpanjangan: Number(form.maks_perpanjangan),
      denda_per_hari: Number(form.denda_per_hari),
    }
    const bulat = (n: number) => Number.isInteger(n)
    if (form.maks_pinjam === '' || !bulat(angka.maks_pinjam) || angka.maks_pinjam < 1 || angka.maks_pinjam > 50) {
      return setPesan({ jenis: 'galat', teks: 'Maksimal buku dipinjam harus angka 1 sampai 50.' })
    }
    if (form.lama_pinjam_hari === '' || !bulat(angka.lama_pinjam_hari) || angka.lama_pinjam_hari < 1 || angka.lama_pinjam_hari > 365) {
      return setPesan({ jenis: 'galat', teks: 'Lama pinjam harus angka 1 sampai 365 hari.' })
    }
    if (form.maks_perpanjangan === '' || !bulat(angka.maks_perpanjangan) || angka.maks_perpanjangan < 0 || angka.maks_perpanjangan > 20) {
      return setPesan({ jenis: 'galat', teks: 'Maksimal perpanjangan harus angka 0 sampai 20.' })
    }
    if (form.denda_per_hari === '' || Number.isNaN(angka.denda_per_hari) || angka.denda_per_hari < 0 || angka.denda_per_hari > 1_000_000) {
      return setPesan({ jenis: 'galat', teks: 'Denda per hari harus angka 0 atau lebih (isi 0 jika tidak ada denda).' })
    }

    setSibuk(true)
    const { data, error } = await supabase
      .from('aturan_peminjaman')
      .update(angka)
      .eq('jenis_anggota', jenis)
      .select('id_aturan')
    setSibuk(false)
    if (error) return setPesan({ jenis: 'galat', teks: pesanGalat(error) })
    if (!data?.length) return setPesan({ jenis: 'galat', teks: 'Aturan tidak tersimpan. Pastikan Anda login sebagai petugas.' })

    const terbaru = await muat()
    setDaftar(terbaru)
    setPesan({ jenis: 'sukses', teks: `Aturan peminjaman ${namaJenis[jenis]} disimpan. Berlaku untuk transaksi berikutnya.` })
  }

  const kolomAngka = (kunci: keyof typeof form) => ({
    className: kelas.input,
    inputMode: 'numeric' as const,
    value: form[kunci],
    onChange: (e: { target: { value: string } }) => setForm({ ...form, [kunci]: e.target.value.replace(/[^0-9]/g, '') }),
  })

  return (
    <div>
      <JudulHalaman>Pengaturan Aturan Peminjaman</JudulHalaman>

      <section className={`${kelas.kartu} p-4`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-utama-100 bg-utama-50/70">
              <tr>
                <th className={kelas.th}>Jenis Anggota</th>
                <th className={kelas.th}>Maks. Buku Dipinjam</th>
                <th className={kelas.th}>Lama Pinjam (hari)</th>
                <th className={kelas.th}>Maks. Perpanjangan</th>
                <th className={kelas.th}>Denda per Hari</th>
                <th className={kelas.th}>Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-utama-100/70">
              {memuat ? (
                <BarisInfo kolom={6}>Memuat data...</BarisInfo>
              ) : (
                daftar.map((a) => (
                  <tr key={a.id_aturan} className={a.jenis_anggota === jenis ? 'bg-utama-50' : ''}>
                    <td className={`${kelas.td} font-medium`}>{namaJenis[a.jenis_anggota]}</td>
                    <td className={kelas.td}>{a.maks_pinjam} buku</td>
                    <td className={kelas.td}>{a.lama_pinjam_hari} hari</td>
                    <td className={kelas.td}>{a.maks_perpanjangan} kali</td>
                    <td className={kelas.td}>{formatRupiah(a.denda_per_hari)}</td>
                    <td className={kelas.td}>
                      <button className={kelas.tombolKecil} onClick={() => pilih(a.jenis_anggota)}>Edit</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-4">
        <Pemberitahuan pesan={pesan} onTutup={() => setPesan(null)} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className={`${kelas.kartu} p-4`}>
          <h2 className="text-lg font-semibold">Form Aturan</h2>
          <form onSubmit={simpan} className="mt-3 space-y-3">
            <div>
              <label className={kelas.label} htmlFor="jenis">Jenis Anggota</label>
              <select id="jenis" className={kelas.input} value={jenis} onChange={(e) => pilih(e.target.value as JenisAnggota)}>
                <option value="siswa">Siswa</option>
                <option value="guru">Guru</option>
              </select>
            </div>
            <div>
              <label className={kelas.label} htmlFor="maks">Maksimal Buku Dipinjam</label>
              <input id="maks" {...kolomAngka('maks_pinjam')} />
            </div>
            <div>
              <label className={kelas.label} htmlFor="lama">Lama Pinjam (hari)</label>
              <input id="lama" {...kolomAngka('lama_pinjam_hari')} />
            </div>
            <div>
              <label className={kelas.label} htmlFor="perpanjangan">Maksimal Perpanjangan</label>
              <input id="perpanjangan" {...kolomAngka('maks_perpanjangan')} />
            </div>
            <div>
              <label className={kelas.label} htmlFor="denda">Denda per Hari dalam rupiah (isi 0 jika tidak ada denda)</label>
              <input id="denda" {...kolomAngka('denda_per_hari')} />
            </div>
            <div className="flex gap-2">
              <button className={kelas.tombolUtama} type="submit" disabled={sibuk || memuat}>{sibuk ? 'Menyimpan...' : 'Simpan'}</button>
              <button className={kelas.tombol} type="button" onClick={() => pilih(jenis)}>Batal</button>
            </div>
          </form>
        </section>

        <section className={`${kelas.kartu} self-start p-4`}>
          <h2 className="text-lg font-semibold">Keterangan</h2>
          <p className="mt-2 text-sm italic text-slate-600">
            Perubahan aturan berlaku untuk transaksi baru. Jatuh tempo pada pinjaman yang sudah tercatat tidak berubah.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
            <li>Jatuh tempo dihitung dari tanggal pinjam ditambah lama pinjam, lalu disimpan saat transaksi.</li>
            <li>Denda dihitung saat buku dikembalikan: hari terlambat dikali denda per hari yang berlaku saat itu.</li>
            <li>Perpanjangan ditolak jika pinjaman sudah terlambat atau batas perpanjangan tercapai.</li>
          </ul>
        </section>
      </div>
    </div>
  )
}
