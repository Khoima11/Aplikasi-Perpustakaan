// Penyusun isi laporan. Isi laporan selalu dihitung dari data transaksi dan koleksi;
// tabel "laporan" di database hanya mencatat bahwa laporan pernah dicetak.
import { supabase } from './supabase'
import { ambilSemua } from './ambilSemua'
import { formatRupiah } from './format'
import { awalHariWIB, formatTanggal, geserTanggal } from './tanggal'

export type JenisLaporan = 'peminjaman' | 'keterlambatan' | 'buku_terpopuler' | 'koleksi'

export const NAMA_LAPORAN: Record<JenisLaporan, string> = {
  peminjaman: 'Laporan Peminjaman',
  keterlambatan: 'Laporan Keterlambatan',
  buku_terpopuler: 'Laporan Buku Terpopuler',
  koleksi: 'Laporan Koleksi',
}

export interface TabelLaporan {
  judul?: string
  kolom: string[]
  baris: (string | number)[][]
  /** teks bila tabel tidak punya baris */
  kosong: string
  /** kolom yang rata kanan (angka) */
  kanan?: number[]
}

export interface HasilLaporan {
  jenis: JenisLaporan
  awal: string
  akhir: string
  ringkasan: { label: string; nilai: string | number }[]
  tabel: TabelLaporan[]
  keterangan?: string
}

interface BarisPinjaman {
  id_detail: number
  id_peminjaman: number
  tanggal_pinjam: string
  id_anggota: number
  nama_anggota: string
  nomor_induk_anggota: string
  jenis_anggota: string
  kelas: string | null
  id_buku: number
  judul: string
  pengarang: string | null
  nomor_induk_eksemplar: string
  tanggal_jatuh_tempo: string
  tanggal_kembali: string | null
  hari_terlambat: number
  denda: number
  status_denda: 'tidak_ada' | 'belum_lunas' | 'lunas'
  status: 'dipinjam' | 'dikembalikan' | 'hilang'
  terlambat: boolean
  hari_lewat_jatuh_tempo: number | null
}

const KOLOM_PINJAMAN =
  'id_detail, id_peminjaman, tanggal_pinjam, id_anggota, nama_anggota, nomor_induk_anggota, jenis_anggota, kelas, id_buku, judul, pengarang, nomor_induk_eksemplar, tanggal_jatuh_tempo, tanggal_kembali, hari_terlambat, denda, status_denda, status, terlambat, hari_lewat_jatuh_tempo'

const jenisKelas = (p: BarisPinjaman) => (p.jenis_anggota === 'guru' ? 'Guru' : `Siswa ${p.kelas ?? ''}`.trim())

function statusPinjaman(p: BarisPinjaman): string {
  if (p.status === 'hilang') return 'Hilang'
  if (p.status === 'dipinjam') return p.terlambat ? 'Terlambat (belum kembali)' : 'Dipinjam'
  return p.hari_terlambat > 0 ? 'Kembali terlambat' : 'Dikembalikan'
}

/** Pinjaman yang tanggal pinjamnya berada dalam periode (menurut WIB) */
function pinjamanPadaPeriode(awal: string, akhir: string): Promise<BarisPinjaman[]> {
  return ambilSemua<BarisPinjaman>((dari, sampai) =>
    supabase
      .from('v_pinjaman')
      .select(KOLOM_PINJAMAN)
      .gte('tanggal_pinjam', awalHariWIB(awal))
      .lt('tanggal_pinjam', awalHariWIB(geserTanggal(akhir, 1)))
      .order('tanggal_pinjam')
      .order('id_detail')
      .range(dari, sampai),
  )
}

interface BarisKoleksi {
  id_buku: number
  judul: string
  pengarang: string | null
  nama_kategori: string
  total_eksemplar: number
  tersedia: number
  dipinjam: number
  rusak: number
  hilang: number
}

function semuaBuku(): Promise<BarisKoleksi[]> {
  return ambilSemua<BarisKoleksi>((dari, sampai) =>
    supabase
      .from('v_ketersediaan_buku')
      .select('id_buku, judul, pengarang, nama_kategori, total_eksemplar, tersedia, dipinjam, rusak, hilang')
      .order('id_buku')
      .range(dari, sampai),
  )
}

