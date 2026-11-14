import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { NAMA_SEKOLAH } from '../../lib/config'
import { pesanGalat } from '../../lib/galat'
import { nomorTransaksi } from '../../lib/sirkulasi'
import { formatJam, formatTanggal } from '../../lib/tanggal'
import { JudulHalaman, Pemberitahuan, kelas } from '../../components/ui'

interface BarisBukti {
  id_detail: number
  tanggal_pinjam: string
  nama_anggota: string
  nomor_induk_anggota: string
  kelas: string | null
  nama_petugas: string | null
  nomor_induk_eksemplar: string
  judul: string
  tanggal_jatuh_tempo: string
}

export default function BuktiPeminjaman() {
  const { id } = useParams()
  const lokasi = useLocation()
  const baruDisimpan = Boolean((lokasi.state as { baru?: boolean } | null)?.baru)
  const idPeminjaman = Number(id)
  const [baris, setBaris] = useState<BarisBukti[] | null>(null)
  const [galat, setGalat] = useState('')

  useEffect(() => {
    if (!Number.isInteger(idPeminjaman) || idPeminjaman <= 0) {
      setGalat('Nomor transaksi tidak sah.')
      return
    }
    let batal = false
    void supabase
      .from('v_pinjaman')
      .select('id_detail, tanggal_pinjam, nama_anggota, nomor_induk_anggota, kelas, nama_petugas, nomor_induk_eksemplar, judul, tanggal_jatuh_tempo')
      .eq('id_peminjaman', idPeminjaman)
      .order('id_detail')
      .then(({ data, error }) => {
        if (batal) return
        if (error) setGalat(pesanGalat(error))
        else if (!data?.length) setGalat('Transaksi peminjaman tidak ditemukan.')
        else setBaris(data as BarisBukti[])
      })
    return () => {
      batal = true
    }
  }, [idPeminjaman])

  if (galat) {
    return (
      <div>
        <JudulHalaman>Bukti Peminjaman</JudulHalaman>
        <Pemberitahuan pesan={{ jenis: 'galat', teks: galat }} />
        <Link className={`${kelas.tombol} mt-4`} to="/petugas/peminjaman">Kembali</Link>
      </div>
    )
  }
  if (!baris) return <p className="text-slate-500">Memuat bukti peminjaman...</p>

  const kepala = baris[0]
  return (
    <div>
      <div className="no-print">
        <JudulHalaman>Bukti Peminjaman</JudulHalaman>
        {baruDisimpan && (
          <div className="mb-4">
            <Pemberitahuan pesan={{ jenis: 'sukses', teks: `Peminjaman ${baris.length} buku untuk ${kepala.nama_anggota} berhasil dicatat.` }} />
          </div>
        )}
      </div>

      <div className="mx-auto max-w-xl rounded-xl border border-slate-300 bg-white p-6 print:max-w-none print:rounded-none print:border-0 print:p-0">
        <div className="border-b border-slate-300 pb-3 text-center">
          <div className="text-lg font-bold uppercase tracking-wide">Perpustakaan {NAMA_SEKOLAH}</div>
          <div className="text-sm italic text-slate-600">Bukti Peminjaman Buku</div>
        </div>

        <table className="mt-4 w-full border border-slate-300 text-sm">
          <tbody className="divide-y divide-slate-300">
            <tr>
              <th className="w-2/5 border-r border-slate-300 px-3 py-2 text-left font-medium">No. Transaksi</th>
              <td className="px-3 py-2">{nomorTransaksi(idPeminjaman)}</td>
            </tr>
            <tr>
              <th className="border-r border-slate-300 px-3 py-2 text-left font-medium">Tanggal</th>
              <td className="px-3 py-2">{formatTanggal(kepala.tanggal_pinjam)} pukul {formatJam(kepala.tanggal_pinjam)} WIB</td>
            </tr>
            <tr>
              <th className="border-r border-slate-300 px-3 py-2 text-left font-medium">Anggota</th>
              <td className="px-3 py-2">
                {kepala.nama_anggota} ({kepala.nomor_induk_anggota}){kepala.kelas ? ` - Kelas ${kepala.kelas}` : ''}
              </td>
            </tr>
            <tr>
              <th className="border-r border-slate-300 px-3 py-2 text-left font-medium">Petugas</th>
              <td className="px-3 py-2">{kepala.nama_petugas ?? '-'}</td>
            </tr>
          </tbody>
        </table>

        <table className="mt-4 w-full border border-slate-300 text-sm">
          <thead className="bg-slate-100">
            <tr className="divide-x divide-slate-300 border-b border-slate-300">
              <th className="px-3 py-2 text-left font-semibold">No. Induk</th>
              <th className="px-3 py-2 text-left font-semibold">Judul</th>
              <th className="px-3 py-2 text-left font-semibold">Jatuh Tempo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-300">
            {baris.map((b) => (
              <tr key={b.id_detail} className="divide-x divide-slate-300">
                <td className="px-3 py-2">{b.nomor_induk_eksemplar}</td>
                <td className="px-3 py-2">{b.judul}</td>
                <td className="whitespace-nowrap px-3 py-2">{formatTanggal(b.tanggal_jatuh_tempo)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mt-4 text-center text-sm italic text-slate-600">Harap kembalikan buku sebelum tanggal jatuh tempo.</p>

        <div className="no-print mt-5 flex flex-wrap justify-center gap-2">
          <button className={kelas.tombolUtama} onClick={() => window.print()}>Cetak</button>
          <button className={kelas.tombol} onClick={() => window.print()} title='Pada jendela cetak, pilih printer "Simpan sebagai PDF"'>
            Simpan PDF
          </button>
          <Link className={kelas.tombol} to="/petugas/peminjaman">Kembali</Link>
        </div>
        <p className="no-print mt-2 text-center text-xs text-slate-500">
          Untuk menyimpan sebagai PDF, pilih printer "Simpan sebagai PDF" (Save as PDF) pada jendela cetak.
        </p>
      </div>
    </div>
  )
}
