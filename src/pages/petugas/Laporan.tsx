import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../../auth/KonteksAuth'
import { supabase } from '../../lib/supabase'
import { NAMA_SEKOLAH } from '../../lib/config'
import { pesanGalat } from '../../lib/galat'
import { NAMA_LAPORAN, buatLaporan, type HasilLaporan, type JenisLaporan } from '../../lib/laporan'
import { awalBulan, formatTanggal, formatWaktu, hariIniWIB } from '../../lib/tanggal'
import { JudulHalaman, KartuRingkas, Pemberitahuan, kelas, type Pesan } from '../../components/ui'

const TAB: { kunci: JenisLaporan; label: string }[] = [
  { kunci: 'peminjaman', label: 'Peminjaman' },
  { kunci: 'keterlambatan', label: 'Keterlambatan' },
  { kunci: 'buku_terpopuler', label: 'Buku Terpopuler' },
  { kunci: 'koleksi', label: 'Koleksi' },
]

export default function Laporan() {
  const { profil } = useAuth()
  const [jenis, setJenis] = useState<JenisLaporan>('peminjaman')
  const [awal, setAwal] = useState(awalBulan(hariIniWIB()))
  const [akhir, setAkhir] = useState(hariIniWIB())
  const [hasil, setHasil] = useState<HasilLaporan | null>(null)
  const [memuat, setMemuat] = useState(false)
  const [pesan, setPesan] = useState<Pesan | null>(null)
  const [waktuCetak, setWaktuCetak] = useState(new Date())

  const tampilkan = useCallback(async (j: JenisLaporan, a: string, b: string) => {
    setPesan(null)
    if (!a || !b) return setPesan({ jenis: 'galat', teks: 'Isi tanggal awal dan akhir periode.' })
    if (a > b) return setPesan({ jenis: 'galat', teks: 'Tanggal awal periode tidak boleh setelah tanggal akhir.' })
    setMemuat(true)
    try {
      setHasil(await buatLaporan(j, a, b))
    } catch (galat) {
      setHasil(null)
      setPesan({ jenis: 'galat', teks: pesanGalat(galat) })
    } finally {
      setMemuat(false)
    }
  }, [])

  // Laporan langsung tampil saat halaman dibuka atau tab diganti
  useEffect(() => {
    void tampilkan(jenis, awal, akhir)
    // periode baru diterapkan lewat tombol Tampilkan
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jenis, tampilkan])

  function kirim(e: FormEvent) {
    e.preventDefault()
    void tampilkan(jenis, awal, akhir)
  }

  async function cetak() {
    if (!hasil || !profil) return
    setWaktuCetak(new Date())
    // Mencatat histori pembuatan laporan (siapa, jenis, periode, kapan)
    const { error } = await supabase.from('laporan').insert({
      id_petugas: profil.id,
      jenis_laporan: hasil.jenis,
      periode_awal: hasil.awal,
      periode_akhir: hasil.akhir,
    })
    if (error) setPesan({ jenis: 'galat', teks: `Laporan tetap bisa dicetak, tetapi histori cetak gagal dicatat: ${pesanGalat(error)}` })
    // beri waktu tampilan memperbarui jam cetak sebelum jendela cetak terbuka
    setTimeout(() => window.print(), 50)
  }

  const berubah = hasil !== null && (hasil.awal !== awal || hasil.akhir !== akhir)

  return (
    <div>
      <div className="no-print">
        <JudulHalaman>Laporan Perpustakaan</JudulHalaman>

        <div className={kelas.barisTab} role="tablist">
          {TAB.map((t) => (
            <button
              key={t.kunci}
              role="tab"
              aria-selected={jenis === t.kunci}
              onClick={() => setJenis(t.kunci)}
              className={kelas.tab(jenis === t.kunci)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={kirim} className="mt-3 flex flex-wrap items-center gap-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="awal">Periode</label>
          <input id="awal" type="date" className={`${kelas.input} w-44`} value={awal} max={akhir || undefined} onChange={(e) => setAwal(e.target.value)} />
          <label className="text-sm text-slate-600" htmlFor="akhir">s.d.</label>
          <input id="akhir" type="date" className={`${kelas.input} w-44`} value={akhir} min={awal || undefined} onChange={(e) => setAkhir(e.target.value)} />
          <button className={kelas.tombol} type="submit" disabled={memuat}>{memuat ? 'Memuat...' : 'Tampilkan'}</button>
          <button className={kelas.tombol} type="button" disabled={!hasil || memuat || berubah} onClick={() => void cetak()}>Cetak</button>
          <button className={kelas.tombolUtama} type="button" disabled={!hasil || memuat || berubah} onClick={() => void cetak()}>Unduh PDF</button>
        </form>
        <p className="mt-1 text-xs text-slate-500">
          {berubah
            ? 'Periode diubah. Klik Tampilkan dulu sebelum mencetak.'
            : 'Unduh PDF: pada jendela cetak, pilih printer "Simpan sebagai PDF" (Save as PDF).'}
        </p>

        <div className="mt-3">
          <Pemberitahuan pesan={pesan} onTutup={() => setPesan(null)} />
        </div>
      </div>

      {hasil && (
        <div className="mt-4 print:mt-0">
          {/* Kepala laporan: hanya muncul saat dicetak */}
          <div className="hidden border-b-2 border-slate-800 pb-2 text-center print:block">
            <div className="text-lg font-bold uppercase">Perpustakaan {NAMA_SEKOLAH}</div>
            <div className="text-base font-semibold">{NAMA_LAPORAN[hasil.jenis]}</div>
            <div className="text-sm">Periode {formatTanggal(hasil.awal)} s.d. {formatTanggal(hasil.akhir)}</div>
          </div>

          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4 print:mt-3 print:grid-cols-4 print:gap-2">
            {hasil.ringkasan.map((r) => (
              <KartuRingkas key={r.label} label={r.label} nilai={r.nilai} />
            ))}
          </div>

          {hasil.tabel.map((t, nomor) => (
            <section key={nomor} className={`${kelas.kartu} mt-4 p-4 print:mt-3 print:border-0 print:p-0`}>
              <h2 className="text-lg font-semibold print:text-base">{t.judul ?? 'Hasil Laporan'}</h2>
              <div className="mt-3 overflow-x-auto print:mt-1 print:overflow-visible">
                <table className="tabel-laporan w-full">
                  <thead className="border-b border-utama-100 bg-utama-50/70">
                    <tr>
                      {t.kolom.map((k, i) => (
                        <th key={k} className={`${kelas.th} ${t.kanan?.includes(i) ? 'text-right' : ''}`}>{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-utama-100/70">
                    {t.baris.length === 0 ? (
                      <tr>
                        <td colSpan={t.kolom.length} className="px-3 py-6 text-center text-sm text-slate-500">{t.kosong}</td>
                      </tr>
                    ) : (
                      t.baris.map((b, i) => (
                        <tr key={i} className={b[0] === 'JUMLAH' ? 'bg-utama-50 font-semibold' : ''}>
                          {b.map((sel, j) => (
                            <td key={j} className={`${kelas.td} ${t.kanan?.includes(j) ? 'text-right' : ''}`}>{sel}</td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          ))}

          {hasil.keterangan && <p className="mt-3 text-sm italic text-slate-500 print:text-xs">{hasil.keterangan}</p>}

          {/* Kaki laporan: hanya muncul saat dicetak */}
          <div className="hidden print:block">
            <p className="mt-2 text-xs">Dicetak {formatWaktu(waktuCetak)} WIB oleh {profil?.nama}.</p>
            <div className="mt-5 grid grid-cols-2 text-center text-sm" style={{ breakInside: 'avoid' }}>
              <div>
                <div>Mengetahui,</div>
                <div>Kepala Sekolah</div>
                <div className="mt-12">(.................................................)</div>
              </div>
              <div>
                <div>&nbsp;</div>
                <div>Petugas Perpustakaan</div>
                <div className="mt-12">( {profil?.nama} )</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
