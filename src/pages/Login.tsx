import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/KonteksAuth'
import IlustrasiBuku from '../components/IlustrasiBuku'
import PeringatanKonfigurasi from '../components/PeringatanKonfigurasi'
import { berandaUntuk } from '../lib/tipe'

export default function Login() {
  const { masuk } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [kataSandi, setKataSandi] = useState('')
  const [pesan, setPesan] = useState('')
  const [sibuk, setSibuk] = useState(false)

  async function kirim(e: FormEvent) {
    e.preventDefault()
    setPesan('')
    setSibuk(true)
    const hasil = await masuk(username, kataSandi)
    setSibuk(false)
    if (!hasil.ok) {
      setPesan(hasil.pesan)
      return
    }
    // Peran ditentukan otomatis dari akun, bukan dipilih pengguna
    navigate(hasil.profil.wajib_ganti_password ? '/ganti-kata-sandi' : berandaUntuk(hasil.profil.role), { replace: true })
  }

  function reset() {
    setUsername('')
    setKataSandi('')
    setPesan('')
  }

  const kelasInput =
    'mt-1.5 h-12 w-full rounded-xl border border-utama-100 bg-white px-4 outline-none transition focus:border-utama-400 focus:ring-4 focus:ring-utama-100'

  return (
    <div className="flex min-h-screen flex-col bg-krem">
      <PeringatanKonfigurasi />
      <div className="flex flex-1 items-stretch justify-center md:items-center md:p-6">
        <div className="flex w-full max-w-5xl flex-col overflow-hidden bg-white md:flex-row md:rounded-3xl md:shadow-kartu">
          {/* Panel gambar */}
          <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-b-[2.5rem] bg-utama-600 px-6 pt-10 pb-8 text-center text-white md:w-1/2 md:rounded-none md:py-16">
            <div aria-hidden="true" className="absolute -top-16 -left-16 h-48 w-48 rounded-full bg-white/10" />
            <div aria-hidden="true" className="absolute -right-10 -bottom-20 h-56 w-56 rounded-full bg-utama-800/30" />
            <IlustrasiBuku className="relative w-56 max-w-full drop-shadow-lg md:w-80" />
            <h1 className="relative mt-4 text-3xl font-bold tracking-tight">SIMPUS</h1>
            <p className="relative text-sm text-utama-100">Sistem Informasi Perpustakaan Sekolah</p>
            <p className="relative mt-3 hidden max-w-xs text-sm text-white/80 md:block">
              Cari buku, cek ketersediaan, dan pantau pinjamanmu kapan saja.
            </p>
          </div>

          {/* Formulir */}
          <form onSubmit={kirim} className="flex flex-1 flex-col justify-center px-6 py-8 sm:px-10 md:py-16">
            <div className="mx-auto w-full max-w-sm">
              <h2 className="text-2xl font-semibold text-utama-900">Masuk</h2>
              <p className="mt-1 text-sm text-slate-500">Gunakan NIS, NIP, atau ID petugas.</p>

              <label className="mt-6 block text-sm font-medium text-slate-700" htmlFor="username">
                Username (NIS / NIP / ID Petugas)
              </label>
              <input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className={kelasInput}
                required
              />

              <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="sandi">Kata Sandi</label>
              <input
                id="sandi"
                type="password"
                value={kataSandi}
                onChange={(e) => setKataSandi(e.target.value)}
                autoComplete="current-password"
                className={kelasInput}
                required
              />

              {pesan && (
                <p role="alert" className="mt-3 rounded-xl bg-orange-50 px-3 py-2 text-sm text-orange-800">{pesan}</p>
              )}

              <div className="mt-6 flex gap-2">
                <button
                  type="submit"
                  disabled={sibuk}
                  className="h-12 flex-1 rounded-full bg-utama-600 font-semibold text-white shadow-sm transition hover:bg-utama-700 active:scale-[0.98] disabled:opacity-60"
                >
                  {sibuk ? 'Memeriksa...' : 'Masuk'}
                </button>
                <button type="button" onClick={reset} className="h-12 rounded-full border border-utama-200 px-5 text-utama-800 hover:bg-utama-50">
                  Reset
                </button>
              </div>

              <p className="mt-6 text-center text-sm text-slate-500">
                Lupa kata sandi? <span className="font-medium text-utama-700">Hubungi petugas perpustakaan.</span>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
