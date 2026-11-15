import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ambilSemua } from '../../lib/ambilSemua'
import { pesanGalat } from '../../lib/galat'
import { awalHariWIB, formatTanggal, geserTanggal, hariIniWIB, tanggalWIB } from '../../lib/tanggal'
import { BarisInfo, JudulHalaman, KartuRingkas, Pemberitahuan, kelas } from '../../components/ui'

interface JatuhTempo {
  id_detail: number
  nama_anggota: string
  kelas: string | null
  jenis_anggota: string
  judul: string
  nomor_induk_eksemplar: string
  tanggal_jatuh_tempo: string
}

interface DataDashboard {
  pinjamHariIni: number
  kembaliHariIni: number
  terlambat: number
  jatuhTempo: JatuhTempo[]
  grafik: { tanggal: string; jumlah: number }[]
  koleksi: { label: string; jumlah: number }[]
}

async function hitung(tabel: string, saring?: (q: any) => any): Promise<number> { // eslint-disable-line @typescript-eslint/no-explicit-any
  let q = supabase.from(tabel).select('*', { count: 'exact', head: true })
  if (saring) q = saring(q)
  const { count, error } = await q
  if (error) throw error
  return count ?? 0
}

async function muatDashboard(): Promise<DataDashboard> {
  const hariIni = hariIniWIB()
  const tujuhHari = Array.from({ length: 7 }, (_, i) => geserTanggal(hariIni, i - 6))

  const [pinjam7, kembaliHariIni, terlambat, jatuhTempo, judul, eksemplar, tersedia, dipinjam, rusak, hilang] = await Promise.all([
    ambilSemua<{ tanggal_pinjam: string }>((dari, sampai) =>
      supabase.from('v_pinjaman').select('tanggal_pinjam').gte('tanggal_pinjam', awalHariWIB(tujuhHari[0])).order('id_detail').range(dari, sampai),
    ),
    hitung('v_pinjaman', (q) => q.gte('tanggal_kembali', awalHariWIB(hariIni))),
    hitung('v_keterlambatan'),
    supabase
      .from('v_pinjaman')
      .select('id_detail, nama_anggota, kelas, jenis_anggota, judul, nomor_induk_eksemplar, tanggal_jatuh_tempo')
      .eq('status', 'dipinjam')
      .eq('tanggal_jatuh_tempo', hariIni)
      .order('nama_anggota')
      .then(({ data, error }) => {
        if (error) throw error
        return (data ?? []) as JatuhTempo[]
      }),
    hitung('buku'),
    hitung('eksemplar'),
    hitung('eksemplar', (q) => q.eq('status', 'tersedia')),
    hitung('eksemplar', (q) => q.eq('status', 'dipinjam')),
    hitung('eksemplar', (q) => q.eq('status', 'rusak')),
    hitung('eksemplar', (q) => q.eq('status', 'hilang')),
  ])

  const perHari = new Map<string, number>(tujuhHari.map((t) => [t, 0]))
  for (const p of pinjam7) {
    const t = tanggalWIB(p.tanggal_pinjam)
    if (perHari.has(t)) perHari.set(t, perHari.get(t)! + 1)
  }

  return {
    pinjamHariIni: perHari.get(hariIni) ?? 0,
    kembaliHariIni,
    terlambat,
    jatuhTempo,
    grafik: tujuhHari.map((t) => ({ tanggal: t, jumlah: perHari.get(t) ?? 0 })),
    koleksi: [
      { label: 'Judul buku', jumlah: judul },
      { label: 'Total eksemplar', jumlah: eksemplar },
      { label: 'Eksemplar tersedia', jumlah: tersedia },
      { label: 'Eksemplar dipinjam', jumlah: dipinjam },
      { label: 'Eksemplar rusak', jumlah: rusak },
      { label: 'Eksemplar hilang', jumlah: hilang },
    ],
  }
}

