import { Navigate, Route, Routes } from 'react-router-dom'
import LayoutPetugas from './layouts/LayoutPetugas'
import LayoutAnggota from './layouts/LayoutAnggota'
import Login from './pages/Login'
import GantiKataSandi from './pages/GantiKataSandi'
import Dashboard from './pages/petugas/Dashboard'
import DataKategori from './pages/petugas/DataKategori'
import DataBuku from './pages/petugas/DataBuku'
import DetailBuku from './pages/petugas/DetailBuku'
import DataAnggota from './pages/petugas/DataAnggota'
import Peminjaman from './pages/petugas/Peminjaman'
import BuktiPeminjaman from './pages/petugas/BuktiPeminjaman'
import Pengembalian from './pages/petugas/Pengembalian'
import Keterlambatan from './pages/petugas/Keterlambatan'
import Laporan from './pages/petugas/Laporan'
import Pengaturan from './pages/petugas/Pengaturan'
import Beranda from './pages/anggota/Beranda'
import Katalog from './pages/anggota/Katalog'
import DetailBukuAnggota from './pages/anggota/DetailBukuAnggota'
import PinjamanSaya from './pages/anggota/PinjamanSaya'
import Profil from './pages/anggota/Profil'
import UbahKataSandi from './pages/petugas/UbahKataSandi'
import { ArahkanAwal, HanyaTamu, WajibLogin } from './auth/Penjaga'

// Setiap kelompok halaman dijaga sesuai peran. Penjagaan di sini hanya untuk
// kenyamanan tampilan; keamanan data yang sebenarnya ditegakkan RLS di database.
export default function App() {
  return (
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
  )
}
