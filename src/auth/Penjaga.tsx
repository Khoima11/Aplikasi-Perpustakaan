import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './KonteksAuth'
import { berandaUntuk, type Peran } from '../lib/tipe'

export function LayarMemuat() {
  return (
    <div className="flex min-h-screen items-center justify-center text-slate-500" role="status">
      <span className="mr-3 h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-utama-700" />
      Memuat...
    </div>
  )
}

/**
 * Menjaga halaman berdasarkan peran:
 *  - belum login                 -> ke halaman login
 *  - masih wajib ganti kata sandi -> ke halaman ganti kata sandi
 *  - peran tidak sesuai          -> ke beranda perannya sendiri
 */
export function WajibLogin({ peran, children }: { peran: Peran; children: ReactNode }) {
  const { memuat, profil } = useAuth()
  const lokasi = useLocation()

  if (memuat) return <LayarMemuat />
  if (!profil) return <Navigate to="/login" replace state={{ dari: lokasi.pathname }} />
  if (profil.wajib_ganti_password) return <Navigate to="/ganti-kata-sandi" replace />
  if (profil.role !== peran) return <Navigate to={berandaUntuk(profil.role)} replace />
  return <>{children}</>
}

/** Untuk halaman login: yang sudah login langsung diarahkan ke berandanya */
export function HanyaTamu({ children }: { children: ReactNode }) {
  const { memuat, profil } = useAuth()
  if (memuat) return <LayarMemuat />
  if (profil) {
    return <Navigate to={profil.wajib_ganti_password ? '/ganti-kata-sandi' : berandaUntuk(profil.role)} replace />
  }
  return <>{children}</>
}

/** Alamat "/" : arahkan sesuai keadaan login */
export function ArahkanAwal() {
  const { memuat, profil } = useAuth()
  if (memuat) return <LayarMemuat />
  if (!profil) return <Navigate to="/login" replace />
  return <Navigate to={profil.wajib_ganti_password ? '/ganti-kata-sandi' : berandaUntuk(profil.role)} replace />
}
