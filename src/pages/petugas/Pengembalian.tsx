import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatRupiah } from '../../lib/format'
import {
  cariPinjamanAktif,
  catatPengembalian,
  catatPerpanjangan,
  tandaiDendaLunas,
  type KondisiKembali,
  type PinjamanAktif,
  type StatusDenda,
} from '../../lib/sirkulasi'
import { formatTanggal } from '../../lib/tanggal'
import { BarisInfo, JudulHalaman, Konfirmasi, Lencana, Pemberitahuan, kelas, type Pesan } from '../../components/ui'

interface DendaTertunggak {
  id_detail: number
  nama_anggota: string
  nomor_induk_anggota: string
  kelas: string | null
  judul: string
  nomor_induk_eksemplar: string
  tanggal_kembali: string
  hari_terlambat: number
  denda: number
}

const labelKondisi: Record<KondisiKembali, string> = { baik: 'Baik', rusak: 'Rusak', hilang: 'Hilang' }

export default function Pengembalian() {
  const [parameter, setParameter] = useSearchParams()
  const [nomor, setNomor] = useState(parameter.get('no') ?? '')
  const [pinjaman, setPinjaman] = useState<PinjamanAktif | null>(null)
  const [kondisi, setKondisi] = useState<KondisiKembali>('baik')
  const [statusDenda, setStatusDenda] = useState<StatusDenda>('belum_lunas')
  const [catatan, setCatatan] = useState('')
  const [pesan, setPesan] = useState<Pesan | null>(null)
  const [sibuk, setSibuk] = useState(false)
  const [konfirmasi, setKonfirmasi] = useState<'kembali' | 'perpanjang' | null>(null)
  const [tunggakan, setTunggakan] = useState<DendaTertunggak[]>([])
  const [akanLunas, setAkanLunas] = useState<DendaTertunggak | null>(null)
  const inputNomor = useRef<HTMLInputElement>(null)

  const muatTunggakan = useCallback(async () => {
    const { data } = await supabase
      .from('v_pinjaman')
      .select('id_detail, nama_anggota, nomor_induk_anggota, kelas, judul, nomor_induk_eksemplar, tanggal_kembali, hari_terlambat, denda')
      .eq('status_denda', 'belum_lunas')
      .order('tanggal_kembali', { ascending: false })
    setTunggakan((data ?? []) as DendaTertunggak[])
  }, [])

  const cari = useCallback(async (nomorInduk: string) => {
    const n = nomorInduk.trim()
    if (!n) return
    setPesan(null)
    setSibuk(true)
    try {
      const hasil = await cariPinjamanAktif(n)
      setPinjaman(hasil)
      setKondisi('baik')
      setStatusDenda('belum_lunas')
      setCatatan('')
    } catch (galat) {
      setPinjaman(null)
      setPesan({ jenis: 'galat', teks: galat instanceof Error ? galat.message : 'Gagal mencari pinjaman.' })
    } finally {
      setSibuk(false)
    }
  }, [])

  useEffect(() => {
    void muatTunggakan()
    const awal = parameter.get('no')
    if (awal) void cari(awal)
    else inputNomor.current?.focus()
    // hanya saat halaman dibuka
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function kirimCari(e: FormEvent) {
    e.preventDefault()
    if (parameter.has('no')) setParameter({}, { replace: true })
    void cari(nomor)
  }

  function selesai(teks: string) {
    setPesan({ jenis: 'sukses', teks })
    setPinjaman(null)
    setNomor('')
    setKonfirmasi(null)
    void muatTunggakan()
    inputNomor.current?.focus()
  }

  async function simpanPengembalian() {
    if (!pinjaman) return
    setSibuk(true)
    try {
      const hasil = await catatPengembalian(
        pinjaman.nomor_induk_eksemplar,
        kondisi,
        pinjaman.denda > 0 ? statusDenda : null,
        catatan.trim() || null,
      )
      const rincian =
        hasil.hari_terlambat > 0
          ? ` Terlambat ${hasil.hari_terlambat} hari, denda ${formatRupiah(hasil.denda)}${hasil.denda > 0 ? ` (${hasil.status_denda === 'lunas' ? 'lunas' : 'belum lunas'})` : ''}.`
          : ' Tepat waktu.'
      const akibat = kondisi === 'baik' ? ' Eksemplar kembali tersedia.' : ` Eksemplar ditandai ${labelKondisi[kondisi].toLowerCase()}.`
      selesai(`${hasil.pesan}${rincian}${akibat}`)
    } catch (galat) {
      setKonfirmasi(null)
      setPesan({ jenis: 'galat', teks: galat instanceof Error ? galat.message : 'Gagal menyimpan pengembalian.' })
    } finally {
      setSibuk(false)
    }
  }

  async function perpanjang() {
    if (!pinjaman) return
    setSibuk(true)
    try {
      const hasil = await catatPerpanjangan(pinjaman.nomor_induk_eksemplar)
      selesai(`${hasil.pesan} Perpanjangan ke-${hasil.jumlah_perpanjangan}.`)
    } catch (galat) {
      setKonfirmasi(null)
      setPesan({ jenis: 'galat', teks: galat instanceof Error ? galat.message : 'Gagal memperpanjang pinjaman.' })
    } finally {
      setSibuk(false)
    }
  }

  async function lunasi() {
    if (!akanLunas) return
    setSibuk(true)
    try {
      const hasil = await tandaiDendaLunas(akanLunas.id_detail)
      setPesan({ jenis: 'sukses', teks: hasil.pesan })
      await muatTunggakan()
    } catch (galat) {
      setPesan({ jenis: 'galat', teks: galat instanceof Error ? galat.message : 'Gagal menandai denda lunas.' })
    } finally {
      setSibuk(false)
      setAkanLunas(null)
    }
  }

  const adaDenda = (pinjaman?.denda ?? 0) > 0

  return (
    <div>
      <JudulHalaman>Pengembalian dan Perpanjangan</JudulHalaman>

      <section className={`${kelas.kartu} p-4`}>
        <form onSubmit={kirimCari} className="flex gap-2">
          <input
            ref={inputNomor}
            className={kelas.input}
            placeholder="Masukkan nomor induk eksemplar"
            value={nomor}
            onChange={(e) => setNomor(e.target.value)}
            aria-label="Nomor induk eksemplar"
            autoComplete="off"
          />
          <button className={`${kelas.tombol} whitespace-nowrap`} type="submit" disabled={sibuk}>Cari Pinjaman</button>
        </form>
      </section>

      <div className="mt-4">
        <Pemberitahuan pesan={pesan} onTutup={() => setPesan(null)} />
      </div>

      {pinjaman && (
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <section className={`${kelas.kartu} p-4`}>
            <h2 className="text-lg font-semibold">Data Pinjaman</h2>
            <table className="mt-3 w-full text-sm">
              <tbody className="divide-y divide-slate-100 border-y border-slate-100">
                <tr>
                  <th className="w-2/5 py-2 pr-3 text-left font-medium text-slate-500">Anggota</th>
                  <td className="py-2 font-medium">
                    {pinjaman.nama_anggota} ({pinjaman.nomor_induk_anggota}){pinjaman.kelas ? ` - ${pinjaman.kelas}` : ''}
                  </td>
                </tr>
                <tr>
                  <th className="py-2 pr-3 text-left font-medium text-slate-500">Judul / No. Induk</th>
                  <td className="py-2">{pinjaman.judul} / {pinjaman.nomor_induk_eksemplar}</td>
                </tr>
                <tr>
                  <th className="py-2 pr-3 text-left font-medium text-slate-500">Tanggal pinjam</th>
                  <td className="py-2">{formatTanggal(pinjaman.tanggal_pinjam)}</td>
                </tr>
                <tr>
                  <th className="py-2 pr-3 text-left font-medium text-slate-500">Jatuh tempo</th>
                  <td className="py-2">{formatTanggal(pinjaman.tanggal_jatuh_tempo)}</td>
                </tr>
                <tr>
                  <th className="py-2 pr-3 text-left font-medium text-slate-500">Perpanjangan</th>
                  <td className="py-2">{pinjaman.jumlah_perpanjangan} dari {pinjaman.maks_perpanjangan} kali</td>
                </tr>
                <tr>
                  <th className="py-2 pr-3 text-left font-medium text-slate-500">Hari terlambat</th>
                  <td className="py-2">
                    {pinjaman.hari_terlambat > 0 ? <Lencana warna="oranye">{pinjaman.hari_terlambat} hari</Lencana> : '0'}
                  </td>
                </tr>
                <tr>
                  <th className="py-2 pr-3 text-left font-medium text-slate-500">Denda</th>
                  <td className={`py-2 ${adaDenda ? 'font-semibold text-orange-700' : ''}`}>{formatRupiah(pinjaman.denda)}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className={`${kelas.kartu} p-4`}>
            <h2 className="text-lg font-semibold">Proses</h2>
            <fieldset className="mt-3">
              <legend className={kelas.label}>Kondisi buku saat kembali</legend>
              <div className="flex flex-wrap gap-2">
                {(['baik', 'rusak', 'hilang'] as KondisiKembali[]).map((k) => (
                  <label
                    key={k}
                    className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-4 text-sm ${
                      kondisi === k ? 'border-utama-600 bg-utama-50 font-medium text-utama-800' : 'border-slate-300'
                    }`}
                  >
                    <input type="radio" name="kondisi" className="h-4 w-4" checked={kondisi === k} onChange={() => setKondisi(k)} />
                    {labelKondisi[k]}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className={`${kelas.label} mt-3`} htmlFor="status-denda">Status denda</label>
            {adaDenda ? (
              <select id="status-denda" className={kelas.input} value={statusDenda} onChange={(e) => setStatusDenda(e.target.value as StatusDenda)}>
                <option value="belum_lunas">Belum lunas</option>
                <option value="lunas">Lunas (dibayar sekarang)</option>
              </select>
            ) : (
              <input id="status-denda" className={kelas.input} value="Tidak ada denda" disabled />
            )}

            <label className={`${kelas.label} mt-3`} htmlFor="catatan">Catatan</label>
            <input
              id="catatan"
              className={kelas.input}
              placeholder={kondisi === 'baik' ? 'Opsional' : 'Jelaskan kerusakan / keterangan hilang'}
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
            />

            <div className="mt-4 flex flex-wrap gap-2">
              <button className={kelas.tombolUtama} disabled={sibuk} onClick={() => (kondisi === 'baik' ? void simpanPengembalian() : setKonfirmasi('kembali'))}>
                Simpan Pengembalian
              </button>
              <button className={kelas.tombol} disabled={sibuk || !pinjaman.boleh_diperpanjang} onClick={() => setKonfirmasi('perpanjang')}>
                Perpanjang Pinjaman
              </button>
            </div>
            {!pinjaman.boleh_diperpanjang && (
              <p className="mt-2 text-sm text-orange-800">Tidak bisa diperpanjang: {pinjaman.alasan_tidak_bisa_diperpanjang}</p>
            )}
            <p className="mt-2 text-sm italic text-slate-500">
              Perpanjangan ditolak jika sudah terlambat atau batas perpanjangan tercapai.
            </p>
          </section>
        </div>
      )}

      {/* ---------- Denda belum lunas ---------- */}
      <section className={`${kelas.kartu} mt-4 p-4`}>
        <h2 className="text-lg font-semibold">Denda Belum Lunas</h2>
        <p className="text-sm text-slate-500">Buku sudah dikembalikan, tetapi dendanya belum dibayar. Tandai lunas setelah anggota membayar di meja petugas.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className={kelas.th}>Anggota</th>
                <th className={kelas.th}>Kelas</th>
                <th className={kelas.th}>Judul Buku</th>
                <th className={kelas.th}>Tgl Kembali</th>
                <th className={kelas.th}>Terlambat</th>
                <th className={kelas.th}>Denda</th>
                <th className={kelas.th}>Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tunggakan.length === 0 ? (
                <BarisInfo kolom={7}>Tidak ada denda yang belum lunas.</BarisInfo>
              ) : (
                tunggakan.map((t) => (
                  <tr key={t.id_detail}>
                    <td className={`${kelas.td} font-medium`}>{t.nama_anggota} <span className="font-normal text-slate-500">({t.nomor_induk_anggota})</span></td>
                    <td className={kelas.td}>{t.kelas ?? '-'}</td>
                    <td className={kelas.td}>{t.judul} <span className="text-slate-500">({t.nomor_induk_eksemplar})</span></td>
                    <td className={kelas.td}>{formatTanggal(t.tanggal_kembali)}</td>
                    <td className={kelas.td}>{t.hari_terlambat} hari</td>
                    <td className={`${kelas.td} font-semibold text-orange-700`}>{formatRupiah(t.denda)}</td>
                    <td className={kelas.td}>
                      <button className={kelas.tombolKecil} onClick={() => setAkanLunas(t)}>Tandai Lunas</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {konfirmasi === 'kembali' && pinjaman && (
        <Konfirmasi
          judul={`Tandai eksemplar ${labelKondisi[kondisi].toLowerCase()}?`}
          labelYa={`Ya, ${labelKondisi[kondisi]}`}
          bahaya
          sibuk={sibuk}
          onYa={() => void simpanPengembalian()}
          onBatal={() => setKonfirmasi(null)}
        >
          Eksemplar <b>{pinjaman.nomor_induk_eksemplar}</b> ("{pinjaman.judul}") akan dicatat kembali dengan kondisi{' '}
          <b>{labelKondisi[kondisi]}</b> dan tidak bisa dipinjam lagi sampai statusnya diubah petugas di menu Data Buku.
          {kondisi === 'hilang' && <p className="mt-2">Pilih Hilang hanya setelah dipastikan buku memang tidak ada.</p>}
        </Konfirmasi>
      )}

      {konfirmasi === 'perpanjang' && pinjaman && (
        <Konfirmasi judul="Perpanjang pinjaman?" labelYa="Perpanjang" sibuk={sibuk} onYa={() => void perpanjang()} onBatal={() => setKonfirmasi(null)}>
          Pinjaman "<b>{pinjaman.judul}</b>" oleh {pinjaman.nama_anggota} akan diperpanjang.
          Jatuh tempo berubah dari <b>{formatTanggal(pinjaman.tanggal_jatuh_tempo)}</b> menjadi{' '}
          <b>{formatTanggal(pinjaman.jatuh_tempo_jika_diperpanjang)}</b>.
        </Konfirmasi>
      )}

      {akanLunas && (
        <Konfirmasi judul="Tandai denda lunas?" labelYa="Tandai Lunas" sibuk={sibuk} onYa={() => void lunasi()} onBatal={() => setAkanLunas(null)}>
          Denda <b>{formatRupiah(akanLunas.denda)}</b> atas nama <b>{akanLunas.nama_anggota}</b> untuk buku "{akanLunas.judul}"
          akan ditandai lunas. Pastikan uangnya sudah diterima.
        </Konfirmasi>
      )}
    </div>
  )
}
