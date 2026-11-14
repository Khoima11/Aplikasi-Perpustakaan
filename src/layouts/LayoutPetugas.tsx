import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import Ikon, { type NamaIkon } from '../components/Ikon'
import Logo from '../components/Logo'
import PeringatanKonfigurasi from '../components/PeringatanKonfigurasi'

const menu: { ke: string; label: string; ikon: NamaIkon; persis?: boolean }[] = [
  { ke: '/petugas', label: 'Dashboard', ikon: 'dashboard', persis: true },
  { ke: '/petugas/kategori', label: 'Data Kategori', ikon: 'kategori' },
  { ke: '/petugas/buku', label: 'Data Buku', ikon: 'buku' },
  { ke: '/petugas/anggota', label: 'Data Anggota', ikon: 'anggota' },
  { ke: '/petugas/peminjaman', label: 'Peminjaman', ikon: 'pinjam' },
  { ke: '/petugas/pengembalian', label: 'Pengembalian', ikon: 'kembali' },
  { ke: '/petugas/keterlambatan', label: 'Keterlambatan', ikon: 'terlambat' },
  { ke: '/petugas/laporan', label: 'Laporan', ikon: 'laporan' },
  { ke: '/petugas/pengaturan', label: 'Pengaturan', ikon: 'pengaturan' },
]

export default function LayoutPetugas() {
  const [menuTerbuka, setMenuTerbuka] = useState(false)
  const navigate = useNavigate()
  // Nama petugas & logout yang sebenarnya dihubungkan pada Tahap 3
  const namaPengguna = 'Petugas'

  return (
    <div className="flex min-h-screen flex-col">
      <PeringatanKonfigurasi />
      <header className="no-print sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white px-4">
        <button
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
          onClick={() => setMenuTerbuka(!menuTerbuka)}
          aria-label="Buka menu"
        >
          <Ikon nama={menuTerbuka ? 'tutup' : 'menu'} className="h-6 w-6" />
        </button>
        <Logo />
        <span className="text-xl font-bold text-utama-700">SIMPUS</span>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden text-sm text-slate-600 sm:inline">{namaPengguna}</span>
          <button
            onClick={() => navigate('/login')}
            className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm hover:bg-slate-50"
          >
            <Ikon nama="keluar" /> Logout
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        <aside
          className={`no-print fixed inset-y-16 left-0 z-20 w-60 border-r border-slate-200 bg-white transition-transform lg:static lg:translate-x-0 ${
            menuTerbuka ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <nav className="flex flex-col gap-1 p-3">
            {menu.map((m) => (
              <NavLink
                key={m.ke}
                to={m.ke}
                end={m.persis}
                onClick={() => setMenuTerbuka(false)}
                className={({ isActive }) =>
                  `flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium ${
                    isActive ? 'bg-utama-50 text-utama-700' : 'text-slate-600 hover:bg-slate-100'
                  }`
                }
              >
                <Ikon nama={m.ikon} />
                {m.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        {menuTerbuka && (
          <div className="fixed inset-0 top-16 z-10 bg-black/30 lg:hidden" onClick={() => setMenuTerbuka(false)} />
        )}
        <main className="min-w-0 flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
