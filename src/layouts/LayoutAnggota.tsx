import { Suspense } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/KonteksAuth'
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
  const { profil } = useAuth()
  return (
    <div className="flex min-h-screen flex-col">
      <PeringatanKonfigurasi />
      <header className="sticky top-0 z-20 border-b border-utama-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <Logo className="h-9 w-9" />
          <span className="text-lg font-bold tracking-tight text-utama-800">SIMPUS</span>

          {/* Menu atas (komputer dan tablet lebar) */}
          <nav aria-label="Menu atas" className="ml-8 hidden gap-1 md:flex">
            {menu.map((m) => (
              <NavLink
                key={m.ke}
                to={m.ke}
                end={m.persis}
                className={({ isActive }) =>
                  `flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium transition ${
                    isActive ? 'bg-utama-600 text-white shadow-sm' : 'text-slate-600 hover:bg-utama-50'
                  }`
                }
              >
                <Ikon nama={m.ikon} className="h-4 w-4" />
                {m.label}
              </NavLink>
            ))}
          </nav>
          <span className="ml-auto hidden truncate text-sm text-slate-500 md:block">{profil?.nama}</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-5 pb-28 md:px-6 md:pb-10">
        <Suspense fallback={<p className="text-sm text-slate-500">Memuat...</p>}>
          <Outlet />
        </Suspense>
      </main>

      {/* Menu bawah (HP) */}
      <nav
        aria-label="Menu bawah"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-utama-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {menu.map((m) => (
          <NavLink
            key={m.ke}
            to={m.ke}
            end={m.persis}
            className={({ isActive }) =>
              `flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium ${isActive ? 'text-utama-700' : 'text-slate-500'}`
            }
          >
            {({ isActive }) => (
              <>
                <span className={`flex h-8 w-14 items-center justify-center rounded-full transition ${isActive ? 'bg-utama-100' : ''}`}>
                  <Ikon nama={m.ikon} className="h-5 w-5" />
                </span>
                {m.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
