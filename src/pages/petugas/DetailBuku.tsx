import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { pesanGalat } from '../../lib/galat'
import { hapusSampul, unggahSampul, urlSampul } from '../../lib/sampul'
import { formatTanggal, hariIniWIB } from '../../lib/tanggal'
import {
  BarisInfo,
  JudulHalaman,
  Konfirmasi,
  Lencana,
  Modal,
  Pemberitahuan,
  kelas,
  type Pesan,
  type WarnaLencana,
} from '../../components/ui'

type StatusEksemplar = 'tersedia' | 'dipinjam' | 'rusak' | 'hilang'

interface Eksemplar {
  id_eksemplar: number
  nomor_induk: string
  sumber_perolehan: string | null
  tanggal_masuk: string | null
  status: StatusEksemplar
  keterangan: string | null
}

const labelStatus: Record<StatusEksemplar, { teks: string; warna: WarnaLencana }> = {
  tersedia: { teks: 'Tersedia', warna: 'hijau' },
  dipinjam: { teks: 'Dipinjam', warna: 'biru' },
  rusak: { teks: 'Rusak', warna: 'oranye' },
  hilang: { teks: 'Hilang', warna: 'merah' },
}

const bukuKosong = {
  judul: '',
  pengarang: '',
  isbn: '',
  tahun_terbit: '',
  penerbit: '',
  lokasi_rak: '',
  id_kategori: '',
  dapat_dipinjam: 'ya',
  sinopsis: '',
}

const eksKosong = { id: null as number | null, nomor_induk: '', sumber_perolehan: '', tanggal_masuk: '', keterangan: '' }