async function laporanPeminjaman(awal: string, akhir: string): Promise<HasilLaporan> {
  const data = await pinjamanPadaPeriode(awal, akhir)
  const terlambat = data.filter((p) => p.hari_terlambat > 0 || p.terlambat)
  return {
    jenis: 'peminjaman',
    awal,
    akhir,
    ringkasan: [
      { label: 'Total Transaksi', nilai: new Set(data.map((p) => p.id_peminjaman)).size },
      { label: 'Buku Dipinjam', nilai: data.length },
      { label: 'Anggota Meminjam', nilai: new Set(data.map((p) => p.id_anggota)).size },
      { label: 'Pengembalian Terlambat', nilai: terlambat.length },
    ],
    tabel: [
      {
        kolom: ['No.', 'Tanggal', 'Anggota', 'Jenis', 'Judul Buku', 'Tgl Kembali', 'Status'],
        baris: data.map((p, i) => [
          i + 1,
          formatTanggal(p.tanggal_pinjam),
          `${p.nama_anggota} (${p.nomor_induk_anggota})`,
          jenisKelas(p),
          `${p.judul} [${p.nomor_induk_eksemplar}]`,
          p.tanggal_kembali ? formatTanggal(p.tanggal_kembali) : '-',
          statusPinjaman(p),
        ]),
        kosong: 'Tidak ada peminjaman pada periode ini.',
      },
    ],
    keterangan: 'Periode dihitung dari tanggal pinjam. "Pengembalian Terlambat" mencakup buku yang kembali terlambat dan yang masih terlambat (belum kembali).',
  }
}

async function laporanKeterlambatan(awal: string, akhir: string): Promise<HasilLaporan> {
  const semua = await ambilSemua<BarisPinjaman>((dari, sampai) =>
    supabase
      .from('v_pinjaman')
      .select(KOLOM_PINJAMAN)
      .gte('tanggal_jatuh_tempo', awal)
      .lte('tanggal_jatuh_tempo', akhir)
      .order('tanggal_jatuh_tempo')
      .order('id_detail')
      .range(dari, sampai),
  )
  const data = semua.filter((p) => p.hari_terlambat > 0 || p.terlambat)
  const hari = (p: BarisPinjaman) => (p.status === 'dipinjam' ? (p.hari_lewat_jatuh_tempo ?? 0) : p.hari_terlambat)
  data.sort((a, b) => hari(b) - hari(a))
  const belumKembali = data.filter((p) => p.status === 'dipinjam')
  const denda = data.reduce((jumlah, p) => jumlah + Number(p.denda), 0)
  const belumLunas = data.filter((p) => p.status_denda === 'belum_lunas').reduce((jumlah, p) => jumlah + Number(p.denda), 0)
  return {
    jenis: 'keterlambatan',
    awal,
    akhir,
    ringkasan: [
      { label: 'Pinjaman Terlambat', nilai: data.length },
      { label: 'Anggota Terlambat', nilai: new Set(data.map((p) => p.id_anggota)).size },
      { label: 'Belum Kembali', nilai: belumKembali.length },
      { label: 'Denda Tercatat', nilai: formatRupiah(denda) },
    ],
    tabel: [
      {
        kolom: ['No.', 'Anggota', 'Jenis', 'Judul Buku', 'Jatuh Tempo', 'Tgl Kembali', 'Hari Terlambat', 'Denda'],
        baris: data.map((p, i) => [
          i + 1,
          `${p.nama_anggota} (${p.nomor_induk_anggota})`,
          jenisKelas(p),
          `${p.judul} [${p.nomor_induk_eksemplar}]`,
          formatTanggal(p.tanggal_jatuh_tempo),
          p.tanggal_kembali ? formatTanggal(p.tanggal_kembali) : 'Belum kembali',
          hari(p),
          p.status === 'dipinjam'
            ? 'Dihitung saat kembali'
            : Number(p.denda) > 0
              ? `${formatRupiah(p.denda)} (${p.status_denda === 'lunas' ? 'lunas' : 'belum lunas'})`
              : 'Rp0',
        ]),
        kosong: 'Tidak ada keterlambatan pada periode ini.',
        kanan: [6],
      },
    ],
    keterangan: `Periode dihitung dari tanggal jatuh tempo. Denda tercatat hanya untuk buku yang sudah dikembalikan; ${formatRupiah(belumLunas)} di antaranya belum lunas. Pinjaman terlambat tidak otomatis dianggap hilang.`,
  }
}

