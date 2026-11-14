import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import LayoutPetugas from './layouts/LayoutPetugas'
import LayoutAnggota from './layouts/LayoutAnggota'
import Login from './pages/Login'
import { ArahkanAwal, HanyaTamu, LayarMemuat, WajibLogin } from './auth/Penjaga'

// Halaman dimuat saat dibutuhkan, agar HP anggota tidak mengunduh kode halaman petugas
const GantiKataSandi = lazy(() => import('./pages/GantiKataSandi'))
const Dashboard = lazy(() => import('./pages/petugas/Dashboard'))
const DataKategori = lazy(() => import('./pages/petugas/DataKategori'))
const DataBuku = lazy(() => import('./pages/petugas/DataBuku'))
const DetailBuku = lazy(() => import('./pages/petugas/DetailBuku'))
const DataAnggota = lazy(() => import('./pages/petugas/DataAnggota'))
const Peminjaman = lazy(() => import('./pages/petugas/Peminjaman'))
const BuktiPeminjaman = lazy(() => import('./pages/petugas/BuktiPeminjaman'))
const Pengembalian = lazy(() => import('./pages/petugas/Pengembalian'))
const Keterlambatan = lazy(() => import('./pages/petugas/Keterlambatan'))
const Laporan = lazy(() => import('./pages/petugas/Laporan'))
const Pengaturan = lazy(() => import('./pages/petugas/Pengaturan'))
const Beranda = lazy(() => import('./pages/anggota/Beranda'))
const Katalog = lazy(() => import('./pages/anggota/Katalog'))
const DetailBukuAnggota = lazy(() => import('./pages/anggota/DetailBukuAnggota'))
const PinjamanSaya = lazy(() => import('./pages/anggota/PinjamanSaya'))
const Profil = lazy(() => import('./pages/anggota/Profil'))
const UbahKataSandi = lazy(() => import('./pages/petugas/UbahKataSandi'))

// Setiap kelompok halaman dijaga sesuai peran. Penjagaan di sini hanya untuk
// kenyamanan tampilan; keamanan data yang sebenarnya ditegakkan RLS di database.
export default function App() {
  return (
    <Suspense fallback={<LayarMemuat />}>
    <Routes>
      <Route path="/" element={<ArahkanAwal />} />
      <Route path="/login" element={<HanyaTamu><Login /></HanyaTamu>} />
      <Route path="/ganti-kata-sandi" element={<GantiKataSandi />} />

      <Route path="/petugas" element={<WajibLogin peran="petugas"><LayoutPetugas /></WajibLogin>}>
        <Route index element={<Dashboard />} />
        <Route path="kategori" element={<DataKategori />} />
        <Route path="buku" element={<DataBuku />} />
        <Route path="buku/:id" element={<DetailBuku />} />
        <Route path="anggota" element={<DataAnggota />} />
        <Route path="peminjaman" element={<Peminjaman />} />
        <Route path="peminjaman/bukti/:id" element={<BuktiPeminjaman />} />
        <Route path="pengembalian" element={<Pengembalian />} />
        <Route path="keterlambatan" element={<Keterlambatan />} />
        <Route path="laporan" element={<Laporan />} />
        <Route path="pengaturan" element={<Pengaturan />} />
        <Route path="ubah-kata-sandi" element={<UbahKataSandi />} />
      </Route>

      <Route path="/anggota" element={<WajibLogin peran="anggota"><LayoutAnggota /></WajibLogin>}>
        <Route index element={<Beranda />} />
        <Route path="katalog" element={<Katalog />} />
        <Route path="buku/:id" element={<DetailBukuAnggota />} />
        <Route path="pinjaman" element={<PinjamanSaya />} />
        <Route path="profil" element={<Profil />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  )
}
