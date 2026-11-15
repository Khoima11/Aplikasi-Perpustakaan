import { Suspense, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/KonteksAuth'
import Ikon, { type NamaIkon } from '../components/Ikon'
import Logo from '../components/Logo'
import PeringatanKonfigurasi from '../components/PeringatanKonfigurasi'

interface ItemMenu {
  ke: string
  label: string
  ikon: NamaIkon
  persis?: boolean
}

const menu: ItemMenu[] = [
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

// Di HP: 4 menu yang paling sering dipakai di meja layanan + tombol "Menu" untuk sisanya
const menuBawah: ItemMenu[] = [
  { ke: '/petugas', label: 'Beranda', ikon: 'dashboard', persis: true },
  { ke: '/petugas/peminjaman', label: 'Pinjam', ikon: 'pinjam' },
  { ke: '/petugas/pengembalian', label: 'Kembali', ikon: 'kembali' },
  { ke: '/petugas/buku', label: 'Buku', ikon: 'buku' },
]

const kelasMenuSamping = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition ${
    isActive ? 'bg-utama-600 text-white shadow-sm' : 'text-slate-600 hover:bg-utama-50 hover:text-utama-800'
  }`

export default function LayoutPetugas() {
  const [lembarMenu, setLembarMenu] = useState(false)
  const [menuAkun, setMenuAkun] = useState(false)
  const { profil, keluar } = useAuth()
  const lokasi = useLocation()

  // tutup menu saat pindah halaman
  useEffect(() => {
    setLembarMenu(false)
    setMenuAkun(false)
  }, [lokasi.pathname])

  const inisial = (profil?.nama ?? '?').trim().charAt(0).toUpperCase()

  return (
    <div className="flex min-h-screen flex-col">
      <PeringatanKonfigurasi />
      <header className="no-print sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-utama-100 bg-white/95 px-4 backdrop-blur">
        <Logo />
        <span className="text-xl font-bold tracking-tight text-utama-800">SIMPUS</span>
        <div className="relative ml-auto flex items-center gap-2">
          <button
            onClick={() => setMenuAkun(!menuAkun)}
            aria-expanded={menuAkun}
            className="flex min-h-11 max-w-[12rem] items-center gap-2 rounded-full py-1 pr-3 pl-1 text-sm text-slate-700 hover:bg-utama-50 sm:max-w-xs"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-utama-100 font-semibold text-utama-800">
              {inisial}
            </span>
            <span className="truncate">{profil?.nama}</span>
            <span aria-hidden="true" className="text-xs text-slate-400">▾</span>
          </button>
          {menuAkun && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenuAkun(false)} />
              <div className="absolute right-0 top-12 z-40 w-56 overflow-hidden rounded-2xl border border-utama-100 bg-white py-1 shadow-kartu">
                <p className="border-b border-utama-100 px-4 py-2.5 text-xs text-slate-500">Login sebagai {profil?.username}</p>
                <Link to="/petugas/ubah-kata-sandi" className="flex min-h-11 items-center px-4 text-sm hover:bg-utama-50">
                  Ubah Kata Sandi
                </Link>
                <button onClick={() => void keluar()} className="flex min-h-11 w-full items-center px-4 text-sm text-orange-700 hover:bg-orange-50 lg:hidden">
                  Logout
                </button>
              </div>
            </>
          )}
          <button
            onClick={() => void keluar()}
            className="hidden min-h-11 items-center gap-2 rounded-full border border-utama-200 px-4 text-sm text-utama-800 hover:bg-utama-50 lg:flex"
          >
            <Ikon nama="keluar" /> Logout
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Menu samping (komputer) */}
        <aside className="no-print sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 overflow-y-auto border-r border-utama-100 bg-white lg:block">
          <nav aria-label="Menu samping" className="flex flex-col gap-1 p-3">
            {menu.map((m) => (
              <NavLink key={m.ke} to={m.ke} end={m.persis} className={kelasMenuSamping}>
                <Ikon nama={m.ikon} />
                {m.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 p-4 pb-28 sm:p-6 sm:pb-28 lg:pb-6">
          <Suspense fallback={<p className="text-sm text-slate-500">Memuat...</p>}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      {/* Menu bawah (HP dan tablet) */}
      <nav
        aria-label="Menu bawah"
        className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-utama-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        {menuBawah.map((m) => (
          <NavLink
            key={m.ke}
            to={m.ke}
            end={m.persis}
            className={({ isActive }) =>
              `flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium ${isActive ? 'text-utama-700' : 'text-slate-500'}`
            }
          >
            {({ isActive }) => (
              <>
                <span className={`flex h-8 w-12 items-center justify-center rounded-full ${isActive ? 'bg-utama-100' : ''}`}>
                  <Ikon nama={m.ikon} className="h-5 w-5" />
                </span>
                {m.label}
              </>
            )}
          </NavLink>
        ))}
        <button
          onClick={() => setLembarMenu(true)}
          aria-expanded={lembarMenu}
          className="flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium text-slate-500"
        >
          <span className="flex h-8 w-12 items-center justify-center rounded-full">
            <Ikon nama="menu" className="h-5 w-5" />
          </span>
          Menu
        </button>
      </nav>

      {/* Lembar semua menu (HP dan tablet) */}
      {lembarMenu && (
        <div className="no-print fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Semua menu">
          <div className="absolute inset-0 bg-utama-900/40" onClick={() => setLembarMenu(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl">
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-utama-100" />
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-utama-900">Semua Menu</h2>
              <button onClick={() => setLembarMenu(false)} aria-label="Tutup menu" className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-utama-50">
                <Ikon nama="tutup" />
              </button>
            </div>
            <nav aria-label="Semua menu" className="grid grid-cols-3 gap-2">
              {menu.map((m) => (
                <NavLink
                  key={m.ke}
                  to={m.ke}
                  end={m.persis}
                  className={({ isActive }) =>
                    `flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl px-2 text-center text-xs font-medium ${
                      isActive ? 'bg-utama-600 text-white' : 'bg-utama-50 text-utama-900'
                    }`
                  }
                >
                  <Ikon nama={m.ikon} className="h-6 w-6" />
                  {m.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      )}
    </div>
  )
}