export default function DetailBuku() {
  const { id } = useParams()
  const navigate = useNavigate()
  const bukuBaru = id === 'baru'
  const idBuku = bukuBaru ? null : Number(id)

  const [memuat, setMemuat] = useState(!bukuBaru)
  const [tidakAda, setTidakAda] = useState(false)
  const [form, setForm] = useState(bukuKosong)
  const [sampulLama, setSampulLama] = useState<string | null>(null)
  const [berkasSampul, setBerkasSampul] = useState<File | null>(null)
  const [pratinjau, setPratinjau] = useState<string | null>(null)
  const [hapusSampulLama, setHapusSampulLama] = useState(false)
  const [daftarKategori, setDaftarKategori] = useState<{ id_kategori: number; nama_kategori: string }[]>([])
  const [eksemplar, setEksemplar] = useState<Eksemplar[]>([])
  const [sibuk, setSibuk] = useState(false)
  const [pesan, setPesan] = useState<Pesan | null>(null)

  // dialog
  const [formEks, setFormEks] = useState<typeof eksKosong | null>(null)
  const [pesanEks, setPesanEks] = useState<Pesan | null>(null)
  const [ubahStatus, setUbahStatus] = useState<{ eks: Eksemplar; status: StatusEksemplar; keterangan: string } | null>(null)
  const [hapusEks, setHapusEks] = useState<Eksemplar | null>(null)
  const [konfirmasiHapusBuku, setKonfirmasiHapusBuku] = useState(false)

  const muatEksemplar = useCallback(async () => {
    if (!idBuku) return
    const { data, error } = await supabase
      .from('eksemplar')
      .select('id_eksemplar, nomor_induk, sumber_perolehan, tanggal_masuk, status, keterangan')
      .eq('id_buku', idBuku)
      .order('nomor_induk')
    if (error) setPesan({ jenis: 'galat', teks: pesanGalat(error) })
    else setEksemplar((data ?? []) as Eksemplar[])
  }, [idBuku])

  useEffect(() => {
    void supabase
      .from('kategori')
      .select('id_kategori, nama_kategori')
      .order('nama_kategori')
      .then(({ data }) => setDaftarKategori(data ?? []))
  }, [])

  useEffect(() => {
    if (bukuBaru) {
      setForm(bukuKosong)
      setSampulLama(null)
      setEksemplar([])
      setMemuat(false)
      return
    }
    if (!idBuku || Number.isNaN(idBuku)) {
      setTidakAda(true)
      setMemuat(false)
      return
    }
    let batal = false
    setMemuat(true)
    ;(async () => {
      const { data, error } = await supabase.from('buku').select('*').eq('id_buku', idBuku).maybeSingle()
      if (batal) return
      if (error) setPesan({ jenis: 'galat', teks: pesanGalat(error) })
      else if (!data) setTidakAda(true)
      else {
        setForm({
          judul: data.judul ?? '',
          pengarang: data.pengarang ?? '',
          isbn: data.isbn ?? '',
          tahun_terbit: data.tahun_terbit ? String(data.tahun_terbit) : '',
          penerbit: data.penerbit ?? '',
          lokasi_rak: data.lokasi_rak ?? '',
          id_kategori: String(data.id_kategori),
          dapat_dipinjam: data.dapat_dipinjam ? 'ya' : 'tidak',
          sinopsis: data.sinopsis ?? '',
        })
        setSampulLama(data.sampul)
        await muatEksemplar()
      }
      setMemuat(false)
    })()
    return () => {
      batal = true
    }
  }, [bukuBaru, idBuku, muatEksemplar])

  // pratinjau gambar yang baru dipilih
  useEffect(() => {
    if (!berkasSampul) {
      setPratinjau(null)
      return
    }
    const url = URL.createObjectURL(berkasSampul)
    setPratinjau(url)
    return () => URL.revokeObjectURL(url)
  }, [berkasSampul])

  const isi = (kunci: keyof typeof bukuKosong) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [kunci]: e.target.value }))

  async function simpanBuku(e: FormEvent) {
    e.preventDefault()
    setPesan(null)
    const judul = form.judul.trim()
    if (!judul) return setPesan({ jenis: 'galat', teks: 'Judul buku wajib diisi.' })
    if (!form.id_kategori) return setPesan({ jenis: 'galat', teks: 'Pilih kategori buku.' })
    const tahun = form.tahun_terbit.trim() ? Number(form.tahun_terbit) : null
    if (tahun !== null && (!Number.isInteger(tahun) || tahun < 1000 || tahun > 2999)) {
      return setPesan({ jenis: 'galat', teks: 'Tahun terbit harus berupa 4 angka, misalnya 2021.' })
    }

    const data = {
      judul,
      pengarang: form.pengarang.trim() || null,
      isbn: form.isbn.trim() || null,
      tahun_terbit: tahun,
      penerbit: form.penerbit.trim() || null,
      lokasi_rak: form.lokasi_rak.trim() || null,
      id_kategori: Number(form.id_kategori),
      dapat_dipinjam: form.dapat_dipinjam === 'ya',
      sinopsis: form.sinopsis.trim() || null,
    }

    setSibuk(true)
    try {
      let idTujuan = idBuku
      if (bukuBaru) {
        const { data: baru, error } = await supabase.from('buku').insert(data).select('id_buku').single()
        if (error) return setPesan({ jenis: 'galat', teks: pesanGalat(error) })
        idTujuan = baru.id_buku
      } else {
        const { error } = await supabase.from('buku').update(data).eq('id_buku', idBuku!)
        if (error) return setPesan({ jenis: 'galat', teks: pesanGalat(error) })
      }

      // gambar sampul
      let catatanSampul = ''
      if (berkasSampul && idTujuan) {
        try {
          const lokasi = await unggahSampul(berkasSampul, idTujuan)
          const { error } = await supabase.from('buku').update({ sampul: lokasi }).eq('id_buku', idTujuan)
          if (error) throw new Error(pesanGalat(error))
          await hapusSampul(sampulLama)
          setSampulLama(lokasi)
          setBerkasSampul(null)
        } catch (galat) {
          catatanSampul = `\nNamun gambar sampul gagal disimpan: ${galat instanceof Error ? galat.message : 'tidak diketahui'}`
        }
      } else if (hapusSampulLama && sampulLama && idTujuan) {
        await supabase.from('buku').update({ sampul: null }).eq('id_buku', idTujuan)
        await hapusSampul(sampulLama)
        setSampulLama(null)
      }
      setHapusSampulLama(false)

      if (bukuBaru && idTujuan) {
        navigate(`/petugas/buku/${idTujuan}`, { replace: true })
        setPesan({
          jenis: catatanSampul ? 'galat' : 'sukses',
          teks: `Buku "${judul}" ditambahkan. Sekarang tambahkan eksemplarnya.${catatanSampul}`,
        })
      } else {
        setPesan({ jenis: catatanSampul ? 'galat' : 'sukses', teks: `Data buku "${judul}" disimpan.${catatanSampul}` })
      }
    } finally {
      setSibuk(false)
    }
  }

  async function hapusBuku() {
    if (!idBuku) return
    setSibuk(true)
    const { error } = await supabase.from('buku').delete().eq('id_buku', idBuku)
    setSibuk(false)
    setKonfirmasiHapusBuku(false)
    if (error) {
      return setPesan({
        jenis: 'galat',
        teks: pesanGalat(error, {
          dipakai:
            'Buku ini tidak bisa dihapus karena eksemplarnya sudah punya riwayat pinjaman. Jika buku sudah tidak ada, ubah status eksemplarnya menjadi Rusak atau Hilang.',
        }),
      })
    }
    await hapusSampul(sampulLama)
    navigate('/petugas/buku', { replace: true })
  }

  async function simpanEksemplar(lanjutTambah: boolean) {
    if (!formEks || !idBuku) return
    setPesanEks(null)
    const nomor = formEks.nomor_induk.trim()
    if (!nomor) return setPesanEks({ jenis: 'galat', teks: 'Nomor induk eksemplar wajib diisi.' })
    const data = {
      nomor_induk: nomor,
      sumber_perolehan: formEks.sumber_perolehan.trim() || null,
      tanggal_masuk: formEks.tanggal_masuk || null,
      keterangan: formEks.keterangan.trim() || null,
    }
    setSibuk(true)
    const { error } = formEks.id
      ? await supabase.from('eksemplar').update(data).eq('id_eksemplar', formEks.id)
      : await supabase.from('eksemplar').insert({ ...data, id_buku: idBuku })
    setSibuk(false)
    if (error) {
      return setPesanEks({
        jenis: 'galat',
        teks: pesanGalat(error, { unik: `Nomor induk "${nomor}" sudah dipakai eksemplar lain.` }),
      })
    }
    await muatEksemplar()
    if (lanjutTambah) {
      setFormEks({ ...eksKosong, sumber_perolehan: formEks.sumber_perolehan, tanggal_masuk: formEks.tanggal_masuk })
      setPesanEks({ jenis: 'sukses', teks: `Eksemplar ${nomor} ditambahkan. Silakan isi eksemplar berikutnya.` })
    } else {
      setFormEks(null)
      setPesan({ jenis: 'sukses', teks: formEks.id ? `Eksemplar ${nomor} diperbarui.` : `Eksemplar ${nomor} ditambahkan.` })
    }
  }

  async function simpanStatus() {
    if (!ubahStatus) return
    setSibuk(true)
    const { error } = await supabase
      .from('eksemplar')
      .update({ status: ubahStatus.status, keterangan: ubahStatus.keterangan.trim() || null })
      .eq('id_eksemplar', ubahStatus.eks.id_eksemplar)
    setSibuk(false)
    if (error) setPesan({ jenis: 'galat', teks: pesanGalat(error) })
    else {
      setPesan({
        jenis: 'sukses',
        teks: `Status eksemplar ${ubahStatus.eks.nomor_induk} diubah menjadi ${labelStatus[ubahStatus.status].teks}.`,
      })
      await muatEksemplar()
    }
    setUbahStatus(null)
  }

  async function hapusEksemplar() {
    if (!hapusEks) return
    setSibuk(true)
    const { error } = await supabase.from('eksemplar').delete().eq('id_eksemplar', hapusEks.id_eksemplar)
    setSibuk(false)
    if (error) {
      setPesan({
        jenis: 'galat',
        teks: pesanGalat(error, {
          dipakai: `Eksemplar ${hapusEks.nomor_induk} sudah punya riwayat pinjaman sehingga tidak bisa dihapus. Ubah statusnya menjadi Rusak atau Hilang.`,
        }),
      })
    } else {
      setPesan({ jenis: 'sukses', teks: `Eksemplar ${hapusEks.nomor_induk} dihapus.` })
      await muatEksemplar()
    }
    setHapusEks(null)
  }

  if (memuat) return <p className="text-slate-500">Memuat data buku...</p>
  if (tidakAda) {
    return (
      <div>
        <JudulHalaman>Buku tidak ditemukan</JudulHalaman>
        <Link className={kelas.tombol} to="/petugas/buku">Kembali ke Data Buku</Link>
      </div>
    )
  }

  const gambar = pratinjau ?? (hapusSampulLama ? null : urlSampul(sampulLama))

  return (
    <div>
      <JudulHalaman>{bukuBaru ? 'Tambah Buku' : 'Detail Buku dan Eksemplar'}</JudulHalaman>
      <Pemberitahuan pesan={pesan} onTutup={() => setPesan(null)} />

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {/* ---------- Data buku ---------- */}
        <section className={`${kelas.kartu} p-4`}>
          <h2 className="text-lg font-semibold">Data Buku</h2>
          <form onSubmit={simpanBuku} className="mt-3 space-y-3">
            <div className="flex gap-4">
              <div className="w-28 shrink-0">
                <div className="flex aspect-[2/3] items-center justify-center overflow-hidden rounded-lg border border-slate-300 bg-slate-100 text-center text-xs text-slate-400">
                  {gambar ? <img src={gambar} alt="Sampul buku" className="h-full w-full object-cover" /> : 'Belum ada sampul'}
                </div>
                <label className={`${kelas.tombolKecil} mt-2 w-full cursor-pointer`}>
                  Pilih gambar
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={(e) => {
                      setBerkasSampul(e.target.files?.[0] ?? null)
                      setHapusSampulLama(false)
                      e.target.value = ''
                    }}
                  />
                </label>
                {(berkasSampul || (sampulLama && !hapusSampulLama)) && (
                  <button
                    type="button"
                    className="mt-1 w-full text-xs text-slate-500 underline"
                    onClick={() => {
                      if (berkasSampul) setBerkasSampul(null)
                      else setHapusSampulLama(true)
                    }}
                  >
                    {berkasSampul ? 'Batal pilih' : 'Hapus sampul'}
                  </button>
                )}
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <label className={kelas.label} htmlFor="judul">Judul</label>
                  <input id="judul" className={kelas.input} maxLength={200} value={form.judul} onChange={isi('judul')} />
                </div>
                <div>
                  <label className={kelas.label} htmlFor="pengarang">Pengarang</label>
                  <input id="pengarang" className={kelas.input} maxLength={150} value={form.pengarang} onChange={isi('pengarang')} />
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={kelas.label} htmlFor="isbn">ISBN</label>
                <input id="isbn" className={kelas.input} maxLength={20} value={form.isbn} onChange={isi('isbn')} />
              </div>
              <div>
                <label className={kelas.label} htmlFor="tahun">Tahun Terbit</label>
                <input id="tahun" className={kelas.input} inputMode="numeric" maxLength={4} value={form.tahun_terbit} onChange={isi('tahun_terbit')} />
              </div>
              <div>
                <label className={kelas.label} htmlFor="penerbit">Penerbit</label>
                <input id="penerbit" className={kelas.input} maxLength={100} value={form.penerbit} onChange={isi('penerbit')} />
              </div>
              <div>
                <label className={kelas.label} htmlFor="rak">Lokasi Rak</label>
                <input id="rak" className={kelas.input} maxLength={30} value={form.lokasi_rak} onChange={isi('lokasi_rak')} />
              </div>
              <div>
                <label className={kelas.label} htmlFor="kategori">Kategori</label>
                <select id="kategori" className={kelas.input} value={form.id_kategori} onChange={isi('id_kategori')}>
                  <option value="">Pilih kategori...</option>
                  {daftarKategori.map((k) => (
                    <option key={k.id_kategori} value={k.id_kategori}>{k.nama_kategori}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={kelas.label} htmlFor="dapat">Dapat Dipinjam</label>
                <select id="dapat" className={kelas.input} value={form.dapat_dipinjam} onChange={isi('dapat_dipinjam')}>
                  <option value="ya">Ya</option>
                  <option value="tidak">Tidak (hanya dibaca di tempat)</option>
                </select>
              </div>
            </div>

            <div>
              <label className={kelas.label} htmlFor="sinopsis">Sinopsis</label>
              <textarea id="sinopsis" rows={3} className={kelas.area} value={form.sinopsis} onChange={isi('sinopsis')} />
            </div>

            <div className="flex flex-wrap gap-2">
              <button className={kelas.tombolUtama} type="submit" disabled={sibuk}>{sibuk ? 'Menyimpan...' : 'Simpan'}</button>
              <Link className={kelas.tombol} to="/petugas/buku">Kembali</Link>
              {!bukuBaru && (
                <button type="button" className={`${kelas.tombol} ml-auto text-orange-700`} onClick={() => setKonfirmasiHapusBuku(true)}>
                  Hapus Buku
                </button>
              )}
            </div>
          </form>
        </section>

        {/* ---------- Daftar eksemplar ---------- */}
        <section className={`${kelas.kartu} self-start p-4`}>
          <h2 className="text-lg font-semibold">Daftar Eksemplar</h2>
          {bukuBaru ? (
            <p className="mt-3 text-sm text-slate-500">
              Simpan data buku terlebih dahulu. Setelah itu eksemplar (buku fisik) bisa ditambahkan di sini.
            </p>
          ) : (
            <>
              <button
                className={`${kelas.tombolUtama} mt-3`}
                onClick={() => {
                  setPesanEks(null)
                  setFormEks({ ...eksKosong, tanggal_masuk: hariIniWIB() })
                }}
              >
                + Tambah Eksemplar
              </button>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-slate-200 bg-slate-50">
                    <tr>
                      <th className={kelas.th}>No. Induk</th>
                      <th className={kelas.th}>Sumber</th>
                      <th className={kelas.th}>Tgl Masuk</th>
                      <th className={kelas.th}>Status</th>
                      <th className={kelas.th}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {eksemplar.length === 0 ? (
                      <BarisInfo kolom={5}>Belum ada eksemplar untuk buku ini.</BarisInfo>
                    ) : (
                      eksemplar.map((x) => (
                        <tr key={x.id_eksemplar}>
                          <td className={`${kelas.td} font-medium`}>
                            {x.nomor_induk}
                            {x.keterangan && <div className="text-xs font-normal text-slate-500">{x.keterangan}</div>}
                          </td>
                          <td className={kelas.td}>{x.sumber_perolehan || '-'}</td>
                          <td className={kelas.td}>{formatTanggal(x.tanggal_masuk)}</td>
                          <td className={kelas.td}>
                            <Lencana warna={labelStatus[x.status].warna}>{labelStatus[x.status].teks}</Lencana>
                          </td>
                          <td className={kelas.td}>
                            <div className="flex flex-wrap gap-1.5">
                              <button
                                className={kelas.tombolKecil}
                                disabled={x.status === 'dipinjam'}
                                title={x.status === 'dipinjam' ? 'Sedang dipinjam: status hanya berubah lewat menu Pengembalian' : undefined}
                                onClick={() => setUbahStatus({ eks: x, status: x.status, keterangan: x.keterangan ?? '' })}
                              >
                                Ubah Status
                              </button>
                              <button
                                className={kelas.tombolKecil}
                                onClick={() => {
                                  setPesanEks(null)
                                  setFormEks({
                                    id: x.id_eksemplar,
                                    nomor_induk: x.nomor_induk,
                                    sumber_perolehan: x.sumber_perolehan ?? '',
                                    tanggal_masuk: x.tanggal_masuk ?? '',
                                    keterangan: x.keterangan ?? '',
                                  })
                                }}
                              >
                                Edit
                              </button>
                              <button className={kelas.tombolKecil} disabled={x.status === 'dipinjam'} onClick={() => setHapusEks(x)}>
                                Hapus
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-sm italic text-slate-500">
                Status: Tersedia, Dipinjam, Rusak, Hilang. Status Dipinjam diubah otomatis oleh transaksi.
              </p>
            </>
          )}
        </section>
      </div>

      {/* ---------- Dialog tambah/edit eksemplar ---------- */}
      {formEks && (
        <Modal judul={formEks.id ? 'Ubah Eksemplar' : 'Tambah Eksemplar'} onTutup={() => setFormEks(null)}>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              void simpanEksemplar(false)
            }}
          >
            <Pemberitahuan pesan={pesanEks} />
            <div>
              <label className={kelas.label} htmlFor="eks-nomor">Nomor Induk</label>
              <input
                id="eks-nomor"
                autoFocus
                className={kelas.input}
                maxLength={30}
                value={formEks.nomor_induk}
                onChange={(e) => setFormEks({ ...formEks, nomor_induk: e.target.value })}
              />
              <p className="mt-1 text-xs text-slate-500">Sesuai nomor di buku induk perpustakaan. Harus unik.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={kelas.label} htmlFor="eks-sumber">Sumber Perolehan</label>
                <input
                  id="eks-sumber"
                  className={kelas.input}
                  maxLength={50}
                  placeholder="Pembelian, hibah, ..."
                  value={formEks.sumber_perolehan}
                  onChange={(e) => setFormEks({ ...formEks, sumber_perolehan: e.target.value })}
                />
              </div>
              <div>
                <label className={kelas.label} htmlFor="eks-tanggal">Tanggal Masuk</label>
                <input
                  id="eks-tanggal"
                  type="date"
                  className={kelas.input}
                  value={formEks.tanggal_masuk}
                  onChange={(e) => setFormEks({ ...formEks, tanggal_masuk: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className={kelas.label} htmlFor="eks-ket">Keterangan</label>
              <input
                id="eks-ket"
                className={kelas.input}
                value={formEks.keterangan}
                onChange={(e) => setFormEks({ ...formEks, keterangan: e.target.value })}
              />
            </div>
            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <button type="button" className={kelas.tombol} onClick={() => setFormEks(null)}>Tutup</button>
              {!formEks.id && (
                <button type="button" className={kelas.tombol} disabled={sibuk} onClick={() => void simpanEksemplar(true)}>
                  Simpan & Tambah Lagi
                </button>
              )}
              <button type="submit" className={kelas.tombolUtama} disabled={sibuk}>{sibuk ? 'Menyimpan...' : 'Simpan'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ---------- Dialog ubah status ---------- */}
      {ubahStatus && (
        <Modal judul={`Ubah Status Eksemplar ${ubahStatus.eks.nomor_induk}`} onTutup={() => setUbahStatus(null)} lebar="max-w-md">
          <fieldset className="space-y-2">
            <legend className="sr-only">Status eksemplar</legend>
            {(['tersedia', 'rusak', 'hilang'] as StatusEksemplar[]).map((s) => (
              <label key={s} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3">
                <input
                  type="radio"
                  name="status-eks"
                  className="h-4 w-4"
                  checked={ubahStatus.status === s}
                  onChange={() => setUbahStatus({ ...ubahStatus, status: s })}
                />
                <Lencana warna={labelStatus[s].warna}>{labelStatus[s].teks}</Lencana>
              </label>
            ))}
          </fieldset>
          <label className={`${kelas.label} mt-3`} htmlFor="status-ket">Keterangan</label>
          <input
            id="status-ket"
            className={kelas.input}
            placeholder="Misalnya: sampul sobek"
            value={ubahStatus.keterangan}
            onChange={(e) => setUbahStatus({ ...ubahStatus, keterangan: e.target.value })}
          />
          <p className="mt-3 text-xs text-slate-500">
            Status Rusak dan Hilang hanya ditetapkan petugas setelah memeriksa buku. Status Dipinjam tidak bisa dipilih di sini.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button className={kelas.tombol} onClick={() => setUbahStatus(null)}>Batal</button>
            <button className={kelas.tombolUtama} disabled={sibuk} onClick={() => void simpanStatus()}>
              {sibuk ? 'Menyimpan...' : 'Simpan Status'}
            </button>
          </div>
        </Modal>
      )}

      {hapusEks && (
        <Konfirmasi judul="Hapus eksemplar?" labelYa="Hapus" bahaya sibuk={sibuk} onYa={() => void hapusEksemplar()} onBatal={() => setHapusEks(null)}>
          Eksemplar <b>{hapusEks.nomor_induk}</b> akan dihapus. Gunakan ini hanya untuk data yang salah input.
          Eksemplar yang sudah pernah dipinjam tidak bisa dihapus.
        </Konfirmasi>
      )}

      {konfirmasiHapusBuku && (
        <Konfirmasi judul="Hapus buku?" labelYa="Hapus Buku" bahaya sibuk={sibuk} onYa={() => void hapusBuku()} onBatal={() => setKonfirmasiHapusBuku(false)}>
          Buku <b>{form.judul}</b> beserta {eksemplar.length} eksemplarnya akan dihapus.
          Buku yang eksemplarnya sudah pernah dipinjam tidak bisa dihapus.
        </Konfirmasi>
      )}
    </div>
  )
}
