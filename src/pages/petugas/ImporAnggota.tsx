import { useState } from 'react'
import { kelolaAkun } from '../../lib/akun'
import { KOLOM_IMPOR, bacaFileAnggota, unduhTemplate, type BarisImpor } from '../../lib/imporAnggota'
import { Lencana, Modal, Pemberitahuan, kelas, type Pesan } from '../../components/ui'

const BARIS_PER_KIRIM = 25

interface RincianServer {
  baris: number
  nomor_induk: string
  ok: boolean
  pesan: string
}

interface HasilImpor {
  berhasil: number
  gagal: { baris: number; nomor_induk: string; pesan: string }[]
}

export default function ImporAnggota({ onTutup, onSelesai }: { onTutup: () => void; onSelesai: () => void }) {
  const [namaBerkas, setNamaBerkas] = useState('')
  const [baris, setBaris] = useState<BarisImpor[] | null>(null)
  const [pesan, setPesan] = useState<Pesan | null>(null)
  const [sibuk, setSibuk] = useState(false)
  const [kemajuan, setKemajuan] = useState({ selesai: 0, total: 0 })
  const [hasil, setHasil] = useState<HasilImpor | null>(null)

  const sah = baris?.filter((b) => !b.galat) ?? []
  const bermasalah = baris?.filter((b) => b.galat) ?? []

  async function pilihBerkas(berkas: File | undefined) {
    if (!berkas) return
    setPesan(null)
    setHasil(null)
    setBaris(null)
    setNamaBerkas(berkas.name)
    setSibuk(true)
    try {
      setBaris(await bacaFileAnggota(berkas))
    } catch (e) {
      setPesan({ jenis: 'galat', teks: e instanceof Error ? e.message : 'File tidak bisa dibaca.' })
    } finally {
      setSibuk(false)
    }
  }

  async function impor() {
    if (sah.length === 0) return
    setSibuk(true)
    setPesan(null)
    setKemajuan({ selesai: 0, total: sah.length })
    const ringkas: HasilImpor = { berhasil: 0, gagal: [] }

    try {
      for (let awal = 0; awal < sah.length; awal += BARIS_PER_KIRIM) {
        const potongan = sah.slice(awal, awal + BARIS_PER_KIRIM)
        const { data } = await kelolaAkun<{ rincian: RincianServer[] }>('impor_anggota', {
          daftar: potongan.map((b) => b.data),
        })
        for (const r of data?.rincian ?? []) {
          if (r.ok) ringkas.berhasil++
          else ringkas.gagal.push({ baris: potongan[r.baris - 1]?.baris ?? 0, nomor_induk: r.nomor_induk, pesan: r.pesan })
        }
        setKemajuan({ selesai: Math.min(awal + potongan.length, sah.length), total: sah.length })
      }
      setHasil(ringkas)
      if (ringkas.berhasil > 0) onSelesai()
    } catch (e) {
      // Sebagian mungkin sudah masuk sebelum terputus
      setHasil(ringkas)
      if (ringkas.berhasil > 0) onSelesai()
      setPesan({
        jenis: 'galat',
        teks: `Impor berhenti di tengah jalan: ${e instanceof Error ? e.message : 'tidak diketahui'}\nBaris yang sudah berhasil tetap tersimpan. Baris sisanya bisa diimpor ulang; yang sudah ada akan ditolak sebagai "sudah terdaftar".`,
      })
    } finally {
      setSibuk(false)
    }
  }

  return (
    <Modal judul="Impor Anggota dari Excel" onTutup={sibuk ? () => undefined : onTutup} lebar="max-w-3xl">
      <div className="space-y-4">
        <div className="rounded-xl bg-utama-50 p-3 text-sm text-slate-700">
          <p className="font-medium">Cara impor</p>
          <ol className="mt-1 list-decimal space-y-0.5 pl-5">
            <li>Unduh template, lalu isi satu anggota per baris mulai baris ke-2.</li>
            <li>Simpan sebagai file Excel (.xlsx), lalu pilih filenya di sini.</li>
            <li>Periksa pratinjau, kemudian klik Impor.</li>
          </ol>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  {KOLOM_IMPOR.map((k) => (
                    <th key={k.kunci} className="border border-utama-200 bg-white px-2 py-1 text-left font-semibold">
                      {k.judul}{k.wajib && <span className="text-orange-600"> *</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[0, 1].map((i) => (
                  <tr key={i}>
                    {KOLOM_IMPOR.map((k) => (
                      <td key={k.kunci} className="border border-utama-200 bg-white px-2 py-1">{k.contoh[i] || <span className="text-slate-400">(kosong)</span>}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            * wajib diisi. Kelas wajib untuk siswa. Kata sandi awal setiap anggota sama dengan nomor induknya dan wajib diganti saat login pertama.
            Agar nomor tidak berubah, atur format sel kolom nomor_induk dan no_hp menjadi <b>Teks</b>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button className={kelas.tombol} onClick={() => void unduhTemplate()} disabled={sibuk}>Unduh Template</button>
          <label className={`${kelas.tombolUtama} cursor-pointer ${sibuk ? 'pointer-events-none opacity-60' : ''}`}>
            Pilih File Excel
            <input
              type="file"
              accept=".xlsx"
              className="sr-only"
              onChange={(e) => {
                void pilihBerkas(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </label>
          {namaBerkas && <span className="text-sm text-slate-600">{namaBerkas}</span>}
        </div>

        <Pemberitahuan pesan={pesan} />

        {baris && !hasil && (
          <div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Lencana warna="hijau">{sah.length} baris siap diimpor</Lencana>
              {bermasalah.length > 0 && <Lencana warna="oranye">{bermasalah.length} baris bermasalah (dilewati)</Lencana>}
            </div>
            <div className="mt-2 max-h-64 overflow-auto rounded-xl border border-utama-100">
              <table className="w-full">
                <thead className="sticky top-0 bg-utama-50">
                  <tr>
                    <th className={kelas.th}>Baris</th>
                    <th className={kelas.th}>Nomor Induk</th>
                    <th className={kelas.th}>Nama</th>
                    <th className={kelas.th}>Jenis</th>
                    <th className={kelas.th}>Kelas</th>
                    <th className={kelas.th}>Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-utama-100/70">
                  {baris.map((b) => (
                    <tr key={b.baris} className={b.galat ? 'bg-orange-50' : ''}>
                      <td className={kelas.td}>{b.baris}</td>
                      <td className={kelas.td}>{b.data.nomor_induk || '-'}</td>
                      <td className={kelas.td}>{b.data.nama || '-'}</td>
                      <td className={kelas.td}>{b.data.jenis_anggota || '-'}</td>
                      <td className={kelas.td}>{b.data.kelas || '-'}</td>
                      <td className={`${kelas.td} ${b.galat ? 'text-orange-800' : 'text-green-700'}`}>{b.galat ?? 'Siap'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {sibuk && kemajuan.total > 0 && (
              <p className="mt-2 text-sm text-slate-600" role="status">
                Mengimpor... {kemajuan.selesai} dari {kemajuan.total} baris. Jangan tutup halaman ini.
              </p>
            )}
          </div>
        )}

        {hasil && (
          <div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Lencana warna="hijau">{hasil.berhasil} anggota berhasil dibuat</Lencana>
              {hasil.gagal.length > 0 && <Lencana warna="oranye">{hasil.gagal.length} gagal</Lencana>}
              {bermasalah.length > 0 && <Lencana warna="abu">{bermasalah.length} dilewati saat pemeriksaan</Lencana>}
            </div>
            {hasil.gagal.length > 0 && (
              <div className="mt-2 max-h-56 overflow-auto rounded-xl border border-utama-100">
                <table className="w-full">
                  <thead className="sticky top-0 bg-utama-50">
                    <tr>
                      <th className={kelas.th}>Baris</th>
                      <th className={kelas.th}>Nomor Induk</th>
                      <th className={kelas.th}>Alasan gagal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-utama-100/70">
                    {hasil.gagal.map((g) => (
                      <tr key={`${g.baris}-${g.nomor_induk}`}>
                        <td className={kelas.td}>{g.baris}</td>
                        <td className={kelas.td}>{g.nomor_induk}</td>
                        <td className={`${kelas.td} text-orange-800`}>{g.pesan}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button className={kelas.tombol} onClick={onTutup} disabled={sibuk}>{hasil ? 'Selesai' : 'Batal'}</button>
          {baris && !hasil && (
            <button className={kelas.tombolUtama} onClick={() => void impor()} disabled={sibuk || sah.length === 0}>
              {sibuk ? 'Mengimpor...' : `Impor ${sah.length} Anggota`}
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}
