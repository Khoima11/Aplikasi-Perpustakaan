import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/KonteksAuth'
import { LayarMemuat } from '../auth/Penjaga'
import FormGantiSandi from '../components/FormGantiSandi'
import Logo from '../components/Logo'
import { berandaUntuk } from '../lib/tipe'

// Halaman wajib saat login pertama (atau setelah kata sandi di-reset petugas)
export default function GantiKataSandi() {
  const { memuat, profil, keluar } = useAuth()
  const navigate = useNavigate()

  if (memuat) return <LayarMemuat />
  if (!profil) return <Navigate to="/login" replace />
  if (!profil.wajib_ganti_password) return <Navigate to={berandaUntuk(profil.role)} replace />

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-3">
          <Logo className="h-10 w-10" />
          <div>
            <h1 className="text-xl font-bold text-slate-800">Ganti Kata Sandi</h1>
            <p className="text-sm text-slate-500">Halo, {profil.nama}</p>
          </div>
        </div>
        <p className="mt-4 rounded-lg bg-utama-50 px-3 py-2 text-sm text-utama-800">
          Demi keamanan, kata sandi awal wajib diganti sebelum memakai SIMPUS.
        </p>
        <div className="mt-5">
          <FormGantiSandi
            labelTombol="Simpan dan Lanjutkan"
            onBerhasil={() => navigate(berandaUntuk(profil.role), { replace: true })}
          />
        </div>
        <button
          onClick={() => void keluar()}
          className="mt-3 min-h-11 w-full rounded-lg text-sm text-slate-600 hover:bg-slate-50"
        >
          Batal dan logout
        </button>
      </div>
    </div>
  )
}