export default function Dashboard() {
  const [data, setData] = useState<DataDashboard | null>(null)
  const [galat, setGalat] = useState('')

  useEffect(() => {
    let batal = false
    muatDashboard()
      .then((d) => !batal && setData(d))
      .catch((e) => !batal && setGalat(pesanGalat(e)))
    return () => {
      batal = true
    }
  }, [])

  const tertinggi = Math.max(1, ...(data?.grafik.map((g) => g.jumlah) ?? [1]))
  const angka = (n: number | undefined) => (data ? n : '…')

  return (
    <div>
      <JudulHalaman>Dashboard</JudulHalaman>
      {galat && (
        <div className="mb-4">
          <Pemberitahuan pesan={{ jenis: 'galat', teks: galat }} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KartuRingkas label="Peminjaman Hari Ini" nilai={angka(data?.pinjamHariIni)} />
        <KartuRingkas label="Pengembalian Hari Ini" nilai={angka(data?.kembaliHariIni)} />
        <KartuRingkas label="Jatuh Tempo Hari Ini" nilai={angka(data?.jatuhTempo.length)} warna={data && data.jatuhTempo.length > 0 ? 'oranye' : undefined} />
        <div className={`${kelas.kartu} relative overflow-hidden p-4 text-center`}>
          <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-orange-400" />
          <div className="text-sm text-slate-500">Pinjaman Terlambat</div>
          <div className={`mt-1 text-3xl font-bold ${data && data.terlambat > 0 ? 'text-orange-600' : 'text-slate-800'}`}>{angka(data?.terlambat)}</div>
          <Link to="/petugas/keterlambatan" className="mt-1 inline-flex min-h-9 items-center rounded-full border border-utama-200 px-3 text-xs font-medium text-slate-700 hover:bg-utama-50">
            Lihat daftar
          </Link>
        </div>
      </div>
      <p className="mt-1 text-xs text-slate-500">Angka peminjaman dan pengembalian dihitung per buku.</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link className={kelas.tombolUtama} to="/petugas/peminjaman">+ Catat Peminjaman</Link>
        <Link className={kelas.tombol} to="/petugas/pengembalian">Catat Pengembalian</Link>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[3fr_2fr]">
        <section className={`${kelas.kartu} p-4`}>
          <h2 className="text-lg font-semibold">Grafik Peminjaman 7 Hari Terakhir</h2>
          <div className="mt-4 flex h-48 items-end gap-2 border-b border-l border-utama-200 px-2" role="img"
            aria-label={`Jumlah buku dipinjam per hari: ${data?.grafik.map((g) => `${formatTanggal(g.tanggal)} ${g.jumlah}`).join(', ') ?? 'memuat'}`}>
            {(data?.grafik ?? []).map((g) => (
              <div key={g.tanggal} className="flex h-full flex-1 flex-col items-center justify-end">
                <span className="mb-1 text-xs font-medium text-slate-600">{g.jumlah}</span>
                <div
                  className={`w-full max-w-14 rounded-t ${g.jumlah > 0 ? 'bg-utama-600' : 'bg-slate-200'}`}
                  style={{ height: `${g.jumlah > 0 ? Math.max(6, (g.jumlah / tertinggi) * 80) : 2}%` }}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2 px-2 pt-1">
            {(data?.grafik ?? []).map((g) => (
              <div key={g.tanggal} className="flex-1 text-center text-xs text-slate-500">{formatTanggal(g.tanggal).slice(0, 5)}</div>
            ))}
          </div>
        </section>

        <section className={`${kelas.kartu} p-4`}>
          <h2 className="text-lg font-semibold">Ringkasan Koleksi</h2>
          <table className="mt-3 w-full">
            <thead className="border-b border-utama-100 bg-utama-50/70">
              <tr>
                <th className={kelas.th}>Keterangan</th>
                <th className={`${kelas.th} text-right`}>Jumlah</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-utama-100/70">
              {(data?.koleksi ?? []).map((k) => (
                <tr key={k.label}>
                  <td className={kelas.td}>{k.label}</td>
                  <td className={`${kelas.td} text-right font-medium`}>{k.jumlah}</td>
                </tr>
              ))}
              {!data && <BarisInfo kolom={2}>Memuat data...</BarisInfo>}
            </tbody>
          </table>
        </section>
      </div>

      <section className={`${kelas.kartu} mt-4 p-4`}>
        <h2 className="text-lg font-semibold">Jatuh Tempo Hari Ini</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-utama-100 bg-utama-50/70">
              <tr>
                <th className={kelas.th}>No.</th>
                <th className={kelas.th}>Nama Anggota</th>
                <th className={kelas.th}>Kelas</th>
                <th className={kelas.th}>Judul Buku</th>
                <th className={kelas.th}>No. Induk</th>
                <th className={kelas.th}>Jatuh Tempo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-utama-100/70">
              {!data ? (
                <BarisInfo kolom={6}>Memuat data...</BarisInfo>
              ) : data.jatuhTempo.length === 0 ? (
                <BarisInfo kolom={6}>Tidak ada pinjaman yang jatuh tempo hari ini.</BarisInfo>
              ) : (
                data.jatuhTempo.map((j, i) => (
                  <tr key={j.id_detail}>
                    <td className={kelas.td}>{i + 1}</td>
                    <td className={`${kelas.td} font-medium`}>{j.nama_anggota}</td>
                    <td className={kelas.td}>{j.kelas ?? (j.jenis_anggota === 'guru' ? 'Guru' : '-')}</td>
                    <td className={kelas.td}>{j.judul}</td>
                    <td className={kelas.td}>
                      <Link className="text-utama-700 underline" to={`/petugas/pengembalian?no=${encodeURIComponent(j.nomor_induk_eksemplar)}`}>
                        {j.nomor_induk_eksemplar}
                      </Link>
                    </td>
                    <td className={kelas.td}>{formatTanggal(j.tanggal_jatuh_tempo)}</td>
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
