import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/KonteksAuth'
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
  const [menuAkun, setMenuAkun] = useState(false)
  const { profil, keluar } = useAuth()

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
        <div className="relative ml-auto flex items-center gap-2">
          <button
            onClick={() => setMenuAkun(!menuAkun)}
            aria-expanded={menuAkun}
            className="flex min-h-11 max-w-[11rem] items-center gap-2 rounded-lg px-2 text-sm text-slate-700 hover:bg-slate-100 sm:max-w-xs"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-utama-100 text-utama-700">
              <Ikon nama="profil" className="h-4 w-4" />
            </span>
            <span className="truncate">{profil?.nama}</span>
            <span aria-hidden="true">▾</span>
          </button>
          {menuAkun && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenuAkun(false)} />
              <div className="absolute right-0 top-12 z-40 w-52 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                <p className="border-b border-slate-100 px-3 py-2 text-xs text-slate-500">
                  Login sebagai {profil?.username}
                </p>
                <Link
                  to="/petugas/ubah-kata-sandi"
                  onClick={() => setMenuAkun(false)}
                  className="flex min-h-11 items-center px-3 text-sm hover:bg-slate-50"
                >
                  Ubah Kata Sandi
                </Link>
              </div>
            </>
          )}
          <button
            onClick={() => void keluar()}
            className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm hover:bg-slate-50"
          >
            <Ikon nama="keluar" /> <span className="hidden sm:inline">Logout</span>
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
