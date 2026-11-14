import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { polaPersis } from '../../lib/cari'
import { pesanGalat } from '../../lib/galat'
import { catatPeminjaman, cekKelayakanAnggota, type Kelayakan } from '../../lib/sirkulasi'
import { formatJam, formatTanggal, hariIniWIB } from '../../lib/tanggal'
import { BarisInfo, JudulHalaman, Lencana, Pemberitahuan, kelas, type Pesan } from '../../components/ui'

interface BukuDipilih {
  nomor_induk: string
  judul: string
}

interface TransaksiHariIni {
  id_peminjaman: number
  tanggal_pinjam: string
  nama_anggota: string
  nama_petugas: string | null
  jumlah_buku: number
}

export default function Peminjaman() {
  const navigate = useNavigate()
  const [nomorAnggota, setNomorAnggota] = useState('')
  const [anggota, setAnggota] = useState<Kelayakan | null>(null)
  const [pesanAnggota, setPesanAnggota] = useState<Pesan | null>(null)
  const [nomorEksemplar, setNomorEksemplar] = useState('')
  const [daftar, setDaftar] = useState<BukuDipilih[]>([])
  const [pesanBuku, setPesanBuku] = useState<Pesan | null>(null)
  const [sibuk, setSibuk] = useState(false)
  const [hariIni, setHariIni] = useState<TransaksiHariIni[]>([])
  const [memuatHariIni, setMemuatHariIni] = useState(true)
  const inputAnggota = useRef<HTMLInputElement>(null)
  const inputEksemplar = useRef<HTMLInputElement>(null)

  const muatHariIni = useCallback(async () => {
    const { data, error } = await supabase
      .from('v_pinjaman')
      .select('id_peminjaman, tanggal_pinjam, nama_anggota, nama_petugas')
      .gte('tanggal_pinjam', `${hariIniWIB()}T00:00:00+07:00`)
      .order('tanggal_pinjam', { ascending: false })
    if (!error) {
      const peta = new Map<number, TransaksiHariIni>()
      for (const b of data ?? []) {
        const ada = peta.get(b.id_peminjaman)
        if (ada) ada.jumlah_buku++
        else peta.set(b.id_peminjaman, { ...b, jumlah_buku: 1 })
      }
      setHariIni([...peta.values()])
    }
    setMemuatHariIni(false)
  }, [])

  useEffect(() => {
    void muatHariIni()
    inputAnggota.current?.focus()
  }, [muatHariIni])

  async function cariAnggota(e: FormEvent) {
    e.preventDefault()
    const nomor = nomorAnggota.trim()
    if (!nomor) return
    setPesanAnggota(null)
    setPesanBuku(null)
    setSibuk(true)
    try {
      const hasil = await cekKelayakanAnggota(nomor)
      setAnggota(hasil)
      setDaftar([])
      if (hasil.boleh_meminjam) setTimeout(() => inputEksemplar.current?.focus(), 0)
    } catch (galat) {
      setAnggota(null)
      setDaftar([])
      setPesanAnggota({ jenis: 'galat', teks: galat instanceof Error ? galat.message : 'Gagal mencari anggota.' })
    } finally {
      setSibuk(false)
    }
  }

  async function tambahBuku(e: FormEvent) {
    e.preventDefault()
    const nomor = nomorEksemplar.trim()
    if (!nomor || !anggota) return
    setPesanBuku(null)

    if (daftar.some((b) => b.nomor_induk.toLowerCase() === nomor.toLowerCase())) {
      return setPesanBuku({ jenis: 'galat', teks: `Eksemplar ${nomor} sudah ada di daftar.` })
    }
    if (anggota.pinjaman_aktif + daftar.length + 1 > anggota.maks_pinjam) {
      return setPesanBuku({
        jenis: 'galat',
        teks: `Tidak bisa menambah buku lagi: batas pinjam ${anggota.nama} adalah ${anggota.maks_pinjam} buku (sedang meminjam ${anggota.pinjaman_aktif}, di daftar ini ${daftar.length}).`,
      })
    }

    setSibuk(true)
    const { data, error } = await supabase
      .from('eksemplar')
      .select('nomor_induk, status, buku(judul, dapat_dipinjam)')
      .ilike('nomor_induk', polaPersis(nomor))
      .maybeSingle()
    setSibuk(false)

    if (error) return setPesanBuku({ jenis: 'galat', teks: pesanGalat(error) })
    if (!data) return setPesanBuku({ jenis: 'galat', teks: `Eksemplar dengan nomor induk "${nomor}" tidak ditemukan.` })
    const buku = data.buku as unknown as { judul: string; dapat_dipinjam: boolean }
    if (!buku.dapat_dipinjam) {
      return setPesanBuku({ jenis: 'galat', teks: `Eksemplar ${data.nomor_induk} ("${buku.judul}") tidak dapat dipinjam karena bukunya hanya untuk dibaca di tempat.` })
    }
    if (data.status !== 'tersedia') {
      return setPesanBuku({ jenis: 'galat', teks: `Eksemplar ${data.nomor_induk} ("${buku.judul}") tidak tersedia. Status saat ini: ${data.status}.` })
    }

    setDaftar([...daftar, { nomor_induk: data.nomor_induk, judul: buku.judul }])
    setNomorEksemplar('')
    inputEksemplar.current?.focus()
  }

  function batal() {
    setNomorAnggota('')
    setAnggota(null)
    setDaftar([])
    setNomorEksemplar('')
    setPesanAnggota(null)
    setPesanBuku(null)
    inputAnggota.current?.focus()
  }

  async function simpan() {
    if (!anggota || daftar.length === 0) return
    setSibuk(true)
    setPesanBuku(null)
    try {
      // Database memeriksa ulang semua aturan; tampilan di atas hanya pemeriksaan awal
      const hasil = await catatPeminjaman(anggota.nomor_induk, daftar.map((b) => b.nomor_induk))
      navigate(`/petugas/peminjaman/bukti/${hasil.id_peminjaman}`, { state: { baru: true } })
    } catch (galat) {
      setPesanBuku({ jenis: 'galat', teks: galat instanceof Error ? galat.message : 'Gagal menyimpan peminjaman.' })
      setSibuk(false)
    }
  }

  return (
    <div>
      <JudulHalaman>Catat Peminjaman</JudulHalaman>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* ---------- 1. Data anggota ---------- */}
        <section className={`${kelas.kartu} p-4`}>
          <h2 className="text-lg font-semibold">1. Data Anggota</h2>
          <form onSubmit={cariAnggota} className="mt-3 flex gap-2">
            <input
              ref={inputAnggota}
              className={kelas.input}
              placeholder="Masukkan NIS / NIP"
              value={nomorAnggota}
              onChange={(e) => setNomorAnggota(e.target.value)}
              aria-label="NIS atau NIP anggota"
              autoComplete="off"
            />
            <button className={kelas.tombol} type="submit" disabled={sibuk}>Cari</button>
          </form>
          <div className="mt-3">
            <Pemberitahuan pesan={pesanAnggota} />
          </div>

          {anggota && (
            <table className="mt-3 w-full text-sm">
              <tbody className="divide-y divide-slate-100 border-y border-slate-100">
                <tr>
                  <th className="w-2/5 py-2 pr-3 text-left font-medium text-slate-500">Nama</th>
                  <td className="py-2 font-medium">{anggota.nama} <span className="font-normal text-slate-500">({anggota.nomor_induk})</span></td>
                </tr>
                <tr>
                  <th className="py-2 pr-3 text-left font-medium text-slate-500">Jenis / Kelas</th>
                  <td className="py-2 capitalize">{anggota.jenis_anggota} / {anggota.kelas ?? '-'}</td>
                </tr>
                <tr>
                  <th className="py-2 pr-3 text-left font-medium text-slate-500">Pinjaman aktif / batas</th>
                  <td className="py-2">{anggota.pinjaman_aktif} / {anggota.maks_pinjam}</td>
                </tr>
                <tr>
                  <th className="py-2 pr-3 text-left font-medium text-slate-500">Pinjaman terlambat</th>
                  <td className={`py-2 ${anggota.pinjaman_terlambat > 0 ? 'font-semibold text-orange-700' : ''}`}>{anggota.pinjaman_terlambat}</td>
                </tr>
                <tr>
                  <th className="py-2 pr-3 text-left font-medium text-slate-500">Status</th>
                  <td className="py-2">
                    <Lencana warna={anggota.boleh_meminjam ? 'hijau' : 'oranye'}>
                      {anggota.boleh_meminjam ? 'Boleh meminjam' : 'Tidak boleh meminjam'}
                    </Lencana>
                  </td>
                </tr>
              </tbody>
            </table>
          )}
          {anggota && !anggota.boleh_meminjam && (
            <p className="mt-3 rounded-lg bg-orange-50 px-3 py-2 text-sm text-orange-900" role="alert">{anggota.alasan}</p>
          )}
        </section>

        {/* ---------- 2. Buku yang dipinjam ---------- */}
        <section className={`${kelas.kartu} p-4`}>
          <h2 className="text-lg font-semibold">2. Buku yang Dipinjam</h2>
          <form onSubmit={tambahBuku} className="mt-3 flex gap-2">
            <input
              ref={inputEksemplar}
              className={kelas.input}
              placeholder={anggota?.boleh_meminjam ? 'Masukkan nomor induk eksemplar' : 'Cari anggota terlebih dahulu'}
              value={nomorEksemplar}
              onChange={(e) => setNomorEksemplar(e.target.value)}
              disabled={!anggota?.boleh_meminjam}
              aria-label="Nomor induk eksemplar"
              autoComplete="off"
            />
            <button className={`${kelas.tombol} whitespace-nowrap`} type="submit" disabled={sibuk || !anggota?.boleh_meminjam}>+ Tambah</button>
          </form>
          <div className="mt-3">
            <Pemberitahuan pesan={pesanBuku} />
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className={kelas.th}>No.</th>
                  <th className={kelas.th}>No. Induk</th>
                  <th className={kelas.th}>Judul</th>
                  <th className={kelas.th}>Status</th>
                  <th className={kelas.th}>Jatuh Tempo</th>
                  <th className={kelas.th}>Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {daftar.length === 0 ? (
                  <BarisInfo kolom={6}>Belum ada buku di daftar.</BarisInfo>
                ) : (
                  daftar.map((b, i) => (
                    <tr key={b.nomor_induk}>
                      <td className={kelas.td}>{i + 1}</td>
                      <td className={`${kelas.td} font-medium`}>{b.nomor_induk}</td>
                      <td className={kelas.td}>{b.judul}</td>
                      <td className={kelas.td}><Lencana warna="hijau">Tersedia</Lencana></td>
                      <td className={kelas.td}>{formatTanggal(anggota?.jatuh_tempo_jika_pinjam_hari_ini)}</td>
                      <td className={kelas.td}>
                        <button className={kelas.tombolKecil} onClick={() => setDaftar(daftar.filter((x) => x.nomor_induk !== b.nomor_induk))}>
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm italic text-slate-500">
            Sistem menolak eksemplar yang tidak tersedia atau tidak dapat dipinjam, dan menampilkan alasannya.
            {anggota?.boleh_meminjam && ` Lama pinjam ${anggota.jenis_anggota}: ${anggota.lama_pinjam_hari} hari.`}
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <button className={kelas.tombol} onClick={batal} disabled={sibuk}>Batal</button>
            <button className={kelas.tombolUtama} onClick={() => void simpan()} disabled={sibuk || daftar.length === 0}>
              {sibuk ? 'Memproses...' : 'Simpan Peminjaman'}
            </button>
          </div>
        </section>
      </div>

      {/* ---------- Peminjaman hari ini ---------- */}
      <section className={`${kelas.kartu} mt-4 p-4`}>
        <h2 className="text-lg font-semibold">Peminjaman Terakhir Hari Ini</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className={kelas.th}>Waktu</th>
                <th className={kelas.th}>Anggota</th>
                <th className={kelas.th}>Jumlah Buku</th>
                <th className={kelas.th}>Petugas</th>
                <th className={kelas.th}>Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {memuatHariIni ? (
                <BarisInfo kolom={5}>Memuat data...</BarisInfo>
              ) : hariIni.length === 0 ? (
                <BarisInfo kolom={5}>Belum ada peminjaman hari ini.</BarisInfo>
              ) : (
                hariIni.map((t) => (
                  <tr key={t.id_peminjaman}>
                    <td className={kelas.td}>{formatJam(t.tanggal_pinjam)}</td>
                    <td className={`${kelas.td} font-medium`}>{t.nama_anggota}</td>
                    <td className={kelas.td}>{t.jumlah_buku}</td>
                    <td className={kelas.td}>{t.nama_petugas ?? '-'}</td>
                    <td className={kelas.td}>
                      <Link className={kelas.tombolKecil} to={`/petugas/peminjaman/bukti/${t.id_peminjaman}`}>Cetak Bukti</Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
