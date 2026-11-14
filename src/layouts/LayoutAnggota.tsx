import { Suspense } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import Ikon, { type NamaIkon } from '../components/Ikon'
import Logo from '../components/Logo'
import PeringatanKonfigurasi from '../components/PeringatanKonfigurasi'

const menu: { ke: string; label: string; ikon: NamaIkon; persis?: boolean }[] = [
  { ke: '/anggota', label: 'Beranda', ikon: 'beranda', persis: true },
  { ke: '/anggota/katalog', label: 'Katalog', ikon: 'katalog' },
  { ke: '/anggota/pinjaman', label: 'Pinjaman', ikon: 'buku' },
  { ke: '/anggota/profil', label: 'Profil', ikon: 'profil' },
]

export default function LayoutAnggota() {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col bg-white shadow-sm">
      <PeringatanKonfigurasi />
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4">
        <Logo className="h-8 w-8" />
        <span className="text-lg font-bold text-utama-700">SIMPUS</span>
      </header>

      <main className="flex-1 px-4 pt-4 pb-24">
        <Suspense fallback={<p className="text-sm text-slate-500">Memuat...</p>}>
            <Outlet />
          </Suspense>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto grid max-w-lg grid-cols-4 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
        {menu.map((m) => (
          <NavLink
            key={m.ke}
            to={m.ke}
            end={m.persis}
            className={({ isActive }) =>
              `flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium ${
                isActive ? 'text-utama-700' : 'text-slate-500'
              }`
            }
          >
            <Ikon nama={m.ikon} className="h-6 w-6" />
            {m.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