async function laporanTerpopuler(awal: string, akhir: string): Promise<HasilLaporan> {
  const [data, buku] = await Promise.all([pinjamanPadaPeriode(awal, akhir), semuaBuku()])
  const kategori = new Map(buku.map((b) => [b.id_buku, b.nama_kategori]))
  const hitung = new Map<number, { judul: string; pengarang: string | null; jumlah: number }>()
  for (const p of data) {
    const ada = hitung.get(p.id_buku)
    if (ada) ada.jumlah++
    else hitung.set(p.id_buku, { judul: p.judul, pengarang: p.pengarang, jumlah: 1 })
  }
  const urut = [...hitung.entries()].sort((a, b) => b[1].jumlah - a[1].jumlah || a[1].judul.localeCompare(b[1].judul, 'id'))
  return {
    jenis: 'buku_terpopuler',
    awal,
    akhir,
    ringkasan: [
      { label: 'Total Peminjaman', nilai: data.length },
      { label: 'Judul Dipinjam', nilai: urut.length },
      { label: 'Judul Tidak Dipinjam', nilai: Math.max(buku.length - urut.length, 0) },
      { label: 'Paling Banyak Dipinjam', nilai: urut.length ? `${urut[0][1].jumlah} kali` : '-' },
    ],
    tabel: [
      {
        kolom: ['Peringkat', 'Judul Buku', 'Pengarang', 'Kategori', 'Jumlah Dipinjam'],
        baris: urut.map(([id, b], i) => [i + 1, b.judul, b.pengarang ?? '-', kategori.get(id) ?? '-', b.jumlah]),
        kosong: 'Tidak ada peminjaman pada periode ini.',
        kanan: [4],
      },
    ],
    keterangan: 'Periode dihitung dari tanggal pinjam. Satu eksemplar yang dipinjam dihitung satu kali.',
  }
}

async function laporanKoleksi(awal: string, akhir: string): Promise<HasilLaporan> {
  const [buku, bermasalah, masuk] = await Promise.all([
    semuaBuku(),
    ambilSemua<{ id_buku: number; nomor_induk: string; status: string; keterangan: string | null }>((dari, sampai) =>
      supabase.from('eksemplar').select('id_buku, nomor_induk, status, keterangan').in('status', ['rusak', 'hilang']).order('nomor_induk').range(dari, sampai),
    ),
    supabase
      .from('eksemplar')
      .select('*', { count: 'exact', head: true })
      .gte('tanggal_masuk', awal)
      .lte('tanggal_masuk', akhir)
      .then(({ count, error }) => {
        if (error) throw error
        return count ?? 0
      }),
  ])
  const jumlah = (kunci: 'total_eksemplar' | 'tersedia' | 'dipinjam' | 'rusak' | 'hilang', daftar = buku) =>
    daftar.reduce((n, b) => n + b[kunci], 0)
  const perKategori = new Map<string, BarisKoleksi[]>()
  for (const b of buku) perKategori.set(b.nama_kategori, [...(perKategori.get(b.nama_kategori) ?? []), b])
  const judul = new Map(buku.map((b) => [b.id_buku, b.judul]))
  const namaKategori = [...perKategori.keys()].sort((a, b) => a.localeCompare(b, 'id'))

  return {
    jenis: 'koleksi',
    awal,
    akhir,
    ringkasan: [
      { label: 'Judul Buku', nilai: buku.length },
      { label: 'Total Eksemplar', nilai: jumlah('total_eksemplar') },
      { label: 'Eksemplar Rusak', nilai: jumlah('rusak') },
      { label: 'Eksemplar Hilang', nilai: jumlah('hilang') },
    ],
    tabel: [
      {
        judul: 'Koleksi per Kategori',
        kolom: ['Kategori', 'Judul', 'Eksemplar', 'Tersedia', 'Dipinjam', 'Rusak', 'Hilang'],
        baris: [
          ...namaKategori.map((k) => {
            const d = perKategori.get(k)!
            return [k, d.length, jumlah('total_eksemplar', d), jumlah('tersedia', d), jumlah('dipinjam', d), jumlah('rusak', d), jumlah('hilang', d)]
          }),
          ['JUMLAH', buku.length, jumlah('total_eksemplar'), jumlah('tersedia'), jumlah('dipinjam'), jumlah('rusak'), jumlah('hilang')],
        ],
        kosong: 'Belum ada data koleksi.',
        kanan: [1, 2, 3, 4, 5, 6],
      },
      {
        judul: 'Eksemplar Rusak dan Hilang',
        kolom: ['No.', 'No. Induk', 'Judul Buku', 'Status', 'Keterangan'],
        baris: bermasalah.map((e, i) => [i + 1, e.nomor_induk, judul.get(e.id_buku) ?? '-', e.status === 'rusak' ? 'Rusak' : 'Hilang', e.keterangan ?? '-']),
        kosong: 'Tidak ada eksemplar rusak atau hilang.',
      },
    ],
    keterangan: `Laporan koleksi menunjukkan keadaan koleksi saat laporan dibuat. Eksemplar yang masuk pada periode ${formatTanggal(awal)} s.d. ${formatTanggal(akhir)}: ${masuk}.`,
  }
}

export function buatLaporan(jenis: JenisLaporan, awal: string, akhir: string): Promise<HasilLaporan> {
  switch (jenis) {
    case 'peminjaman':
      return laporanPeminjaman(awal, akhir)
    case 'keterlambatan':
      return laporanKeterlambatan(awal, akhir)
    case 'buku_terpopuler':
      return laporanTerpopuler(awal, akhir)
    case 'koleksi':
      return laporanKoleksi(awal, akhir)
  }
}
