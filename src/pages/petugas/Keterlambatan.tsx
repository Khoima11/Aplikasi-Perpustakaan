import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { pesanGalat } from '../../lib/galat'
import { formatTanggal } from '../../lib/tanggal'
import { BarisInfo, JudulHalaman, KartuRingkas, Lencana, Modal, Pemberitahuan, kelas, type Pesan } from '../../components/ui'

interface Terlambat {
  id_detail: number
  tanggal_pinjam: string
  id_anggota: number
  nomor_induk_anggota: string
  nama_anggota: string
  jenis_anggota: string
  kelas: string | null
  no_hp: string | null
  nomor_induk_eksemplar: string
  judul: string
  tanggal_jatuh_tempo: string
  jumlah_perpanjangan: number
  hari_terlambat: number
}

type Urutan = 'terlama' | 'terbaru' | 'nama'

export default function Keterlambatan() {
  const [semua, setSemua] = useState<Terlambat[]>([])
  const [memuat, setMemuat] = useState(true)
  const [pesan, setPesan] = useState<Pesan | null>(null)
  const [cari, setCari] = useState('')
  const [kelasDipilih, setKelasDipilih] = useState('')
  const [urut, setUrut] = useState<Urutan>('terlama')
  const [saringan, setSaringan] = useState({ kata: '', kelas: '', urut: 'terlama' as Urutan })
  const [rinci, setRinci] = useState<Terlambat | null>(null)

  useEffect(() => {
    void supabase
      .from('v_keterlambatan')
      .select('*')
      .order('hari_terlambat', { ascending: false })
      .then(({ data, error }) => {
        if (error) setPesan({ jenis: 'galat', teks: pesanGalat(error) })
        else setSemua((data ?? []) as Terlambat[])
        setMemuat(false)
      })
  }, [])

  const daftarKelas = useMemo(
    () => [...new Set(semua.map((t) => t.kelas).filter((k): k is string => Boolean(k)))].sort((a, b) => a.localeCompare(b, 'id', { numeric: true })),
    [semua],
  )

  const tampil = useMemo(() => {
    const k = saringan.kata.trim().toLowerCase()
    const hasil = semua.filter(
      (t) =>
        (!saringan.kelas || t.kelas === saringan.kelas) &&
        (!k ||
          t.nama_anggota.toLowerCase().includes(k) ||
          t.nomor_induk_anggota.toLowerCase().includes(k) ||
          t.judul.toLowerCase().includes(k) ||
          t.nomor_induk_eksemplar.toLowerCase().includes(k)),
    )
    if (saringan.urut === 'terlama') hasil.sort((a, b) => b.hari_terlambat - a.hari_terlambat)
    else if (saringan.urut === 'terbaru') hasil.sort((a, b) => a.hari_terlambat - b.hari_terlambat)
    else hasil.sort((a, b) => a.nama_anggota.localeCompare(b.nama_anggota, 'id'))
    return hasil
  }, [semua, saringan])

  function terapkan(e: FormEvent) {
    e.preventDefault()
    setSaringan({ kata: cari, kelas: kelasDipilih, urut })
  }

  const jumlahAnggota = new Set(semua.map((t) => t.id_anggota)).size
  const lebih30 = semua.filter((t) => t.hari_terlambat > 30).length

  return (
    <div>
      <JudulHalaman>Daftar Keterlambatan</JudulHalaman>

      <div className="grid gap-4 sm:grid-cols-3">
        <KartuRingkas label="Total Pinjaman Terlambat" nilai={semua.length} warna={semua.length > 0 ? 'oranye' : undefined} />
        <KartuRingkas label="Anggota Terlambat" nilai={jumlahAnggota} />
        <KartuRingkas label="Terlambat > 30 Hari" nilai={lebih30} warna={lebih30 > 0 ? 'oranye' : undefined} />
      </div>

      <form onSubmit={terapkan} className="mt-4 flex flex-wrap gap-2">
        <input
          className={`${kelas.input} min-w-48 flex-1`}
          placeholder="Cari nama / NIS / judul..."
          value={cari}
          onChange={(e) => setCari(e.target.value)}
          aria-label="Cari keterlambatan"
        />
        <select className={`${kelas.input} w-full sm:w-44`} value={kelasDipilih} onChange={(e) => setKelasDipilih(e.target.value)} aria-label="Saring kelas">
          <option value="">Semua kelas</option>
          {daftarKelas.map((k) => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
        <select className={`${kelas.input} w-full sm:w-48`} value={urut} onChange={(e) => setUrut(e.target.value as Urutan)} aria-label="Urutan">
          <option value="terlama">Urut: terlama</option>
          <option value="terbaru">Urut: baru terlambat</option>
          <option value="nama">Urut: nama anggota</option>
        </select>
        <button className={kelas.tombol} type="submit">Tampilkan</button>
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
                <th className={kelas.th}>Nama Anggota</th>
                <th className={kelas.th}>Kelas</th>
                <th className={kelas.th}>Judul Buku</th>
                <th className={kelas.th}>No. Induk</th>
                <th className={kelas.th}>Jatuh Tempo</th>
                <th className={kelas.th}>Hari Terlambat</th>
                <th className={kelas.th}>Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-utama-100/70">
              {memuat ? (
                <BarisInfo kolom={8}>Memuat data...</BarisInfo>
              ) : tampil.length === 0 ? (
                <BarisInfo kolom={8}>
                  {semua.length === 0 ? 'Tidak ada pinjaman yang terlambat.' : 'Tidak ada yang cocok dengan pencarian.'}
                </BarisInfo>
              ) : (
                tampil.map((t, i) => (
                  <tr key={t.id_detail}>
                    <td className={kelas.td}>{i + 1}</td>
                    <td className={`${kelas.td} font-medium`}>{t.nama_anggota}</td>
                    <td className={kelas.td}>{t.kelas ?? (t.jenis_anggota === 'guru' ? 'Guru' : '-')}</td>
                    <td className={kelas.td}>{t.judul}</td>
                    <td className={kelas.td}>{t.nomor_induk_eksemplar}</td>
                    <td className={kelas.td}>{formatTanggal(t.tanggal_jatuh_tempo)}</td>
                    <td className={kelas.td}>
                      <Lencana warna={t.hari_terlambat > 30 ? 'merah' : 'oranye'}>{t.hari_terlambat} hari</Lencana>
                    </td>
                    <td className={kelas.td}>
                      <button className={kelas.tombolKecil} onClick={() => setRinci(t)}>Detail</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm italic text-slate-500">
          Pinjaman terlambat tidak otomatis dianggap hilang. Status hilang hanya diubah petugas setelah verifikasi.
        </p>
      </section>

      {rinci && (
        <Modal judul="Detail Pinjaman Terlambat" onTutup={() => setRinci(null)}>
          <dl className="grid grid-cols-[9rem_1fr] gap-y-2 text-sm">
            <dt className="text-slate-500">Anggota</dt>
            <dd className="font-medium">{rinci.nama_anggota} ({rinci.nomor_induk_anggota})</dd>
            <dt className="text-slate-500">Jenis / Kelas</dt>
            <dd className="capitalize">{rinci.jenis_anggota} / {rinci.kelas ?? '-'}</dd>
            <dt className="text-slate-500">No. HP</dt>
            <dd>{rinci.no_hp ?? '-'}</dd>
            <dt className="text-slate-500">Judul buku</dt>
            <dd>{rinci.judul}</dd>
            <dt className="text-slate-500">No. induk eksemplar</dt>
            <dd>{rinci.nomor_induk_eksemplar}</dd>
            <dt className="text-slate-500">Tanggal pinjam</dt>
            <dd>{formatTanggal(rinci.tanggal_pinjam)}</dd>
            <dt className="text-slate-500">Jatuh tempo</dt>
            <dd>{formatTanggal(rinci.tanggal_jatuh_tempo)}</dd>
            <dt className="text-slate-500">Perpanjangan</dt>
            <dd>{rinci.jumlah_perpanjangan} kali</dd>
            <dt className="text-slate-500">Hari terlambat</dt>
            <dd><Lencana warna={rinci.hari_terlambat > 30 ? 'merah' : 'oranye'}>{rinci.hari_terlambat} hari</Lencana></dd>
          </dl>
          <div className="mt-5 flex justify-end gap-2">
            <button className={kelas.tombol} onClick={() => setRinci(null)}>Tutup</button>
            <Link className={kelas.tombolUtama} to={`/petugas/pengembalian?no=${encodeURIComponent(rinci.nomor_induk_eksemplar)}`}>
              Proses Pengembalian
            </Link>
          </div>
        </Modal>
      )}
    </div>
  )
}
